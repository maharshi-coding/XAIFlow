import { useEffect, useRef, useState, type ReactNode } from 'react';
import { prefersReducedMotion } from './motion';

/**
 * Interactive 3D hero: a rotating icosahedral "network" wrapped in a drifting
 * particle shell, with subtle pointer parallax. Three.js is loaded lazily and
 * only in a real browser. If the user prefers reduced motion or WebGL is
 * unavailable, the provided 2D `fallback` is rendered instead.
 */
export function HeroScene({ fallback }: { fallback?: ReactNode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: import('three').WebGLRenderer | undefined;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let cancelled = false;
    let onPointerMove: ((event: PointerEvent) => void) | undefined;
    const disposables: { dispose: () => void }[] = [];

    void (async () => {
      const THREE = await import('three');
      if (cancelled || !mount.isConnected) return;

      const width = mount.clientWidth || 440;
      const height = mount.clientHeight || 280;

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setFailed(true);
        return;
      }
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
      camera.position.z = 5.2;

      const group = new THREE.Group();
      scene.add(group);

      const core = new THREE.IcosahedronGeometry(1.7, 1);
      disposables.push(core);

      const wireGeometry = new THREE.WireframeGeometry(core);
      const wireMaterial = new THREE.LineBasicMaterial({
        color: 0x12a594,
        transparent: true,
        opacity: 0.55,
      });
      disposables.push(wireGeometry, wireMaterial);
      group.add(new THREE.LineSegments(wireGeometry, wireMaterial));

      const nodeMaterial = new THREE.PointsMaterial({ color: 0x0b7f75, size: 0.16 });
      disposables.push(nodeMaterial);
      group.add(new THREE.Points(core, nodeMaterial));

      const shellCount = 300;
      const positions = new Float32Array(shellCount * 3);
      for (let i = 0; i < shellCount; i += 1) {
        const radius = 2.7 + Math.random() * 0.6;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
      }
      const shellGeometry = new THREE.BufferGeometry();
      shellGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const shellMaterial = new THREE.PointsMaterial({
        color: 0x7fd8c7,
        size: 0.05,
        transparent: true,
        opacity: 0.85,
      });
      disposables.push(shellGeometry, shellMaterial);
      const shell = new THREE.Points(shellGeometry, shellMaterial);
      scene.add(shell);

      let targetX = 0;
      let targetY = 0;
      onPointerMove = (event: PointerEvent) => {
        const rect = mount.getBoundingClientRect();
        targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 1.4;
        targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 1.4;
      };
      mount.addEventListener('pointermove', onPointerMove);

      const activeRenderer = renderer;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        group.rotation.y += 0.004;
        group.rotation.z += 0.0012;
        shell.rotation.y -= 0.0013;
        camera.position.x += (targetX - camera.position.x) * 0.05;
        camera.position.y += (-targetY - camera.position.y) * 0.05;
        camera.lookAt(scene.position);
        activeRenderer.render(scene, camera);
      };
      animate();

      observer = new ResizeObserver(() => {
        const w = mount.clientWidth || width;
        const h = mount.clientHeight || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        activeRenderer.setSize(w, h);
      });
      observer.observe(mount);
    })();

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      if (onPointerMove) mount.removeEventListener('pointermove', onPointerMove);
      observer?.disconnect();
      disposables.forEach((item) => item.dispose());
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [reduced]);

  if (reduced || failed) return <>{fallback}</>;
  return <div ref={mountRef} className="hero-canvas" aria-hidden="true" />;
}
