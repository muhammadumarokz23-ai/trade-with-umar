import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  InstrumentInfo,
  MarketType,
  SignalCard,
  Timeframe,
} from '../../types/trading';
import { MarketDataService, NewsFeedResponse, OrderFlowSnapshot } from '../../services/marketData';
import { MTFEngine, MTFPairEvaluation } from '../../services/mtfEngine';
import { ConfluenceEngine } from '../../services/confluenceEngine';
import { SUPPORTED_INSTRUMENTS } from '../../services/instruments';
import { SignalCardComponent } from '../signals/SignalCardComponent';
import {
  Award,
  Bot,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  MessageSquare,
  Newspaper,
  Play,
  Radar,
  ShieldCheck,
  Users,
} from 'lucide-react';

export type AgentId = 'news' | 'analyst' | 'smart_money' | 'scanner' | 'manager';
export type AgentLifecycle = 'idle' | 'working' | 'walking' | 'presenting' | 'complete';

interface AgentStatusCard {
  id: AgentId;
  name: string;
  role: string;
  colorHex: string;
  badgeClass: string;
  status: AgentLifecycle;
  output: string;
  bubble: string;
}

interface ScannerRankItem {
  rank: '1st' | '2nd' | '3rd';
  symbol: string;
  market: MarketType;
  direction: string;
  score: number;
  summary: string;
}

interface TranscriptMessage {
  id: string;
  agentName: string;
  role: string;
  colorClass: string;
  text: string;
  time: string;
}

interface AgentMeetingRooms3DProps {
  instrument: InstrumentInfo;
  timeframe: Timeframe;
  onSelectInstrument: (symbol: string, market: MarketType) => void;
  onExecutePaperTrade?: (signal: SignalCard) => void;
  onRequestGeminiDeepDive?: (signal: SignalCard) => void;
}

interface Agent3DRig {
  id: AgentId;
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Group;
  homePos: THREE.Vector3;
  meetingPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  bubbleAnchor: THREE.Vector3;
}

const INITIAL_AGENTS: AgentStatusCard[] = [
  {
    id: 'news',
    name: 'Agent 1: NEWS AGENT',
    role: 'Live Headlines & Macro Event Risk',
    colorHex: '#00d2ff',
    badgeClass: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/70',
    status: 'idle',
    output: 'Ready to scan live CryptoCompare / Yahoo Finance RSS feeds.',
    bubble: 'Scanning live news feeds...',
  },
  {
    id: 'analyst',
    name: 'Agent 2: MARKET ANALYST',
    role: 'MTF 1W→4H • 1D→1H • 4H→15M • 1H→5M',
    colorHex: '#a855f7',
    badgeClass: 'text-purple-300 border-purple-500/40 bg-purple-950/70',
    status: 'idle',
    output: 'Ready to evaluate OB, FVG, BPR, Liquidity Sweeps & CHoCH/MSS.',
    bubble: 'Mapping HTF → LTF zones...',
  },
  {
    id: 'smart_money',
    name: 'Agent 3: SMART MONEY AGENT',
    role: 'Bookmap Depth • CVD • Liquidity Walls',
    colorHex: '#f59e0b',
    badgeClass: 'text-amber-300 border-amber-500/40 bg-amber-950/70',
    status: 'idle',
    output: 'Ready to inspect Binance L2 order flow, absorption & volume spikes.',
    bubble: 'Tracking institutional walls...',
  },
  {
    id: 'scanner',
    name: 'Agent 4: SCANNER AGENT',
    role: 'Cross-Market Ranker (1st • 2nd • 3rd)',
    colorHex: '#10b981',
    badgeClass: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/70',
    status: 'idle',
    output: 'Ready to rank Crypto, Forex & Stock setups across markets.',
    bubble: 'Ranking top setups...',
  },
  {
    id: 'manager',
    name: 'Agent 5: MANAGER AGENT',
    role: 'Chief Chair & Signal Conflict Gatekeeper',
    colorHex: '#3b82f6',
    badgeClass: 'text-blue-300 border-blue-500/40 bg-blue-950/70',
    status: 'idle',
    output: 'Waiting in Central Conference Room to convene briefing.',
    bubble: 'Chairing institutional desk.',
  },
];

