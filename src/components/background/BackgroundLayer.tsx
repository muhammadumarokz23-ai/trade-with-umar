import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTheme } from '../../context/ThemeContext';

type ImageFormat = 'webp' | 'jpg';

function detectWebpSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      return canvas.toDataURL('image/webp').startsWith('data:image/webp');
    }
  } catch {
    // Ignore canvas error
  }
  return false;
}

function getBgPath(variant: 'dark' | 'light', isMobile: boolean, format: ImageFormat): string {
  const prefix = isMobile ? 'mobile-' : '';
  return `/bg/${prefix}${variant}.${format}`;
}

export const BackgroundLayer: React.FC = () => {
  const { theme, backgroundMode } = useTheme();

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const [webpSupported] = useState<boolean>(() =>
    typeof document !== 'undefined' ? detectWebpSupport() : false
  );

  const [darkLoaded, setDarkLoaded] = useState(false);
  const [lightLoaded, setLightLoaded] = useState(false);
  const [darkFallbackJpg, setDarkFallbackJpg] = useState(false);
  const [lightFallbackJpg, setLightFallbackJpg] = useState(false);

  const parallaxWrapperRef = useRef<HTMLDivElement>(null);
  const threeMountRef = useRef<HTMLDivElement>(null);

  // Track <768px mobile breakpoint & prefers-reduced-motion dynamically
  useEffect(() => {
    const mobileMq = window.matchMedia('(max-width: 767px)');
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const onMobileChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const onMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);

    setIsMobile(mobileMq.matches);
    setPrefersReducedMotion(motionMq.matches);

    mobileMq.addEventListener('change', onMobileChange);
    motionMq.addEventListener('change', onMotionChange);
    return () => {
      mobileMq.removeEventListener('change', onMobileChange);
      motionMq.removeEventListener('change', onMotionChange);
    };
  }, []);

  const darkSrc = useMemo(
    () => getBgPath('dark', isMobile, webpSupported && !darkFallbackJpg ? 'webp' : 'jpg'),
    [isMobile, webpSupported, darkFallbackJpg]
  );

  const lightSrc = useMemo(
    () => getBgPath('light', isMobile, webpSupported && !lightFallbackJpg ? 'webp' : 'jpg'),
    [isMobile, webpSupported, lightFallbackJpg]
  );

  // Active image eager load + lazy preload of inactive theme image with JPG fallback
  useEffect(() => {
    if (backgroundMode !== 'picture') return;

    let cancelled = false;
    const loadImage = (
      variant: 'dark' | 'light',
      src: string,
      onDone: () => void,
      onWebpFail: () => void
    ) => {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) onDone();
      };
      img.onerror = () => {
        if (cancelled) return;
        if (src.endsWith('.webp')) {
          onWebpFail();
        }
      };
      img.src = src;
    };

    if (theme === 'dark') {
      loadImage('dark', darkSrc, () => setDarkLoaded(true), () => setDarkFallbackJpg(true));
      const idleTimer = window.setTimeout(() => {
        loadImage('light', lightSrc, () => setLightLoaded(true), () => setLightFallbackJpg(true));
      }, 900);
      return () => {
        cancelled = true;
        clearTimeout(idleTimer);
      };
    } else {
      loadImage('light', lightSrc, () => setLightLoaded(true), () => setLightFallbackJpg(true));
      const idleTimer = window.setTimeout(() => {
        loadImage('dark', darkSrc, () => setDarkLoaded(true), () => setDarkFallbackJpg(true));
      }, 900);
      return () => {
        cancelled = true;
        clearTimeout(idleTimer);
      };
    }
  }, [theme, backgroundMode, darkSrc, lightSrc]);

  // Subtle Desktop Mouse Parallax (disabled on mobile & prefers-reduced-motion)
  useEffect(() => {
    const el = parallaxWrapperRef.current;
    if (!el) return;

    if (backgroundMode !== 'picture' || isMobile || prefersReducedMotion) {
      el.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = 0;

    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      targetX = -nx * 14;
      targetY = -ny * 10;
    };

    const step = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      el.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0px) scale(1.045)`;
      rafId = requestAnimationFrame(step);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafId = requestAnimationFrame(step);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId);
      el.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
    };
  }, [backgroundMode, isMobile, prefersReducedMotion]);

  // Optional 3D Animated Background Mode
  useEffect(() => {
    if (backgroundMode !== 'animated3d') return;
    const container = threeMountRef.current;
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

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 9);
    camera.lookAt(0, 0, -4);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(
      44,
      44,
      theme === 'dark' ? 0x00d2ff : 0x2563eb,
      theme === 'dark' ? 0x1e293b : 0x94a3b8
    );
    grid.position.y = -1.2;
    scene.add(grid);

    // Instanced holographic data pillars (>20 instances)
    const count = 32;
    const boxGeo = new THREE.BoxGeometry(0.18, 1, 0.18);
    const boxMat = new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x8b5cf6 : 0x3b82f6,
      transparent: true,
      opacity: 0.45,
    });
    const pillars = new THREE.InstancedMesh(boxGeo, boxMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const col = (i % 8) - 3.5;
      const row = Math.floor(i / 8);
      dummy.position.set(col * 3.2, -0.4, -row * 4.5 - 2);
      dummy.scale.set(1, 0.8 + (i % 4) * 0.6, 1);
      dummy.updateMatrix();
      pillars.setMatrixAt(i, dummy.matrix);
    }
    pillars.instanceMatrix.needsUpdate = true;
    pillars.frustumCulled = false;
    scene.add(pillars);

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
      if (!prefersReducedMotion) {
        grid.position.z = (elapsed * 0.7) % 1;
        pillars.rotation.y = Math.sin(elapsed * 0.12) * 0.08;
      }
      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (isSoftwareGl) clearTimeout(frameId);
      else cancelAnimationFrame(frameId);
      boxGeo.dispose();
      boxMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [backgroundMode, theme, prefersReducedMotion]);

  const solidFallbackColor = theme === 'dark' ? '#060913' : '#e2e8f0';
  const overlayColor =
    theme === 'dark' ? 'rgba(7, 9, 24, 0.55)' : 'rgba(255, 255, 255, 0.45)';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
        backgroundColor: solidFallbackColor,
        transition: 'background-color 0.6s ease-in-out',
      }}
    >
      {backgroundMode === 'picture' && (
        <div
          ref={parallaxWrapperRef}
          style={{
            position: 'absolute',
            inset: 0,
            willChange: prefersReducedMotion || isMobile ? 'auto' : 'transform',
          }}
        >
          {/* Dark Theme Picture Layer */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${darkSrc})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: theme === 'dark' ? (darkLoaded ? 1 : 0.01) : 0,
              transition: 'opacity 0.6s ease-in-out',
            }}
          />

          {/* Light Theme Picture Layer */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${lightSrc})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: theme === 'light' ? (lightLoaded ? 1 : 0.01) : 0,
              transition: 'opacity 0.6s ease-in-out',
            }}
          />

          {/* Readability Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: overlayColor,
              transition: 'background-color 0.6s ease-in-out',
            }}
          />
        </div>
      )}

      {backgroundMode === 'animated3d' && (
        <>
          <div
            ref={threeMountRef}
            style={{ position: 'absolute', inset: 0 }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor:
                theme === 'dark' ? 'rgba(7, 9, 24, 0.35)' : 'rgba(255, 255, 255, 0.35)',
              transition: 'background-color 0.6s ease-in-out',
            }}
          />
        </>
      )}
    </div>
  );
};
