"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { TycoonState } from "@/lib/tycoon";
import type { Ride } from "./three/scene-model";
import styles from "./CityScene.module.css";
const Neighbourhood3D = dynamic(() => import("./three/Neighbourhood3D"), {
  ssr: false,
  loading: () => <p className={styles.fallback} role="status">Loading your 3D neighbourhood…</p>,
});
export function CityScene({state,slot,onSlot,ready=true}:{state:TycoonState;slot:number;onSlot:(slot:number)=>void;ready?:boolean}) {
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const [paused,setPaused]=useState(false),[night,setNight]=useState(false),[zoom,setZoom]=useState(1);
  const [ride,setRide]=useState<Ride>("gwagon");
  const fail=useCallback(()=>setFailed(true),[]);
  return <div className={`${styles.scene} ${night ? styles.night : ""}`}>
    <div className={styles.toolbar}><div>
      <Link className={styles.runLink} href="/play/run">Run & earn points ↗</Link>
      <button onClick={()=>setNight(!night)} aria-pressed={night}>{night ? "☀ Day" : "☾ Night"}</button>
      <button onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused ? "▶ Resume" : "Ⅱ Pause"}</button>
      <button aria-label="Zoom out city" disabled={zoom<=1} onClick={()=>setZoom(Math.max(1,zoom-.25))}>−</button>
      <button aria-label="Zoom in city" disabled={zoom>=1.75} onClick={()=>setZoom(Math.min(1.75,zoom+.25))}>+</button>
    </div></div>
    {failed ? <section className={styles.webglError} role="status"><h2>Let’s get your 3D city running.</h2><p>This game needs WebGL. Try enabling graphics acceleration or opening it in an up-to-date browser. Your saved business progress is unchanged.</p><button onClick={()=>{setFailed(false);setAttempt(value=>value+1);}}>Retry 3D</button></section> : <Neighbourhood3D key={attempt} state={state} selected={slot} onSlot={onSlot} night={night} paused={paused} ride={ride} ready={ready} zoom={zoom} onFailure={fail}/>}
    <div className={styles.legend}><label>Featured ride<select aria-label="Featured luxury car" value={ride} onChange={event=>setRide(event.target.value as Ride)}><option value="gwagon">G-Wagon style SUV</option><option value="lamborghini">Lamborghini style supercar</option><option value="cybertruck">Cybertruck style pickup</option></select></label></div>
  </div>;
}
