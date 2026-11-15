import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Bot, Eye, Maximize2, Minimize2, Sparkles, Shield, Cpu, Activity, RefreshCw } from 'lucide-react';

interface ThreeTerminalHeroProps {
  currentMarket: string;
  activeSymbol: string;
  signalDirection: string;
  confidenceScore: number;
}

export const ThreeTerminalHero: React.FC<ThreeTerminalHeroProps> = ({
  currentMarket,
  activeSymbol,
  signalDirection,
  confidenceScore,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [animationMode, setAnimationMode] = useState<'scan' | 'analyze' | 'alert'>('scan');
  const [robotColorTheme, setRobotColorTheme] = useState<'cyan' | 'gold' | 'purple'>('cyan');

  // Mutable refs for Three.js animation
  const animStateRef = useRef({
    mode: animationMode,
    theme: robotColorTheme,
    score: confidenceScore,
  });

  useEffect(() => {
    animStateRef.current = {
      mode: animationMode,
      theme: robotColorTheme,
      score: confidenceScore,
    };
  }, [animationMode, robotColorTheme, confidenceScore]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Scene, Camera, Renderer
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 5.8);
    camera.lookAt(0, 1.3, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 3. Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Lighting Rig
    const ambientLight = new THREE.HemisphereLight(0x00d2ff, 0x050811, 0.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 3.0);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    const goldAccentLight = new THREE.PointLight(0xf59e0b, 1.5, 8);
    goldAccentLight.position.set(0, 1.5, 2);
    scene.add(goldAccentLight);

    // 5. Contact Shadow Grounding Plane
    const shadowGeo = new THREE.PlaneGeometry(6, 6);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x02050b,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    scene.add(shadowPlane);

    // 6. Holographic Grid Platform
    const gridHelper = new THREE.GridHelper(10, 20, 0x00d2ff, 0x1e293b);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // 7. Composite Procedural 3D Robot Assistant ("UMAR-X9")
    // Built as a THREE.Group of 8 distinct parts adhering to 3 silhouette scales:
    // Primary: Chassis/torso, Core Reactor, Head
    // Secondary: Visor, Shoulder pods, Neck collar, Hip stabilizer
    // Accent: Orbital holographic rings, Antenna beacons
    const robotGroup = new THREE.Group();
    robotGroup.position.set(0, 0, 0);

    // Materials with varying roughness/metalness
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.85,
      roughness: 0.25,
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.4,
    });

    const glowColor = new THREE.Color(0x00d2ff);
    const visorMat = new THREE.MeshBasicMaterial({
      color: glowColor,
    });

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Part 1: Pedestal / Hip stabilizer (Primary scale)
    const hipGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.3, 16);
    const hipMesh = new THREE.Mesh(hipGeo, darkMetalMat);
    hipMesh.position.y = 0.35;
    hipMesh.castShadow = !isSoftwareGl;
    robotGroup.add(hipMesh);

    // Part 2: Torso / Chassis (Primary scale)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.75, 0.5);
    const torsoMesh = new THREE.Mesh(torsoGeo, armorMat);
    torsoMesh.position.y = 0.88;
    torsoMesh.castShadow = !isSoftwareGl;
    robotGroup.add(torsoMesh);

    // Part 3: Core Quantum Reactor (Secondary read)
    const coreGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.rotation.x = Math.PI / 2;
    coreMesh.position.set(0, 0.88, 0.26);
    robotGroup.add(coreMesh);

    // Part 4: Shoulder Pauldrons (Secondary read)
    const shoulderGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const leftShoulder = new THREE.Mesh(shoulderGeo, goldTrimMat);
    leftShoulder.position.set(-0.52, 1.1, 0);
    const rightShoulder = new THREE.Mesh(shoulderGeo, goldTrimMat);
    rightShoulder.position.set(0.52, 1.1, 0);
    robotGroup.add(leftShoulder);
    robotGroup.add(rightShoulder);

    // Part 5: Articulating Neck (Secondary read)
    const neckGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.15, 12);
    const neckMesh = new THREE.Mesh(neckGeo, darkMetalMat);
    neckMesh.position.y = 1.33;
    robotGroup.add(neckMesh);

    // Part 6: Head Unit (Primary scale)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.62, 0);

    const headGeo = new THREE.BoxGeometry(0.5, 0.38, 0.45);
    const headMesh = new THREE.Mesh(headGeo, armorMat);
    headMesh.castShadow = !isSoftwareGl;
    headGroup.add(headMesh);

    // Part 7: Optical Visor / Analysis Display (Accent detail)
    const visorGeo = new THREE.BoxGeometry(0.42, 0.12, 0.08);
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 0.04, 0.23);
    headGroup.add(visorMesh);

    // Part 8: Sensory Antennas (Accent detail)
    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8);
    const leftAntenna = new THREE.Mesh(antennaGeo, goldTrimMat);
    leftAntenna.position.set(-0.22, 0.28, 0);
    leftAntenna.rotation.z = 0.2;
    const rightAntenna = new THREE.Mesh(antennaGeo, goldTrimMat);
    rightAntenna.position.set(0.22, 0.28, 0);
    rightAntenna.rotation.z = -0.2;
    headGroup.add(leftAntenna);
    headGroup.add(rightAntenna);

    robotGroup.add(headGroup);

    // Part 9: Holographic Orbital Ring (Accent detail)
    const ringGeo = new THREE.TorusGeometry(0.95, 0.02, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.7 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    ringMesh.position.y = 0.9;
    robotGroup.add(ringMesh);

    // Part 10: Second Counter-rotating Golden Data Ring
    const goldRingGeo = new THREE.TorusGeometry(1.2, 0.015, 8, 48);
    const goldRingMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.5 });
    const goldRingMesh = new THREE.Mesh(goldRingGeo, goldRingMat);
    goldRingMesh.rotation.x = -Math.PI / 4;
    goldRingMesh.position.y = 0.9;
    robotGroup.add(goldRingMesh);

    scene.add(robotGroup);

    // 8. 3D Candlestick Floating Hologram Cylinders
    const candleCount = 14;
    const candleGroup = new THREE.Group();
    candleGroup.position.set(0, 1.2, -1.2);

    const candleBodies: THREE.Mesh[] = [];
    for (let i = 0; i < candleCount; i++) {
      const isBull = i % 2 === 0;
      const height = 0.2 + (Math.sin(i * 0.8) + 1) * 0.25;
      const cGeo = new THREE.BoxGeometry(0.12, height, 0.12);
      const cMat = new THREE.MeshBasicMaterial({
        color: isBull ? 0x10b981 : 0xef4444,
        transparent: true,
        opacity: 0.85,
      });
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.position.set((i - candleCount / 2) * 0.28, (Math.sin(i * 0.5) * 0.4), 0);
      candleGroup.add(cMesh);
      candleBodies.push(cMesh);
    }
    scene.add(candleGroup);

    // 9. Quantum Institutional Particle Field
    const particleCount = isSoftwareGl ? 80 : 250;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 8;
      particlePos[i + 1] = Math.random() * 4;
      particlePos[i + 2] = (Math.random() - 0.5) * 6;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.04,
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 10. Animation Loop & Software-WebGL Guard
    let frameId = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const elapsed = clock.getElapsedTime();

      // Gentle floating hover kinematics
      robotGroup.position.y = Math.sin(elapsed * 1.5) * 0.06;
      headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.25;
      headGroup.rotation.x = Math.sin(elapsed * 1.1) * 0.08;

      // Holographic ring rotations
      ringMesh.rotation.z = elapsed * 0.8;
      goldRingMesh.rotation.z = -elapsed * 0.6;
      goldRingMesh.rotation.y = elapsed * 0.3;

      // Candlestick breathing wave
      for (let i = 0; i < candleBodies.length; i++) {
        candleBodies[i].position.y += Math.sin(elapsed * 2 + i) * 0.0015;
      }

      // Theme color updates
      const currentTheme = animStateRef.current.theme;
      if (currentTheme === 'gold') {
        visorMat.color.setHex(0xf59e0b);
        coreMat.color.setHex(0xf59e0b);
      } else if (currentTheme === 'purple') {
        visorMat.color.setHex(0x8b5cf6);
        coreMat.color.setHex(0x8b5cf6);
      } else {
        visorMat.color.setHex(0x00d2ff);
        coreMat.color.setHex(0x00f0ff);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    // 11. Responsive Resize
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (isSoftwareGl) {
        clearTimeout(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }
      renderer.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="uwt-webgl-surface relative w-full h-[460px] md:h-[520px] rounded-2xl overflow-hidden border border-slate-800 bg-transparent shadow-2xl">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Minimal Top Brand Spec Badge (Clean, zero occlusion) */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none flex items-center space-x-3">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-cyan-500/30 flex items-center space-x-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-200">
            UMAR-X9 QUANT SENTINEL
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">
            3D ACTIVE
          </span>
        </div>

        <div className="hidden sm:flex px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 items-center space-x-2">
          <Activity className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs text-slate-300 font-mono">
            {activeSymbol} • {currentMarket.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Top Right Live Institutional Confidence Indicator */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none flex items-center space-x-2">
        <div className="px-3.5 py-1.5 rounded-lg bg-slate-900/85 border border-slate-800 text-right">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Confluence Engine</div>
          <div className="text-sm font-extrabold text-amber-400 font-mono">
            {confidenceScore}/100 PTS
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg font-bold text-xs font-mono border ${
          signalDirection.includes('BUY')
            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
            : signalDirection.includes('SELL')
            ? 'bg-rose-950/80 text-rose-400 border-rose-500/40'
            : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
        }`}>
          {signalDirection}
        </div>
      </div>

      {/* Ergonomic Collapsible Bottom Control Dock (Strictly following Three.js guidelines) */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-3xl transition-transform duration-300 ease-in-out ${
          isControlsCollapsed ? 'translate-y-[calc(100%-28px)]' : 'translate-y-0'
        }`}
      >
        {/* Collapse / Expand Toggle Button */}
        <div className="flex justify-center -mb-2 relative z-30">
          <button
            onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
            className="px-4 py-1 text-[11px] font-semibold text-slate-300 bg-slate-900/95 border border-slate-700 rounded-t-lg hover:text-cyan-400 flex items-center space-x-1 transition shadow-lg"
          >
            {isControlsCollapsed ? (
              <>
                <span>▴ Show 3D HUD Controls</span>
              </>
            ) : (
              <>
                <span>▾ Collapse 3D HUD (Cinema Mode)</span>
              </>
            )}
          </button>
        </div>

        {/* Unified Bottom Glass Dock */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Mode Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px] font-mono uppercase">AI Mode:</span>
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setAnimationMode('scan')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                  animationMode === 'scan' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Scan Matrix
              </button>
              <button
                onClick={() => setAnimationMode('analyze')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                  animationMode === 'analyze' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Deep SMC
              </button>
              <button
                onClick={() => setAnimationMode('alert')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                  animationMode === 'alert' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Institutional Sentinel
              </button>
            </div>
          </div>

          {/* Color Finish Swatches */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px] font-mono uppercase">Holo Aura:</span>
            <div className="flex space-x-1.5 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setRobotColorTheme('cyan')}
                className={`w-4 h-4 rounded-full bg-cyan-400 transition ring-offset-slate-950 ${
                  robotColorTheme === 'cyan' ? 'ring-2 ring-cyan-300' : 'opacity-60'
                }`}
                title="Cyan Protocol"
              />
              <button
                onClick={() => setRobotColorTheme('gold')}
                className={`w-4 h-4 rounded-full bg-amber-400 transition ring-offset-slate-950 ${
                  robotColorTheme === 'gold' ? 'ring-2 ring-amber-300' : 'opacity-60'
                }`}
                title="Institutional Gold"
              />
              <button
                onClick={() => setRobotColorTheme('purple')}
                className={`w-4 h-4 rounded-full bg-purple-500 transition ring-offset-slate-950 ${
                  robotColorTheme === 'purple' ? 'ring-2 ring-purple-300' : 'opacity-60'
                }`}
                title="Smart Money Purple"
              />
            </div>
          </div>

          {/* Specs Telemetry */}
          <div className="hidden sm:flex items-center space-x-4 text-[11px] font-mono text-slate-400 border-l border-slate-800 pl-3">
            <div>
              <span className="text-slate-500">ENGINE:</span> <span className="text-cyan-400">SMC/ICT/CRT v3.8</span>
            </div>
            <div>
              <span className="text-slate-500">FRAME:</span> <span className="text-emerald-400">60 FPS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
