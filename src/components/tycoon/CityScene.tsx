"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TycoonState } from "@/lib/tycoon";
import type { Ride } from "./CitySprites";
import { IsometricWorld } from "./world/IsometricWorld";
import { landPlots, WORLD } from "./world/isometric";
import styles from "./CityScene.module.css";

const Neighbourhood3D = dynamic(() => import("./three/Neighbourhood3D"), {
  ssr: false,
  loading: () => <p role="status">Loading 3D neighbourhood…</p>,
});

export function CityScene({ state, slot, onSlot, ready = true }: {
  state: TycoonState; slot: number; onSlot: (slot: number) => void; ready?: boolean;
}) {
  const [three, setThree] = useState(false);
  const [fallback, setFallback] = useState(false);
  const failed = useCallback(() => { setThree(false); setFallback(true); }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setThree(new URLSearchParams(location.search).get("renderer") === "3d"));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [paused, setPaused] = useState(false);
  const [night, setNight] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [ride, setRide] = useState<Ride>("gwagon");
  const [width, setWidth] = useState(1200);
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    const frame = requestAnimationFrame(() => { element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2; });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [three]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => canvas.current?.querySelectorAll("svg").forEach(svg => {
      if (paused || media.matches) svg.pauseAnimations(); else svg.unpauseAnimations();
    });
    sync();
    // New pedestrians can appear after a build without changing pause controls.
    const observer = new MutationObserver(sync);
    if (canvas.current) observer.observe(canvas.current, {childList:true, subtree:true});
    media.addEventListener("change", sync);
    return () => { observer.disconnect(); media.removeEventListener("change", sync); };
  }, [paused, three]);
  const scale = Math.max(900, width) / WORLD.width * zoom;
  function onTileClick(row: number, col: number) {
    const plot = landPlots(state).find(plot => plot.row === row && plot.col === col);
    if (plot) onSlot(plot.id);
  }
  return <div className={`${styles.scene} ${night ? styles.night : ""}`}>
    <div className={styles.toolbar}>
      <div>
        <button aria-pressed={three} onClick={() => {setThree(!three);setFallback(false);}}>{three ? "Use 2D" : "Try 3D"}</button>
        <button onClick={() => setNight(!night)} aria-pressed={night}>{night ? "☀ Day" : "☾ Night"}</button>
        <button onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? "▶ Resume" : "Ⅱ Pause"}</button>
        <button aria-label="Zoom out city" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - .25))}>−</button>
        <button aria-label="Zoom in city" disabled={zoom >= 1.75} onClick={() => setZoom(Math.min(1.75, zoom + .25))}>+</button>
      </div>
    </div>
    {three ? <Neighbourhood3D state={state} selected={slot} onSlot={onSlot} night={night} paused={paused} ride={ride} ready={ready} zoom={zoom} onFailure={failed}/> : <div ref={viewport} className={styles.viewport} tabIndex={0} aria-label="Isometric Nigerian business city. Scroll to explore; select a plot to build or upgrade.">
      <div className={styles.scaledBounds} style={{width: WORLD.width * scale, height: WORLD.height * scale}}>
        <div ref={canvas} className={styles.canvas} style={{transform: `scale(${scale})`}}>
          <IsometricWorld ready={ready} state={state} selected={slot} onTileClick={onTileClick} night={night} paused={paused} ride={ride}/>
        </div>
      </div>
    </div>
    }
    {fallback && <p className={styles.fallback} role="status">3D is unavailable on this device. The standard city is ready to play.</p>}
    <div className={styles.legend}>
      <label>Featured ride<select aria-label="Featured luxury car" value={ride} onChange={e => setRide(e.target.value as Ride)}>
        <option value="gwagon">G-Wagon style SUV</option><option value="lamborghini">Lamborghini style supercar</option><option value="cybertruck">Cybertruck style pickup</option>
      </select></label>
    </div>
  </div>;
}
