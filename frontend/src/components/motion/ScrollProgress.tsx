import { useEffect, useRef } from 'react';

/**
 * Thin reading-progress bar pinned to the top of the workspace. Tracks window
 * scroll with a rAF-throttled listener; harmless (width 0) without layout.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return (
    <div className="scroll-progress" aria-hidden="true">
      <span ref={barRef} />
    </div>
  );
}
