import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Hop {
  ip: string;
  hostname: string;
  latency: number;
  location?: {
    lat: number;
    lng: number;
    city: string;
    country: string;
  };
}

interface UseSocketProps {
  onHopDiscovered: (hop: Hop & { hopNumber: number }) => void;
  onHopLocationUpdated: (hop: Hop & { hopNumber: number }) => void;
  onTracerouteStarted: (data: { target: string }) => void;
  onTracerouteCompleted: (data: { hopCount: number }) => void;
  onTracerouteError: (data: { error: string }) => void;
}

export const useSocket = ({
  onHopDiscovered,
  onHopLocationUpdated,
  onTracerouteStarted,
  onTracerouteCompleted,
  onTracerouteError,
}: UseSocketProps) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    socketRef.current = io(serverUrl);

    const socket = socketRef.current;

    // Set up event listeners
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socket.on('traceroute-started', onTracerouteStarted);
    socket.on('hop-discovered', onHopDiscovered);
    socket.on('hop-location-updated', onHopLocationUpdated);
    socket.on('traceroute-completed', onTracerouteCompleted);
    socket.on('traceroute-error', onTracerouteError);

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [onHopDiscovered, onHopLocationUpdated, onTracerouteStarted, onTracerouteCompleted, onTracerouteError]);

  const startTraceroute = (target: string) => {
    if (socketRef.current) {
      socketRef.current.emit('start-traceroute', target);
    }
  };

  const stopTraceroute = () => {
    if (socketRef.current) {
      socketRef.current.emit('stop-traceroute');
    }
  };

  return {
    startTraceroute,
    stopTraceroute,
    isConnected: socketRef.current?.connected || false,
  };
};
