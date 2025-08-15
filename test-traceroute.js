#!/usr/bin/env node

// Test script to check traceroute functionality
import { spawn } from 'child_process';
import { platform } from 'os';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

async function testTraceroute(target = 'google.com') {
  console.log(`Testing traceroute to: ${target}`);
  console.log(`Platform: ${platform()}`);
  
  const isWindows = platform() === 'win32';
  const command = isWindows ? 'tracert' : 'traceroute';
  const args = isWindows ? ['-4', '-h', '10', target] : ['-4', '-m', '10', target]; // Force IPv4, more hops
  
  console.log(`Command: ${command} ${args.join(' ')}`);
  
  try {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows
    });
    
    let hasOutput = false;
    
    child.stdout.on('data', (data) => {
      hasOutput = true;
      console.log('STDOUT:', data.toString());
    });
    
    child.stderr.on('data', (data) => {
      hasOutput = true;
      console.log('STDERR:', data.toString());
    });
    
    child.on('close', (code) => {
      console.log(`Process exited with code: ${code}`);
      if (!hasOutput) {
        console.log('No output received - command may not be available');
        testFallback(target);
      }
    });
    
    child.on('error', (error) => {
      console.log('Process error:', error.message);
      if (error.code === 'ENOENT') {
        console.log('Command not found, testing fallback...');
        testFallback(target);
      }
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!hasOutput) {
        console.log('Timeout - no output received');
        child.kill();
        testFallback(target);
      }
    }, 10000);
    
  } catch (error) {
    console.log('Spawn error:', error.message);
    testFallback(target);
  }
}

async function testFallback(target) {
  console.log('\nTesting fallback method (DNS resolution):');
  
  try {
    const result = await lookup(target);
    console.log(`Resolved ${target} to ${result.address}`);
    console.log('Fallback method works!');
  } catch (error) {
    console.log('Fallback failed:', error.message);
  }
}

// Test with google.com
testTraceroute('google.com');
