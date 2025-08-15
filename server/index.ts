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
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    
    console.log(`Location API response for ${ip}:`, data);
    
    if (data.status === 'success') {
      return {
        lat: data.lat,
        lng: data.lon,
        city: data.city,
        country: data.country
      };
    }
    console.log(`Location API failed for ${ip}: ${data.message || 'Unknown error'}`);
    return undefined;
  } catch (error) {
    console.error('Error getting location for IP:', ip, error);
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
app.get('/api/test-location/:ip', async (req, res) => {
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('start-traceroute', async (target: string) => {
    console.log(`Starting real-time traceroute to: ${target}`);
    
    try {
      // Emit start event
      socket.emit('traceroute-started', { target });

      // Use spawn to get real-time output
      const tracert = spawn('tracert', [target]);
      let hopCount = 0;

      tracert.stdout.on('data', async (data) => {
        const output = data.toString();
        const lines = output.split('\n');

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.includes('Tracing route') || 
              trimmedLine.includes('over a maximum') || trimmedLine.includes('Trace complete')) {
            continue;
          }

          console.log(`Processing line: "${trimmedLine}"`);

          // Match hop number
          const hopMatch = trimmedLine.match(/^\s*(\d+)\s+/);
          if (!hopMatch) continue;

          const hopNumber = parseInt(hopMatch[1]);

          // Extract IP addresses from the line
          const ipMatches = trimmedLine.match(/(\d+\.\d+\.\d+\.\d+)/g);
          if (!ipMatches || ipMatches.length === 0) {
            console.log(`No IP found in line: ${trimmedLine}`);
            continue;
          }

          const ip = ipMatches[0];
          console.log(`Found hop ${hopNumber}: ${ip}`);

          // Skip private IPs but allow some common public IPs
          if (ip.startsWith('192.168.') || ip.startsWith('10.') || 
              (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31)) {
            console.log(`Skipping private IP: ${ip}`);
            continue;
          }

          // Extract latency
          const latencyMatch = trimmedLine.match(/(\d+)\s*ms/);
          const latency = latencyMatch ? parseInt(latencyMatch[1]) : 0;

          // Emit hop discovered event immediately
          socket.emit('hop-discovered', {
            hopNumber,
            ip,
            hostname: ip,
            latency,
            location: null // Will be updated when location is fetched
          });

          // Get location data asynchronously
          try {
            const location = await getIpLocation(ip);
            if (location) {
              socket.emit('hop-location-updated', {
                hopNumber,
                ip,
                hostname: ip,
                latency,
                location
              });
            }
          } catch (error) {
            console.error(`Error getting location for ${ip}:`, error);
          }

          hopCount++;
        }
      });

      tracert.stderr.on('data', (data) => {
        console.error(`Tracert stderr: ${data}`);
        socket.emit('traceroute-error', { error: data.toString() });
      });

      tracert.on('close', (code) => {
        console.log(`Tracert process exited with code: ${code}`);
        socket.emit('traceroute-completed', { hopCount });
      });

    } catch (error) {
      console.error('Error starting traceroute:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      socket.emit('traceroute-error', { error: errorMessage });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

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