function buildCartoonAgent(
  id: AgentId,
  suitColor: number,
  accentColor: number,
  homePos: THREE.Vector3,
  meetingPos: THREE.Vector3
): Agent3DRig {
  const root = new THREE.Group();
  root.position.copy(homePos);

  const suitMat = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.45, metalness: 0.25 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.6 });
  const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });

  // Torso (rounded cartoon jacket)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.55, 16), suitMat);
  torso.position.y = 0.68;
  root.add(torso);

  // Chest badge / tie
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.06), glowMat);
  badge.position.set(0, 0.72, 0.24);
  root.add(badge);

  // Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.4, 0);
  const legGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.38, 12);
  const lLegMesh = new THREE.Mesh(legGeo, darkMat);
  lLegMesh.position.y = -0.19;
  leftLeg.add(lLegMesh);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.4, 0);
  const rLegMesh = new THREE.Mesh(legGeo, darkMat);
  rLegMesh.position.y = -0.19;
  rightLeg.add(rLegMesh);
  root.add(rightLeg);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.42, 12);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 0.88, 0);
  const lArmMesh = new THREE.Mesh(armGeo, suitMat);
  lArmMesh.position.y = -0.18;
  leftArm.add(lArmMesh);
  root.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 0.88, 0);
  const rArmMesh = new THREE.Mesh(armGeo, suitMat);
  rArmMesh.position.y = -0.18;
  rightArm.add(rArmMesh);
  root.add(rightArm);

  // Cartoon Head
  const head = new THREE.Group();
  head.position.set(0, 1.18, 0);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 18), skinMat);
  head.add(headMesh);

  // Expressive Cartoon Eyes
  const eyeGeo = new THREE.SphereGeometry(0.042, 10, 10);
  const leftEye = new THREE.Mesh(eyeGeo, glowMat);
  leftEye.position.set(-0.085, 0.04, 0.21);
  const rightEye = new THREE.Mesh(eyeGeo, glowMat);
  rightEye.position.set(0.085, 0.04, 0.21);
  head.add(leftEye, rightEye);

  // Role-specific Cartoon Props
  if (id === 'news') {
    // Press headset + antenna
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 20, Math.PI), glowMat);
    band.position.y = 0.03;
    head.add(band);
  } else if (id === 'analyst') {
    // Hologram glasses
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.06), glowMat);
    visor.position.set(0, 0.04, 0.23);
    head.add(visor);
  } else if (id === 'smart_money') {
    // Gold monocle / whale crest
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 6), glowMat);
    crest.position.set(0, 0.3, 0);
    head.add(crest);
  } else if (id === 'scanner') {
    // Dual radar antennas
    const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8);
    const a1 = new THREE.Mesh(antGeo, glowMat);
    a1.position.set(-0.14, 0.26, 0);
    a1.rotation.z = 0.25;
    const a2 = new THREE.Mesh(antGeo, glowMat);
    a2.position.set(0.14, 0.26, 0);
    a2.rotation.z = -0.25;
    head.add(a1, a2);
  } else if (id === 'manager') {
    // Executive Gold Crown Rim
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    crown.position.set(0, 0.27, 0);
    head.add(crown);
  }

  root.add(head);

  return {
    id,
    root,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    homePos: homePos.clone(),
    meetingPos: meetingPos.clone(),
    currentPos: homePos.clone(),
    targetPos: homePos.clone(),
    bubbleAnchor: new THREE.Vector3(),
  };
}

