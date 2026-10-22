/**
 * Shared motion primitives. Animation is strictly progressive enhancement:
 * every helper degrades to a no-op when the browser requests reduced motion
 * or when `matchMedia` is unavailable (jsdom under test), so the UI and its
 * automated tests behave identically with or without GSAP running.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

/** Register ScrollTrigger exactly once, only in a real browser. */
export function ensureScrollTrigger(): typeof ScrollTrigger {
  if (!registered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return ScrollTrigger;
}

/** True when animations should be skipped (reduced-motion preference or no matchMedia). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export { gsap, ScrollTrigger };
