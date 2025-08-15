import express from 'express';
import { exec, spawn } from 'child_process';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || ["http://localhost:8080", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Simple rate limiting for API endpoints
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

const rateLimitMiddleware = (req: any, res: any, next: any) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!requestCounts.has(clientIp)) {
    requestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const clientData = requestCounts.get(clientIp);
  
  if (now > clientData.resetTime) {
    // Reset the count
    requestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  clientData.count++;
  next();
};

interface Location {
  lat: number;
  lng: number;
  city: string;
  country: string;
}

interface Hop {
  ip: string;
  hostname: string;
  latency: number;
  location?: Location;
}

async function getIpLocation(ip: string): Promise<Location | undefined> {
  try {
    console.log(`Getting location for IP: ${ip}`);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,city,lat,lon`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TracerouteApp/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`Location API response for ${ip}:`, data);
    
    if (data.status === 'success' && data.lat && data.lon) {
      return {
        lat: data.lat,
        lng: data.lon,
        city: data.city || 'Unknown',
        country: data.country || 'Unknown'
      };
    }
    
    console.log(`Location API failed for ${ip}: ${data.message || data.status || 'Unknown error'}`);
    return undefined;
  } catch (error: any) {
    if (error && error.name === 'AbortError') {
      console.error(`Location request timeout for IP: ${ip}`);
    } else {
      console.error('Error getting location for IP:', ip, error);
    }
    return undefined;
  }
}

app.get('/', (req, res) => {
    res.json({ 
      message: 'Traceroute API is running',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test endpoint to check IP location service
app.get('/api/test-location/:ip', rateLimitMiddleware, async (req, res) => {
  try {
    const { ip } = req.params;
    console.log(`Testing location for IP: ${ip}`);
    const location = await getIpLocation(ip);
    res.json({ ip, location });
  } catch (error) {
    console.error('Error testing location:', error);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  let currentTraceroute: any = null;

  socket.on('start-traceroute', async (target: string) => {
    console.log(`Starting real-time traceroute to: ${target} for client ${socket.id}`);
    
    // Kill any existing traceroute for this socket
    if (currentTraceroute) {
      console.log('Killing existing traceroute process');
      currentTraceroute.kill('SIGTERM');
      currentTraceroute = null;
    }
    
    try {
      // Emit start event
      socket.emit('traceroute-started', { target });

      // Determine OS and use appropriate command
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'tracert' : 'traceroute';
      const args = isWindows ? ['-h', '30', target] : ['-m', '30', target];

      console.log(`Executing: ${command} ${args.join(' ')}`);

      // Use spawn to get real-time output
      currentTraceroute = spawn(command, args, { 
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false 
      });

      let hopCount = 0;
      let buffer = '';

      currentTraceroute.stdout.on('data', async (data: any) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          await processTracerouteLine(line.trim(), socket, hopCount);
        }
      });

      currentTraceroute.stderr.on('data', (data: any) => {
        const errorOutput = data.toString();
        console.error(`Traceroute stderr: ${errorOutput}`);
        
        // Don't emit error for common Windows tracert messages
        if (!errorOutput.includes('Tracing route') && !errorOutput.includes('over a maximum')) {
          socket.emit('traceroute-error', { error: errorOutput });
        }
      });

      currentTraceroute.on('close', (code: any) => {
        console.log(`Traceroute process exited with code: ${code} for client ${socket.id}`);
        currentTraceroute = null;
        socket.emit('traceroute-completed', { hopCount });
      });

      currentTraceroute.on('error', (error: any) => {
        console.error('Traceroute process error:', error);
        currentTraceroute = null;
        socket.emit('traceroute-error', { error: error.message });
      });

    } catch (error) {
      console.error('Error starting traceroute:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      socket.emit('traceroute-error', { error: errorMessage });
    }
  });

  socket.on('stop-traceroute', () => {
    if (currentTraceroute) {
      console.log(`Stopping traceroute for client ${socket.id}`);
      currentTraceroute.kill('SIGTERM');
      currentTraceroute = null;
      socket.emit('traceroute-stopped');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up any running traceroute
    if (currentTraceroute) {
      console.log(`Cleaning up traceroute for disconnected client ${socket.id}`);
      currentTraceroute.kill('SIGTERM');
      currentTraceroute = null;
    }
  });
});

// Function to process individual traceroute lines
async function processTracerouteLine(line: string, socket: any, hopCount: number) {
  if (!line || line.includes('Tracing route') || 
      line.includes('over a maximum') || line.includes('Trace complete') ||
      line.includes('Unable to resolve') || line.length < 5) {
    return;
  }

  console.log(`Processing line: "${line}"`);

  try {
    // Match hop number at the start of line
    const hopMatch = line.match(/^\s*(\d+)\s+/);
    if (!hopMatch) return;

    const hopNumber = parseInt(hopMatch[1]);

    // Extract IP addresses from the line - look for IPv4 patterns
    const ipMatches = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g);
    if (!ipMatches || ipMatches.length === 0) {
      console.log(`No valid IP found in line: ${line}`);
      return;
    }

    const ip = ipMatches[0];
    console.log(`Found hop ${hopNumber}: ${ip}`);

    // Skip private IPs and localhost
    if (isPrivateIP(ip)) {
      console.log(`Skipping private IP: ${ip}`);
      return;
    }

    // Extract latency - look for first number followed by 'ms'
    const latencyMatch = line.match(/(\d+)\s*ms/);
    const latency = latencyMatch ? parseInt(latencyMatch[1]) : 0;

    // Extract hostname if available
    let hostname = ip;
    const hostnameMatch = line.match(/\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s+/);
    if (hostnameMatch && !hostnameMatch[1].match(/^\d/)) {
      hostname = hostnameMatch[1];
    }

    // Emit hop discovered event immediately
    socket.emit('hop-discovered', {
      hopNumber,
      ip,
      hostname,
      latency,
      location: null
    });

    // Get location data asynchronously with timeout
    try {
      const location = await Promise.race([
        getIpLocation(ip),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);

      if (location) {
        socket.emit('hop-location-updated', {
          hopNumber,
          ip,
          hostname,
          latency,
          location
        });
      }
    } catch (error) {
      console.error(`Error getting location for ${ip}:`, error);
    }

  } catch (error) {
    console.error(`Error processing line "${line}":`, error);
  }
}

// Function to check if IP is private
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => isNaN(part) || part < 0 || part > 255)) {
    return true; // Invalid IP, treat as private
  }

  // Check private IP ranges
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254) // Link-local
  );
}

app.post('/api/traceroute', async (req, res) => {
  try {
    const { target } = req.body;
    if (!target) {
      return res.status(400).json({ error: 'Target host is required' });
    }

    console.log(`Starting traceroute to: ${target}`);

    // Run traceroute command
    const { stdout } = await execAsync(`tracert ${target}`);
    
    console.log('Traceroute output:', stdout);

    // Parse traceroute output
    const lines = stdout.split('\n');
    const hops: Hop[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.includes('Tracing route') || line.includes('over a maximum') || line.includes('Trace complete')) continue;
      
      console.log(`Parsing line: "${line}"`);
      
      // Match tracert output pattern - handle various formats
      const hopMatch = line.match(/^\s*(\d+)\s+/);
      if (!hopMatch) continue;
      
      // Extract IP addresses from the line
      const ipMatches = line.match(/(\d+\.\d+\.\d+\.\d+)/g);
      if (!ipMatches || ipMatches.length === 0) {
        console.log(`No IP found in line: ${line}`);
        continue;
      }
      
      const ip = ipMatches[0]; // Take the first IP found
      console.log(`Found IP: ${ip}`);
      
      // Skip private IPs but allow some common public IPs
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || 
          (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31)) {
        console.log(`Skipping private IP: ${ip}`);
        continue;
      }

      // Extract latency (look for ms values)
      const latencyMatch = line.match(/(\d+)\s*ms/);
      const latency = latencyMatch ? parseInt(latencyMatch[1]) : 0;

      console.log(`Processing IP: ${ip} with latency: ${latency}ms`);

      try {
        const location = await getIpLocation(ip);
        const hop: Hop = {
          ip,
          hostname: ip, // Use IP as hostname for now
          latency,
          location
        };
        
        console.log(`Added hop:`, hop);
        hops.push(hop);
      } catch (error) {
        console.error(`Error processing IP ${ip}:`, error);
      }
    }

    console.log(`Total hops found: ${hops.length}`);
    res.json({ hops });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Socket.IO server ready for real-time traceroute`);
});
