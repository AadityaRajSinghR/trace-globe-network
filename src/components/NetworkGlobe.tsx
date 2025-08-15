import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Activity } from "lucide-react";

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

interface NetworkGlobeProps {
  hops: Hop[];
  isTracing: boolean;
  targetHost?: string;
}

const NetworkGlobe = ({ hops, isTracing, targetHost }: NetworkGlobeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const hopMarkersRef = useRef<THREE.Group | null>(null);
  const routeLinesRef = useRef<THREE.Group | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Convert lat/lng to 3D sphere coordinates
  const latLngToVector3 = (lat: number, lng: number, radius: number = 5) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 12);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create Earth globe
    const globeGeometry = new THREE.SphereGeometry(5, 64, 64);
    const globeMaterial = new THREE.MeshPhongMaterial({
      color: 0x2563eb,
      transparent: true,
      opacity: 0.8,
      wireframe: false,
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    globeRef.current = globe;

    // Add wireframe overlay
    const wireframeGeometry = new THREE.SphereGeometry(5.01, 32, 32);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00bfff,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    scene.add(wireframe);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Groups for hops and routes
    const hopMarkers = new THREE.Group();
    const routeLines = new THREE.Group();
    scene.add(hopMarkers);
    scene.add(routeLines);
    hopMarkersRef.current = hopMarkers;
    routeLinesRef.current = routeLines;

    // Mouse controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaMove = {
          x: e.clientX - previousMousePosition.x,
          y: e.clientY - previousMousePosition.y
        };

        globe.rotation.y += deltaMove.x * 0.005;
        globe.rotation.x += deltaMove.y * 0.005;
        wireframe.rotation.y += deltaMove.x * 0.005;
        wireframe.rotation.x += deltaMove.y * 0.005;
        hopMarkers.rotation.y += deltaMove.x * 0.005;
        hopMarkers.rotation.x += deltaMove.y * 0.005;
        routeLines.rotation.y += deltaMove.x * 0.005;
        routeLines.rotation.x += deltaMove.y * 0.005;
      }
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      camera.position.z += e.deltaY * 0.01;
      camera.position.z = Math.max(8, Math.min(20, camera.position.z));
    };

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('wheel', handleWheel);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Auto-rotate when not dragging
      if (!isDragging) {
        globe.rotation.y += 0.002;
        wireframe.rotation.y += 0.002;
        hopMarkers.rotation.y += 0.002;
        routeLines.rotation.y += 0.002;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    setIsInitialized(true);

    return () => {
      // Cleanup
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Add hops to globe
  useEffect(() => {
    if (!isInitialized || !hopMarkersRef.current || !routeLinesRef.current) return;

    // Clear existing markers and routes
    hopMarkersRef.current.clear();
    routeLinesRef.current.clear();

    if (hops.length === 0) return;

    // Add hop markers
    hops.forEach((hop, index) => {
      // Skip hops without location data
      if (!hop.location) return;
      
      const position = latLngToVector3(hop.location.lat, hop.location.lng);
      
      // Create hop marker
      const markerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: index === 0 ? 0x00ff7f : index === hops.length - 1 ? 0xff0040 : 0x00bfff,
        transparent: true,
        opacity: 0.9,
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(position);
      
      // Add pulsing animation
      const scale = 1 + Math.sin(Date.now() * 0.01 + index) * 0.3;
      marker.scale.setScalar(scale);
      
      hopMarkersRef.current?.add(marker);

      // Create route line to next hop
      if (index < hops.length - 1 && hops[index + 1].location) {
        const nextPosition = latLngToVector3(hops[index + 1].location.lat, hops[index + 1].location.lng);
        
        // Create curved line between points
        const curve = new THREE.QuadraticBezierCurve3(
          position,
          position.clone().add(nextPosition).multiplyScalar(0.6).normalize().multiplyScalar(7),
          nextPosition
        );
        
        const points = curve.getPoints(50);
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.7,
          linewidth: 2,
        });
        
        const line = new THREE.Line(lineGeometry, lineMaterial);
        routeLinesRef.current?.add(line);
      }
    });

  }, [hops, isInitialized]);

  return (
    <Card className="h-full border-glow bg-card/80 backdrop-blur-sm overflow-hidden">
      <div className="h-full relative">
        <div className="absolute top-4 left-4 z-10 space-y-2">
          <Badge variant="secondary" className="bg-secondary/20 border border-secondary/30">
            <MapPin className="w-3 h-3 mr-1" />
            {targetHost || "Waiting for target..."}
          </Badge>
          {isTracing && (
            <Badge variant="outline" className="bg-accent/20 border border-accent/30 animate-pulse">
              <Activity className="w-3 h-3 mr-1" />
              Tracing...
            </Badge>
          )}
        </div>
        
        <div ref={containerRef} className="h-full w-full" />
        
        {hops.length === 0 && !isTracing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-sm">
            <div className="text-center p-6">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-primary animate-network-pulse" />
              <h3 className="text-lg font-semibold text-gradient-cyber mb-2">3D Network Globe Ready</h3>
              <p className="text-muted-foreground">Start a traceroute to visualize the network path</p>
            </div>
          </div>
        )}

        {/* Controls info */}
        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-background/20 backdrop-blur-sm p-2 rounded border border-border/30">
          <div>🖱️ Drag to rotate</div>
          <div>🖱️ Scroll to zoom</div>
        </div>
      </div>
    </Card>
  );
};

export default NetworkGlobe;