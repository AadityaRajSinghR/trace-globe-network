import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Play, Globe, Zap } from "lucide-react";

interface TracerouteInputProps {
  onStartTrace: (target: string) => void;
  isTracing: boolean;
}

const TracerouteInput = ({ onStartTrace, isTracing }: TracerouteInputProps) => {
  const [target, setTarget] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (target.trim()) {
      onStartTrace(target.trim());
    }
  };

  return (
    <Card className="p-6 border-glow bg-card/80 backdrop-blur-sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
            <Globe className="w-6 h-6 text-primary animate-network-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gradient-cyber">Network Traceroute</h2>
            <p className="text-sm text-muted-foreground">Trace the path to any IP address or domain</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Enter IP address or domain (e.g., google.com, 8.8.8.8)"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="pr-24 border-glow-accent bg-input/50 text-foreground placeholder:text-muted-foreground"
              disabled={isTracing}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <Zap className="w-4 h-4 text-accent animate-pulse" />
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={!target.trim() || isTracing}
            className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-primary-foreground font-semibold py-3 transition-all duration-300 animate-pulse-glow"
          >
            <Play className="w-4 h-4 mr-2" />
            {isTracing ? "Tracing Route..." : "Start Traceroute"}
          </Button>
        </form>
        
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="text-center p-2 rounded border border-primary/20">
            <div className="font-semibold text-primary">Real-time</div>
            <div className="text-muted-foreground">Live data</div>
          </div>
          <div className="text-center p-2 rounded border border-accent/20">
            <div className="font-semibold text-accent">Geographic</div>
            <div className="text-muted-foreground">World map</div>
          </div>
          <div className="text-center p-2 rounded border border-secondary/20">
            <div className="font-semibold text-secondary">Interactive</div>
            <div className="text-muted-foreground">3D globe</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TracerouteInput;