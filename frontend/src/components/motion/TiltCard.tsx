import { useRef, type PointerEvent, type ReactNode } from 'react';
import { prefersReducedMotion } from './motion';

/**
 * Parallax tilt card. The surface rotates slightly toward the pointer and a
 * light glare follows the cursor, then eases back on leave. No tilt is applied
 * under reduced motion.
 */
export function TiltCard({
  children,
  className = '',
  max = 9,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useRef(prefersReducedMotion());

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || reduced.current) return;
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    element.style.setProperty('--tilt-x', `${(-py * max).toFixed(2)}deg`);
    element.style.setProperty('--tilt-y', `${(px * max).toFixed(2)}deg`);
    element.style.setProperty('--glare-x', `${((px + 0.5) * 100).toFixed(1)}%`);
    element.style.setProperty('--glare-y', `${((py + 0.5) * 100).toFixed(1)}%`);
    element.dataset.tilting = 'true';
  };

  const reset = () => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty('--tilt-x', '0deg');
    element.style.setProperty('--tilt-y', '0deg');
    element.dataset.tilting = 'false';
  };

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      onBlur={reset}
    >
      <div className="tilt-card-inner">{children}</div>
    </div>
  );
}
