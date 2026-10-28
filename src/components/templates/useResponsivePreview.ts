"use client";
import { useEffect, useRef, useState } from "react";

/** CSS handles first paint; matchMedia only resets a desktop choice when the
 * viewport crosses md. Watching the document also handles cached iframe loads
 * that complete before React hydrates and attaches event handlers. */
export function useResponsivePreview(
  onDocumentReady?: (doc: Document) => void,
) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const media = window.matchMedia("(min-width: 768px)");
    const reset = () => setDevice("desktop");
    let observer: ResizeObserver | undefined;
    let animation: number | undefined;
    const inspect = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      observer?.disconnect();
      onDocumentReady?.(doc);
      const body = doc.body;
      const measure = () => {
        if (animation !== undefined) cancelAnimationFrame(animation);
        animation = requestAnimationFrame(() => {
          const height = Math.ceil(
            Math.max(body.getBoundingClientRect().height, body.scrollHeight),
          );
          if (height > 0)
            frame.style.setProperty("--preview-height", `${height}px`);
        });
      };
      observer = new ResizeObserver(measure);
      observer.observe(body);
      measure();
    };
    media.addEventListener("change", reset);
    frame.addEventListener("load", inspect);
    if (frame.contentDocument?.readyState === "complete") inspect();
    return () => {
      media.removeEventListener("change", reset);
      frame.removeEventListener("load", inspect);
      observer?.disconnect();
      if (animation !== undefined) cancelAnimationFrame(animation);
    };
  }, [onDocumentReady]);
  return { device, setDevice, frameRef };
}
