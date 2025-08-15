import { useState } from "react";
import TracerouteInput from "@/components/TracerouteInput";
import NetworkGlobe from "@/components/NetworkGlobe";
import HopsList from "@/components/HopsList";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";

// Interface for location data
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

const Index = () => {
  const [hops, setHops] = useState<Hop[]>([]);
  const [isTracing, setIsTracing] = useState(false);
  const [targetHost, setTargetHost] = useState<string>("");
  const [currentHop, setCurrentHop] = useState<number>(0);
  const { toast } = useToast();

  // Socket.IO event handlers
  const handleHopDiscovered = (hopData: Hop & { hopNumber: number }) => {
    console.log('Hop discovered:', hopData);
    setHops(prev => {
      const newHops = [...prev];
      const existingIndex = newHops.findIndex(h => h.ip === hopData.ip);
      
      if (existingIndex >= 0) {
        newHops[existingIndex] = hopData;
      } else {
        newHops.push(hopData);
      }
      
      return newHops.sort((a: any, b: any) => (a.hopNumber || 0) - (b.hopNumber || 0));
    });
    setCurrentHop(hopData.hopNumber);
  };

  const handleHopLocationUpdated = (hopData: Hop & { hopNumber: number }) => {
    console.log('Hop location updated:', hopData);
    setHops(prev => {
      const newHops = [...prev];
      const existingIndex = newHops.findIndex(h => h.ip === hopData.ip);
      
      if (existingIndex >= 0) {
        newHops[existingIndex] = hopData;
      }
      
      return newHops;
    });

    toast({
      title: "Location Found",
      description: `${hopData.location?.city}, ${hopData.location?.country}`,
    });
  };

  const handleTracerouteStarted = (data: { target: string }) => {
    console.log('Traceroute started:', data);
  };

  const handleTracerouteCompleted = (data: { hopCount: number }) => {
    console.log('Traceroute completed:', data);
    setIsTracing(false);
    setCurrentHop(0);
    
    toast({
      title: "Traceroute Complete",
      description: `Found ${data.hopCount} hops to ${targetHost}`,
    });
  };

  const handleTracerouteError = (data: { error: string }) => {
    console.error('Traceroute error:', data);
    setIsTracing(false);
    setCurrentHop(0);
    
    toast({
      title: "Error",
      description: `Traceroute failed: ${data.error}`,
      variant: "destructive",
    });
  };

  const { startTraceroute, isConnected } = useSocket({
    onHopDiscovered: handleHopDiscovered,
    onHopLocationUpdated: handleHopLocationUpdated,
    onTracerouteStarted: handleTracerouteStarted,
    onTracerouteCompleted: handleTracerouteCompleted,
    onTracerouteError: handleTracerouteError,
  });

  const handleStartTrace = async (target: string) => {
    if (!isConnected) {
      toast({
        title: "Connection Error",
        description: "Not connected to server. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    setTargetHost(target);
    setIsTracing(true);
    setHops([]);
    setCurrentHop(0);

    toast({
      title: "Traceroute Started",
      description: `Starting real-time trace to ${target}`,
    });

    startTraceroute(target);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gradient-cyber">
            Network Traceroute Visualizer
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Trace network paths in real-time and visualize routing hops on an interactive 3D globe
          </p>
        </div>

        {/* Input Section */}
        <div className="max-w-2xl mx-auto">
          <TracerouteInput onStartTrace={handleStartTrace} isTracing={isTracing} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Globe - Takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <NetworkGlobe 
              hops={hops} 
              isTracing={isTracing} 
              targetHost={targetHost}
            />
          </div>
          
          {/* Hops List - Takes 1 column */}
          <div className="lg:col-span-1">
            <HopsList 
              hops={hops} 
              isTracing={isTracing}
              currentHop={currentHop}
            />
          </div>
        </div>

        {/* Status Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Real-time network traceroute with geographical visualization</p>
          <p className="mt-1">
            {isConnected ? 
              "🟢 Connected - Real-time traceroute ready" : 
              "🔴 Disconnected - Please refresh the page"
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;