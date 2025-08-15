import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Clock, Server, Globe } from "lucide-react";

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

interface HopsListProps {
  hops: Hop[];
  isTracing: boolean;
  currentHop?: number;
}

const HopsList = ({ hops, isTracing, currentHop }: HopsListProps) => {
  const maxLatency = Math.max(...hops.map(hop => hop.latency), 100);

  return (
    <Card className="h-full border-glow bg-card/80 backdrop-blur-sm overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gradient-cyber">Route Hops</h3>
          <Badge variant="outline" className="bg-primary/20 border border-primary/30">
            {hops.length} hops
          </Badge>
        </div>
      </div>
      
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {hops.length === 0 && !isTracing && (
          <div className="text-center py-8">
            <Server className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No hops detected yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start a traceroute to see the path</p>
          </div>
        )}
        
        {isTracing && (
          <div className="flex items-center gap-3 p-3 border border-accent/30 rounded-lg bg-accent/10 animate-pulse">
            <div className="w-2 h-2 bg-accent rounded-full animate-network-pulse"></div>
            <span className="text-sm font-medium">Discovering hop {currentHop || hops.length + 1}...</span>
          </div>
        )}
        
        {hops.map((hop, index) => (
          <div
            key={hop.ip}
            className={`p-3 border rounded-lg transition-all duration-300 ${
              index === currentHop 
                ? 'border-accent bg-accent/10 animate-pulse-glow' 
                : 'border-border/50 bg-muted/10'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs px-2 py-1">
                  #{index + 1}
                </Badge>
                <span className="font-mono text-sm font-medium text-primary">
                  {hop.ip}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="font-mono">{hop.latency}ms</span>
              </div>
            </div>
            
            {hop.hostname && (
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-3 h-3 text-secondary" />
                <span className="text-xs text-secondary font-mono truncate">
                  {hop.hostname}
                </span>
              </div>
            )}
            
            {hop.location?.city && (
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3 h-3 text-accent" />
                <span className="text-xs text-foreground">
                  {hop.location.city}, {hop.location.country}
                </span>
              </div>
            )}
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono">{hop.latency}ms</span>
              </div>
              <Progress 
                value={(hop.latency / maxLatency) * 100} 
                className="h-1"
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default HopsList;