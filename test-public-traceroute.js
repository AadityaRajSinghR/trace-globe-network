import { spawn } from 'child_process';

function testTraceroute() {
  console.log('Testing traceroute to Google DNS (8.8.8.8)...\n');
  
  const command = process.platform === 'win32' ? 'tracert' : 'traceroute';
  const args = process.platform === 'win32' ? ['-4', '-h', '15', '8.8.8.8'] : ['-4', '-m', '15', '8.8.8.8'];
  
  console.log(`Running: ${command} ${args.join(' ')}`);
  
  const tracert = spawn(command, args, { shell: true });
  
  let output = '';
  
  tracert.stdout.on('data', (data) => {
    const chunk = data.toString();
    output += chunk;
    console.log('STDOUT:', chunk);
  });
  
  tracert.stderr.on('data', (data) => {
    console.log('STDERR:', data.toString());
  });
  
  tracert.on('close', (code) => {
    console.log(`\nProcess exited with code: ${code}`);
    console.log('\n=== FULL OUTPUT ===');
    console.log(output);
    
    // Extract IP addresses
    const ipRegex = /(?:\[)?(\d+\.\d+\.\d+\.\d+)(?:\])?/g;
    const ips = [...output.matchAll(ipRegex)].map(match => match[1]);
    console.log('\n=== EXTRACTED IPs ===');
    ips.forEach((ip, index) => {
      console.log(`${index + 1}: ${ip}`);
    });
  });
  
  tracert.on('error', (error) => {
    console.error('Error:', error);
  });
}

testTraceroute();
