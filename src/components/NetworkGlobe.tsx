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
  isPrivate?: boolean;
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

    // Create Earth globe with texture
    const globeGeometry = new THREE.SphereGeometry(5, 64, 64);
    
    // Load Earth texture from a URL
    const textureLoader = new THREE.TextureLoader();
    
    // Multiple Earth texture options (prioritized list)
    const earthTextureUrls = [
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      'https://cdn.jsdelivr.net/gh/vasturiano/three-globe/example/img/earth-blue-marble.jpg',
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
      'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'
    ];
    
    let textureIndex = 0;
    
    const loadEarthTexture = () => {
      if (textureIndex >= earthTextureUrls.length) {
        console.warn('All Earth texture URLs failed, using fallback');
        createFallbackTexture();
        return;
      }
      
      const earthTexture = textureLoader.load(
        earthTextureUrls[textureIndex],
        // onLoad callback
        () => {
          console.log(`Earth texture loaded successfully from: ${earthTextureUrls[textureIndex]}`);
          globeMaterial.map = earthTexture;
          globeMaterial.needsUpdate = true;
        },
        // onProgress callback
        undefined,
        // onError callback - try next URL
        () => {
          console.warn(`Failed to load Earth texture from: ${earthTextureUrls[textureIndex]}`);
          textureIndex++;
          loadEarthTexture();
        }
      );
      
      return earthTexture;
    };
    
    const earthTexture = loadEarthTexture();
    
    // Fallback procedural texture function
    const createFallbackTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;
      
      // Ocean color (dark blue)
      ctx.fillStyle = '#0f1419';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Continents (approximate shapes)
      ctx.fillStyle = '#2d4a3a';
      
      // North America
      ctx.fillRect(200, 200, 400, 300);
      ctx.fillRect(150, 250, 200, 200);
      
      // South America
      ctx.fillRect(400, 500, 200, 400);
      
      // Europe
      ctx.fillRect(900, 150, 200, 200);
      
      // Africa
      ctx.fillRect(950, 300, 250, 500);
      
      // Asia
      ctx.fillRect(1100, 100, 600, 400);
      
      // Australia
      ctx.fillRect(1500, 600, 200, 150);
      
      // Add grid lines for lat/lng
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.1;
      
      // Latitude lines
      for (let i = 0; i <= 8; i++) {
        const y = (canvas.height / 8) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Longitude lines
      for (let i = 0; i <= 16; i++) {
        const x = (canvas.width / 16) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
      
      const fallbackTexture = new THREE.CanvasTexture(canvas);
      fallbackTexture.wrapS = THREE.RepeatWrapping;
      fallbackTexture.wrapT = THREE.RepeatWrapping;
      
      globeMaterial.map = fallbackTexture;
      globeMaterial.needsUpdate = true;
    };
    
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      transparent: true,
      opacity: 0.9,
      shininess: 100,
    });
    
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    globeRef.current = globe;
    
    // Add night lights texture as an overlay
    const nightTextureUrls = [
      'https://unpkg.com/three-globe/example/img/earth-night.jpg',
      'https://threejs.org/examples/textures/planets/earth_lights_2048.png'
    ];
    
    let nightTextureIndex = 0;
    
    const loadNightTexture = () => {
      if (nightTextureIndex >= nightTextureUrls.length) {
        return; // Skip night lights if not available
      }
      
      textureLoader.load(
        nightTextureUrls[nightTextureIndex],
        // onLoad callback
        (nightTexture) => {
          console.log(`Night lights texture loaded from: ${nightTextureUrls[nightTextureIndex]}`);
          
          // Create night lights overlay
          const nightGeometry = new THREE.SphereGeometry(5.002, 64, 64);
          const nightMaterial = new THREE.MeshBasicMaterial({
            map: nightTexture,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending,
          });
          
          const nightLights = new THREE.Mesh(nightGeometry, nightMaterial);
          scene.add(nightLights);
          
          // Add to rotation group (you'll need to handle this in mouse controls)
          globe.userData.nightLights = nightLights;
        },
        // onProgress callback
        undefined,
        // onError callback
        () => {
          nightTextureIndex++;
          loadNightTexture();
        }
      );
    };
    
    loadNightTexture();

    // Add wireframe overlay
    const wireframeGeometry = new THREE.SphereGeometry(5.01, 32, 32);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00bfff,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    scene.add(wireframe);

    // Add atmosphere effect
    const atmosphereGeometry = new THREE.SphereGeometry(5.3, 32, 32);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.8 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

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
        
        // Rotate night lights if available
        if (globe.userData.nightLights) {
          globe.userData.nightLights.rotation.y += deltaMove.x * 0.005;
          globe.userData.nightLights.rotation.x += deltaMove.y * 0.005;
        }
        
        wireframe.rotation.y += deltaMove.x * 0.005;
        wireframe.rotation.x += deltaMove.y * 0.005;
        atmosphere.rotation.y += deltaMove.x * 0.005;
        atmosphere.rotation.x += deltaMove.y * 0.005;
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
        
        // Rotate night lights if available
        if (globe.userData.nightLights) {
          globe.userData.nightLights.rotation.y += 0.002;
        }
        
        wireframe.rotation.y += 0.002;
        atmosphere.rotation.y += 0.001;
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
        color: index === 0 ? 0x00ff7f : index === hops.length - 1 ? 0xff0040 : 0xffff00,
        transparent: true,
        opacity: 0.9,
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(position);
      
      // Add a glowing ring around the marker
      const ringGeometry = new THREE.RingGeometry(0.1, 0.15, 16);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: index === 0 ? 0x00ff7f : index === hops.length - 1 ? 0xff0040 : 0xffff00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(position);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      
      // Add pulsing animation
      const time = Date.now() * 0.01;
      const scale = 1 + Math.sin(time + index) * 0.3;
      marker.scale.setScalar(scale);
      ring.scale.setScalar(scale * 1.2);
      
      hopMarkersRef.current?.add(marker);
      hopMarkersRef.current?.add(ring);

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