export const AgentMeetingRooms3D: React.FC<AgentMeetingRooms3DProps> = ({
  instrument,
  timeframe,
  onSelectInstrument,
  onExecutePaperTrade,
  onRequestGeminiDeepDive,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [agents, setAgents] = useState<AgentStatusCard[]>(INITIAL_AGENTS);
  const [meetingPhase, setMeetingPhase] = useState<'IDLE' | 'WORKING' | 'CONVENING' | 'DELIBERATING' | 'COMPLETE'>('IDLE');
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [rankedTop3, setRankedTop3] = useState<ScannerRankItem[]>([]);
  const [finalSignal, setFinalSignal] = useState<SignalCard | null>(null);
  const [mtfResults, setMtfResults] = useState<MTFPairEvaluation[]>([]);
  const [newsSummary, setNewsSummary] = useState<NewsFeedResponse | null>(null);
  const [orderflowSummary, setOrderflowSummary] = useState<OrderFlowSnapshot | null>(null);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [bubbleCoords, setBubbleCoords] = useState<Record<AgentId, { x: number; y: number; visible: boolean }>>({
    news: { x: 0, y: 0, visible: false },
    analyst: { x: 0, y: 0, visible: false },
    smart_money: { x: 0, y: 0, visible: false },
    scanner: { x: 0, y: 0, visible: false },
    manager: { x: 0, y: 0, visible: false },
  });

  const agentStatusRef = useRef<Record<AgentId, AgentLifecycle>>({
    news: 'idle',
    analyst: 'idle',
    smart_money: 'idle',
    scanner: 'idle',
    manager: 'idle',
  });

  const setAgentStatus = (id: AgentId, status: AgentLifecycle, output?: string, bubble?: string) => {
    agentStatusRef.current[id] = status;
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              output: output ?? a.output,
              bubble: bubble ?? a.bubble,
            }
          : a
      )
    );
  };

  // Three.js Multi-Room 3D Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

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

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 120);
    camera.position.set(0, 7.2, 12.2);
    camera.lookAt(0, 1.0, 0);

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
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Lighting
    scene.add(new THREE.HemisphereLight(0x38bdf8, 0x090d1a, 0.9));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(6, 12, 8);
    scene.add(keyLight);

    const purpleRim = new THREE.PointLight(0x8b5cf6, 4.0, 20);
    purpleRim.position.set(-5, 4, -2);
    scene.add(purpleRim);

    const goldRim = new THREE.PointLight(0xf59e0b, 3.5, 20);
    goldRim.position.set(5, 4, -2);
    scene.add(goldRim);

    // Moving Holographic Grid Floor
    const gridA = new THREE.GridHelper(40, 40, 0x00d2ff, 0x1e293b);
    gridA.position.y = 0.01;
    scene.add(gridA);

    // InstancedMesh Holographic Skyline Background (>20 repeated elements)
    const towerCount = 36;
    const towerGeo = new THREE.BoxGeometry(0.9, 1, 0.9);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x1e1b4b,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 0.72,
    });
    const skyline = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < towerCount; i++) {
      const angle = (i / towerCount) * Math.PI * 1.4 - Math.PI * 0.7;
      const radius = 13 + (i % 3) * 2.5;
      const h = 2.5 + ((i * 7) % 6);
      dummy.position.set(Math.sin(angle) * radius, h / 2, -Math.cos(angle) * radius * 0.65 - 3);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      skyline.setMatrixAt(i, dummy.matrix);
    }
    skyline.instanceMatrix.needsUpdate = true;
    scene.add(skyline);

    // Build 5 Glass Rooms (4 Specialist Rooms + 1 Central Manager Conference Room)
    const buildGlassRoom = (x: number, z: number, w: number, d: number, accentHex: number) => {
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);

      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.08, d),
        new THREE.MeshStandardMaterial({ color: 0x0b1224, roughness: 0.4, metalness: 0.5 })
      );
      floor.position.y = 0.04;
      grp.add(floor);

      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 2.2, d)),
        new THREE.LineBasicMaterial({ color: accentHex, transparent: true, opacity: 0.65 })
      );
      border.position.y = 1.1;
      grp.add(border);

      const glassWall = new THREE.Mesh(
        new THREE.BoxGeometry(w, 2.2, d),
        new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.05, depthWrite: false })
      );
      glassWall.position.y = 1.1;
      grp.add(glassWall);

      scene.add(grp);
    };

    // 4 Specialist Rooms
    buildGlassRoom(-5.8, -2.6, 3.0, 2.8, 0x00d2ff); // News Room
    buildGlassRoom(-5.8, 2.2, 3.0, 2.8, 0xa855f7); // Market Analyst Room
    buildGlassRoom(5.8, -2.6, 3.0, 2.8, 0xf59e0b); // Smart Money Room
    buildGlassRoom(5.8, 2.2, 3.0, 2.8, 0x10b981); // Scanner Room

    // Central Manager Conference Room
    buildGlassRoom(0, 0, 5.0, 4.8, 0x3b82f6);

    // Holographic Round Conference Table inside Central Room
    const tableMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 0.85, 0.65, 24),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 })
    );
    tableMesh.position.set(0, 0.35, 0);
    scene.add(tableMesh);

    const holoDisk = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.03, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0x00d2ff })
    );
    holoDisk.rotation.x = Math.PI / 2;
    holoDisk.position.set(0, 0.7, 0);
    scene.add(holoDisk);

    // Build 5 Animated Cartoon 3D Agents
    const rigs: Agent3DRig[] = [
      buildCartoonAgent('news', 0x0284c7, 0x00d2ff, new THREE.Vector3(-5.8, 0, -2.6), new THREE.Vector3(-1.45, 0, -1.0)),
      buildCartoonAgent('analyst', 0x7e22ce, 0xc084fc, new THREE.Vector3(-5.8, 0, 2.2), new THREE.Vector3(-1.45, 0, 1.0)),
      buildCartoonAgent('smart_money', 0xb45309, 0xfbbf24, new THREE.Vector3(5.8, 0, -2.6), new THREE.Vector3(1.45, 0, -1.0)),
      buildCartoonAgent('scanner', 0x047857, 0x34d399, new THREE.Vector3(5.8, 0, 2.2), new THREE.Vector3(1.45, 0, 1.0)),
      buildCartoonAgent('manager', 0x1d4ed8, 0xf59e0b, new THREE.Vector3(0, 0, -1.75), new THREE.Vector3(0, 0, -1.75)),
    ];
    rigs.forEach((r) => scene.add(r.root));

    let frameId = 0;
    let lastBubbleSync = 0;
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
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Moving holographic floor grid effect
      gridA.position.z = (elapsed * 0.6) % 1;
      holoDisk.rotation.z = elapsed * 0.8;

      const curW = container?.clientWidth || width;
      const curH = container?.clientHeight || height;

      for (const rig of rigs) {
        const st = agentStatusRef.current[rig.id];
        if (rig.id !== 'manager') {
          rig.targetPos.copy(
            st === 'walking' || st === 'presenting' || st === 'complete' ? rig.meetingPos : rig.homePos
          );
        }

        const dx = rig.targetPos.x - rig.currentPos.x;
        const dz = rig.targetPos.z - rig.currentPos.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.06) {
          const speed = 3.2;
          const step = Math.min(dist, speed * dt);
          rig.currentPos.x += (dx / dist) * step;
          rig.currentPos.z += (dz / dist) * step;
          rig.root.position.copy(rig.currentPos);
          rig.root.rotation.y = Math.atan2(dx, dz);

          // Cartoon walking gait
          const swing = Math.sin(elapsed * 12) * 0.6;
          rig.leftLeg.rotation.x = swing;
          rig.rightLeg.rotation.x = -swing;
          rig.leftArm.rotation.x = -swing * 0.7;
          rig.rightArm.rotation.x = swing * 0.7;
          rig.root.position.y = Math.abs(Math.sin(elapsed * 12)) * 0.06;
        } else {
          rig.leftLeg.rotation.x *= 0.85;
          rig.rightLeg.rotation.x *= 0.85;
          rig.root.position.y = 0;

          if (st === 'working') {
            // Typing / analyzing gesture at desk
            rig.leftArm.rotation.x = -0.6 + Math.sin(elapsed * 8) * 0.15;
            rig.rightArm.rotation.x = -0.6 + Math.cos(elapsed * 8) * 0.15;
            rig.head.rotation.y = Math.sin(elapsed * 2) * 0.25;
            rig.root.rotation.y = rig.id === 'news' || rig.id === 'analyst' ? Math.PI * 0.5 : -Math.PI * 0.5;
          } else if (st === 'presenting') {
            // Look toward conference table center & animate gestures
            rig.root.rotation.y = Math.atan2(-rig.currentPos.x, -rig.currentPos.z);
            rig.rightArm.rotation.x = -0.9 + Math.sin(elapsed * 6) * 0.35;
            rig.leftArm.rotation.x = -0.25;
            rig.head.rotation.y = Math.sin(elapsed * 3) * 0.15;
          } else {
            rig.root.rotation.y = Math.atan2(-rig.currentPos.x, -rig.currentPos.z + 0.5);
            rig.leftArm.rotation.x *= 0.9;
            rig.rightArm.rotation.x *= 0.9;
            rig.head.rotation.y = Math.sin(elapsed * 1.1) * 0.12;
          }
        }
      }

      renderer.render(scene, camera);

      // Throttle 2D speech-bubble coordinate sync to ~10 Hz
      if (performance.now() - lastBubbleSync > 100) {
        lastBubbleSync = performance.now();
        const nextCoords = {} as Record<AgentId, { x: number; y: number; visible: boolean }>;
        for (const rig of rigs) {
          rig.bubbleAnchor.set(rig.currentPos.x, 1.85, rig.currentPos.z);
          rig.bubbleAnchor.project(camera);
          nextCoords[rig.id] = {
            x: (rig.bubbleAnchor.x * 0.5 + 0.5) * curW,
            y: (-rig.bubbleAnchor.y * 0.5 + 0.5) * curH,
            visible: rig.bubbleAnchor.z < 1,
          };
        }
        setBubbleCoords(nextCoords);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (isSoftwareGl) clearTimeout(frameId);
      else cancelAnimationFrame(frameId);
      renderer.dispose();
      towerGeo.dispose();
      towerMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const appendLog = (agentName: string, role: string, colorClass: string, text: string) => {
    setTranscript((prev) => [
      ...prev,
      {
        id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        agentName,
        role,
        colorClass,
        text,
        time: new Date().toLocaleTimeString(),
      },
    ]);
  };

  // Run the Real Multi-Agent Workflow
  const conveneMeeting = async () => {
    setMeetingPhase('WORKING');
    setTranscript([]);
    setFinalSignal(null);

    setAgentStatus('news', 'working', 'Fetching real financial headlines...', 'Reading live RSS & news...');
    setAgentStatus('analyst', 'working', 'Evaluating 1W→4H, 1D→1H, 4H→15M, 1H→5M...', 'Checking HTF zones & sweeps...');
    setAgentStatus('smart_money', 'working', 'Inspecting L2 depth, CVD & walls...', 'Computing order flow delta...');
    setAgentStatus('scanner', 'working', 'Scanning Crypto, Forex & Stocks...', 'Ranking top 1st / 2nd / 3rd...');
    setAgentStatus('manager', 'working', 'Preparing central conference briefing...', 'Waiting for specialist desks...');

    // Phase 1: Parallel Live Intelligence Gathering
    const [newsRes, orderFlowRes, candleRes] = await Promise.all([
      MarketDataService.fetchNews(instrument.symbol, instrument.market),
      MarketDataService.fetchOrderFlow(instrument.symbol),
      MarketDataService.fetchCandles(instrument.symbol, instrument.market, timeframe, 120),
    ]);
    setNewsSummary(newsRes);
    setOrderflowSummary(orderFlowRes);

    const mtfPairs = await MTFEngine.evaluateAllPairs(instrument, orderFlowRes);
    setMtfResults(mtfPairs);

    // Scan cross-market instruments for Scanner Agent (Top 1st / 2nd / 3rd)
    const sampleSet = [
      SUPPORTED_INSTRUMENTS.find((i) => i.symbol === 'BTCUSDT'),
      SUPPORTED_INSTRUMENTS.find((i) => i.symbol === 'ETHUSDT'),
      SUPPORTED_INSTRUMENTS.find((i) => i.symbol === 'SOLUSDT'),
      SUPPORTED_INSTRUMENTS.find((i) => i.symbol === 'EURUSD'),
      SUPPORTED_INSTRUMENTS.find((i) => i.symbol === 'XAUUSD'),
      SUPPORTED_INSTRUMENTS.find((i) => i.symbol === 'NVDA'),
      SUPPORTED_INSTRUMENTS.find((i) => i.symbol === 'AAPL'),
    ].filter((x): x is InstrumentInfo => Boolean(x));

    const scanCards: SignalCard[] = [];
    await Promise.all(
      sampleSet.map(async (inst) => {
        const res = await MarketDataService.fetchCandles(inst.symbol, inst.market, timeframe, 90);
        const analysis = ConfluenceEngine.analyze(inst, res.candles, timeframe, {
          isLiveFeed: res.isLiveFeed,
        });
        if (res.isLiveFeed) scanCards.push(analysis.signal);
      })
    );

    const sortedTop3: ScannerRankItem[] = scanCards
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 3)
      .map((sig, idx) => ({
        rank: idx === 0 ? '1st' : idx === 1 ? '2nd' : '3rd',
        symbol: sig.symbol,
        market: sig.market,
        direction: sig.direction,
        score: sig.confidenceScore,
        summary: `${sig.smcConfirmation} | ${sig.marketSession}`,
      }));
    setRankedTop3(sortedTop3);

    // Phase 2: Agents Walk into Manager's Central Conference Room
    setMeetingPhase('CONVENING');
    const newsMsg = newsRes.isLive
      ? `${newsRes.headlines.length} live headlines (${newsRes.overallSentiment}). High-risk events: ${newsRes.highRiskCount}.`
      : 'LIVE NEWS FEED UNAVAILABLE — No invented news.';
    const mtfActionable = mtfPairs.filter((p) => p.entryAllowed);
    const analystMsg = !candleRes.isLiveFeed
      ? 'DEMO MODE - LIVE MARKET DATA UNAVAILABLE. Zero live signals.'
      : mtfActionable.length > 0
      ? `${mtfActionable.length}/4 MTF pairs aligned: ${mtfActionable.map((p) => `${p.analysisTf.toUpperCase()}→${p.entryTf.toUpperCase()} (${p.verdict})`).join(', ')}.`
      : `All 4 MTF pairs in WAIT (HTF bias: ${mtfPairs[2]?.htfBias || 'NEUTRAL'}; awaiting sweep + CHoCH + retest).`;
    const smMsg = orderFlowRes.isLive
      ? `Bias: ${orderFlowRes.institutionalBias} | Imbalance ${(orderFlowRes.bidAskImbalance * 100).toFixed(1)}% | Bid Walls: ${orderFlowRes.bidWalls.length}, Ask Walls: ${orderFlowRes.askWalls.length} | Absorption: ${orderFlowRes.absorptionDetected}.`
      : orderFlowRes.statusMessage;
    const scanMsg =
      sortedTop3.length > 0
        ? `Ranked ${sortedTop3.map((r) => `${r.rank} ${r.symbol} (${r.score}pt ${r.direction})`).join(' • ')}`
        : 'LIVE MARKET DATA UNAVAILABLE across scanner universe.';

    setAgentStatus('news', 'walking', newsMsg, 'Walking to Manager Room...');
    setAgentStatus('analyst', 'walking', analystMsg, 'Walking to Manager Room...');
    setAgentStatus('smart_money', 'walking', smMsg, 'Walking to Manager Room...');
    setAgentStatus('scanner', 'walking', scanMsg, 'Walking to Manager Room...');

    await new Promise((r) => setTimeout(r, 1500));

    // Phase 3: Sequential Presentations inside Manager's Room
    setMeetingPhase('DELIBERATING');
    setAgentStatus('news', 'presenting', newsMsg, newsMsg.slice(0, 62));
    appendLog('News Agent', 'Macro & Headlines', 'text-cyan-400', newsMsg);
    await new Promise((r) => setTimeout(r, 650));

    setAgentStatus('news', 'complete');
    setAgentStatus('analyst', 'presenting', analystMsg, analystMsg.slice(0, 62));
    appendLog('Market Analyst', 'MTF SMC/ICT/CRT', 'text-purple-300', analystMsg);
    await new Promise((r) => setTimeout(r, 650));

    setAgentStatus('analyst', 'complete');
    setAgentStatus('smart_money', 'presenting', smMsg, smMsg.slice(0, 62));
    appendLog('Smart Money Agent', 'Order Flow & Walls', 'text-amber-300', smMsg);
    await new Promise((r) => setTimeout(r, 650));

    setAgentStatus('smart_money', 'complete');
    setAgentStatus('scanner', 'presenting', scanMsg, scanMsg.slice(0, 62));
    appendLog('Scanner Agent', '1st / 2nd / 3rd Ranker', 'text-emerald-300', scanMsg);
    await new Promise((r) => setTimeout(r, 650));
    setAgentStatus('scanner', 'complete');

    // Phase 4: Manager Conflict Check & Deterministic Signal Verdict
    setAgentStatus('manager', 'presenting', 'Checking cross-agent agreement & risk gates...', 'Synthesizing final signal...');
    const confluence = ConfluenceEngine.analyze(instrument, candleRes.candles, timeframe, {
      isLiveFeed: candleRes.isLiveFeed,
      orderFlow: orderFlowRes,
    });

    let verdictSignal = confluence.signal;
    // Strict High-Risk News Override -> WAIT
    if (newsRes.highRiskWarning && verdictSignal.direction !== 'WAIT') {
      verdictSignal = {
        ...verdictSignal,
        direction: 'WAIT',
        aiExplanation: `MANAGER VETO -> WAIT: High-risk news event detected (${newsRes.highRiskCount} headline flags). ${verdictSignal.aiExplanation}`,
      };
    }

    const managerSummary = !candleRes.isLiveFeed
      ? 'FINAL DECISION: WAIT — DEMO MODE - LIVE MARKET DATA UNAVAILABLE. Zero live trades permitted.'
      : `FINAL DECISION: ${verdictSignal.direction} on ${instrument.symbol} (${verdictSignal.confidenceScore}/100 structural confluence).`;

    appendLog('Manager Agent', 'Chief Risk Chair', 'text-blue-300', managerSummary);
    setAgentStatus('manager', 'complete', managerSummary, verdictSignal.direction);
    setFinalSignal(verdictSignal);
    setMeetingPhase('COMPLETE');
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header Control Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>3D MULTI-AGENT INSTITUTIONAL WAR ROOM</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            5 animated cartoon AI agents work in their glass offices, walk into the Manager&apos;s room, debate live data, and issue a consensus signal.
          </p>
        </div>

        <button
          onClick={conveneMeeting}
          disabled={meetingPhase === 'WORKING' || meetingPhase === 'CONVENING' || meetingPhase === 'DELIBERATING'}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 hover:opacity-95 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center space-x-2 shadow-lg transition"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>
            {meetingPhase === 'IDLE' || meetingPhase === 'COMPLETE'
              ? `Convene 5-Agent Briefing (${instrument.symbol})`
              : `Meeting In Progress (${meetingPhase})...`}
          </span>
        </button>
      </div>

      {/* 3D WebGL Multi-Room Stage */}
      <div className="uwt-webgl-surface relative w-full h-[480px] md:h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-transparent shadow-2xl">
        <div ref={mountRef} className="w-full h-full" />

        {/* Projected 3D Agent Speech Bubbles (Zero backdrop-filter over WebGL) */}
        {agents.map((ag) => {
          const pos = bubbleCoords[ag.id];
          if (!pos?.visible || ag.status === 'idle') return null;
          return (
            <div
              key={ag.id}
              style={{
                left: `${Math.min(Math.max(pos.x, 90), 820)}px`,
                top: `${Math.max(pos.y - 26, 48)}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className="absolute z-10 pointer-events-none max-w-[200px] px-2.5 py-1.5 rounded-xl bg-slate-950/95 border border-slate-700 text-[10px] shadow-xl"
            >
              <div className="font-bold uppercase" style={{ color: ag.colorHex }}>
                {ag.name.replace(/^Agent \d+: /, '')} • {ag.status}
              </div>
              <div className="text-slate-200 truncate">{ag.bubble}</div>
            </div>
          );
        })}

        {/* Top Left Phase Badge */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none flex items-center space-x-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/95 border border-cyan-500/40 text-xs font-bold text-cyan-300">
            PHASE: {meetingPhase}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/95 border border-slate-800 text-xs text-slate-300">
            {instrument.symbol} ({timeframe.toUpperCase()})
          </div>
        </div>

        {/* Collapsible Bottom Status Dock */}
        <div
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl transition-transform duration-300 ${
            isDockCollapsed ? 'translate-y-[calc(100%-28px)]' : 'translate-y-0'
          }`}
        >
          <div className="flex justify-center -mb-1">
            <button
              onClick={() => setIsDockCollapsed(!isDockCollapsed)}
              className="px-4 py-1 text-[10px] font-bold text-slate-300 bg-slate-950 border border-slate-700 rounded-t-lg hover:text-cyan-400 flex items-center space-x-1"
            >
              {isDockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{isDockCollapsed ? 'Show Agent Desk HUD' : 'Collapse Desk HUD'}</span>
            </button>
          </div>

          <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]">
            {agents.map((ag) => (
              <div key={ag.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-bold truncate" style={{ color: ag.colorHex }}>
                  {ag.name.replace(/^Agent \d+: /, '')}
                </div>
                <div className="text-slate-400 uppercase mt-0.5">
                  Status: <span className="text-white font-bold">{ag.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5 Agent Live Status & Output Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {agents.map((ag) => (
          <div key={ag.id} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-white truncate">{ag.name}</span>
              <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${ag.badgeClass}`}>
                {ag.status}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">{ag.role}</div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-200 leading-relaxed min-h-[68px]">
              {ag.output}
            </div>
          </div>
        ))}
      </div>

      {/* Meeting Room Transcript + Top 1st/2nd/3rd Scanner Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Meeting Room Dialogue */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span>MANAGER CONFERENCE ROOM TRANSCRIPT</span>
          </h3>
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 text-xs">
            {transcript.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                Click &quot;Convene 5-Agent Briefing&quot; to watch agents analyze live feeds, walk into the Manager&apos;s room, and debate the trade.
              </div>
            ) : (
              transcript.map((msg) => (
                <div key={msg.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${msg.colorClass}`}>
                      {msg.agentName} <span className="text-slate-500 font-normal">({msg.role})</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{msg.time}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{msg.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Scanner Agent Top 1st / 2nd / 3rd Ranking */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>SCANNER TOP PICKS (1ST • 2ND • 3RD)</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            {rankedTop3.length === 0 ? (
              <div className="p-6 text-center text-slate-500">Run briefing to rank Crypto, Forex &amp; Stocks.</div>
            ) : (
              rankedTop3.map((item) => (
                <div
                  key={item.symbol}
                  onClick={() => onSelectInstrument(item.symbol, item.market)}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                        {item.rank}
                      </span>
                      <span className="font-bold text-white">{item.symbol}</span>
                      <span className="text-[10px] uppercase text-slate-500">{item.market}</span>
                    </div>
                    <span className="text-cyan-400 font-bold">{item.score}/100</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {item.direction} • {item.summary}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Final Manager Signal Card */}
      {finalSignal && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-amber-400 uppercase flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4" />
            <span>MANAGER AGENT FINAL INSTITUTIONAL SIGNAL CARD</span>
          </div>
          <SignalCardComponent
            signal={finalSignal}
            onExecutePaperTrade={onExecutePaperTrade}
            onRequestGeminiDeepDive={onRequestGeminiDeepDive}
          />
        </div>
      )}
    </div>
  );
};
