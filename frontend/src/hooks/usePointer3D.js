import { useEffect, useRef } from "react";

const canAnimate = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Pointer-driven 3D. Writes CSS variables only (no React re-renders):
 *   mode "tilt"     -> --rx / --ry on the element (product cards)
 *   mode "parallax" -> --px / --py in [-1, 1] (hero layers read them)
 * Disabled on touch devices and when the user prefers reduced motion.
 * rAF-throttled, passive listeners: never blocks clicks or scrolling.
 */
export default function usePointer3D({ mode = "tilt", max = 7 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canAnimate()) return undefined;
    let frame = 0;

    const onMove = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
        const y = (e.clientY - r.top) / r.height - 0.5;
        if (mode === "tilt") {
          el.style.setProperty("--rx", `${(-y * max * 2).toFixed(2)}deg`);
          el.style.setProperty("--ry", `${(x * max * 2).toFixed(2)}deg`);
          el.classList.add("is-tilting");
        } else {
          el.style.setProperty("--px", (x * 2).toFixed(3));
          el.style.setProperty("--py", (y * 2).toFixed(3));
        }
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      el.classList.remove("is-tilting");
      ["--rx", "--ry", "--px", "--py"].forEach((p) => el.style.removeProperty(p));
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [mode, max]);

  return ref;
}
