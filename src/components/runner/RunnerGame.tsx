"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Pause } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { actRun, advanceRun, createRun, emptyRunRecord, parseRunRecord, recordRun, type RunAction, type RunState } from "@/lib/runner";
import styles from "./RunnerGame.module.css";
const Scene=dynamic(()=>import("./RunnerScene"),{ssr:false,loading:()=> <p className={styles.loading} role="status">Loading your street…</p>});
const RECORD_KEY="jktl-street-run-record-v1";
export function RunnerGame() {
  const skipFrame=useRef(true);
  const run=useRef(createRun()),runId=useRef(""),lastHud=useRef(0),root=useRef<HTMLElement>(null),gesture=useRef<{x:number;y:number}|null>(null);
  const [view,setView]=useState<RunState>(()=>createRun()),[record,setRecord]=useState(emptyRunRecord),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[reduced,setReduced]=useState(false);
  const read=useCallback(()=>run.current,[]);
  const fail=useCallback(()=>{skipFrame.current=true;run.current={...run.current,phase:run.current.phase==="running" ? "paused" : run.current.phase};setView(run.current);setError(true);},[]);
  const tick=useCallback((delta:number)=>{
    if(skipFrame.current){skipFrame.current=false;return run.current;}
    const previous=run.current,next=advanceRun(previous,delta);run.current=next;
    const now=performance.now();
    if(next.phase!==previous.phase || now-lastHud.current>150){lastHud.current=now;setView(next);}
    return next;
  },[]);
  const action=useCallback((action:RunAction)=>{run.current=actRun(run.current,action);setView(run.current);},[]);
  const pause=useCallback(()=>{
    if(run.current.phase==="running"){skipFrame.current=true;run.current={...run.current,phase:"paused"};setView(run.current);}
  },[]);
  useEffect(()=>{
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduced(motion.matches);
    const frame=requestAnimationFrame(()=>{
      sync();
      try{setRecord(parseRunRecord(JSON.parse(localStorage.getItem(RECORD_KEY)||"null")));}catch{}
    });
    motion.addEventListener('change',sync);
    const hidden=()=>{if(document.hidden)pause();};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',pause);
    const keys=(event:KeyboardEvent)=>{
      if(event.target instanceof Element && event.target.closest('input,select,textarea,a'))return;
      if((event.code==="Escape" || event.code==="KeyP") && run.current.phase==="running"){event.preventDefault();pause();return;}
      if(run.current.phase!=="running")return;
      const control:Record<string,RunAction>={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",ArrowUp:"jump",KeyW:"jump",Space:"jump",ArrowDown:"slide",KeyS:"slide"};
      if(control[event.code]){event.preventDefault();if(!event.repeat)action(control[event.code]);}
    };
    window.addEventListener('keydown',keys);
    return()=>{cancelAnimationFrame(frame);motion.removeEventListener('change',sync);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',pause);window.removeEventListener('keydown',keys);};
  },[action,pause]);
  useEffect(()=>{
    if(view.phase!=="over")return;
    try{
      const existing=parseRunRecord(JSON.parse(localStorage.getItem(RECORD_KEY)||"null"));
      const next=recordRun(existing,view,runId.current);localStorage.setItem(RECORD_KEY,JSON.stringify(next));
      const frame=requestAnimationFrame(()=>setRecord(next));return()=>cancelAnimationFrame(frame);
    }catch{
      const frame=requestAnimationFrame(()=>setRecord(current=>recordRun(current,view,runId.current)));return()=>cancelAnimationFrame(frame);
    }
  },[view]);
  function start(){
    skipFrame.current=true;
    const seed=crypto.getRandomValues(new Uint32Array(1))[0];runId.current=crypto.randomUUID?.() || `${seed}-${Date.now()}`;
    run.current={...createRun(seed),phase:"running"};setView(run.current);root.current?.focus();
  }
  function resume(){skipFrame.current=true;run.current={...run.current,phase:"running"};setView(run.current);root.current?.focus();}
  return <main ref={root} tabIndex={-1} className={styles.game} data-runner data-phase={view.phase} data-lane={view.lane} data-jumping={view.jumpAge!==null} data-sliding={view.slideLeft>0}
    onPointerDown={event=>{if(event.target instanceof HTMLCanvasElement)gesture.current={x:event.clientX,y:event.clientY};}}
    onPointerUp={event=>{const start=gesture.current;gesture.current=null;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;action(Math.abs(dx)>Math.abs(dy) ? dx>0?"right":"left" : dy<0?"jump":"slide");}} onPointerCancel={()=>{gesture.current=null;}}>
    <header className={styles.header}><Link href="/play/tycoon"><Image src="/jktl-logo.png" width={32} height={32} alt="" priority/><b>JKTL</b><span>STREET RUN</span></Link><nav><Link href="/play/tycoon">3D Tycoon ↗</Link><Link href="https://jktl.com.ng/games">Games</Link></nav></header>
    <section className={styles.scoreboard} aria-label="Run score"><div><small>POINTS</small><strong data-run-score>{view.score.toLocaleString()}</strong></div><div><small>COINS</small><strong>{view.coins}</strong></div><div><small>DISTANCE</small><strong>{Math.floor(view.distance)} m</strong></div><div><small>PERSONAL BEST</small><strong>{record.best.toLocaleString()}</strong></div></section>
    <div className={styles.scene}>{!error && <Scene key={attempt} read={read} tick={tick} phase={view.phase} onFailure={fail} reduced={reduced}/>}</div>
    {view.phase==="running" && <button className={styles.pause} onClick={pause} aria-label="Pause run"><Pause size={20} aria-hidden="true"/></button>}
    {(error || view.phase!=="running") && <section className={styles.overlay} aria-label="Run menu">
      <p className={styles.eyebrow}>JKTL STREET RUN · NIGERIA</p>
      <h1>{error ? "Let’s get you running." : view.phase==="over" ? "One more run?" : view.phase==="paused" ? "Take a breather." : "Your street. Your next high score."}</h1>
      {error ? <><p>This 3D game needs WebGL. Enable graphics acceleration or try an up-to-date browser, then retry.</p><button onClick={()=>{setError(false);setAttempt(value=>value+1);}}>Retry 3D</button></> : view.phase==="paused" ? <><p>Your run is paused. Resume when you’re ready.</p><button onClick={resume}>Resume run</button></> : <>
        <p>{view.phase==="over" ? `You earned ${view.score.toLocaleString()} points with ${view.coins} coins over ${Math.floor(view.distance)} metres.` : "Collect gold coins, jump road barriers, slide under signs and dodge vehicles. How far can you go?"}</p>
        <div className={styles.rules}><span>Distance = 5 points / m</span><span>Gold coin = 50 points</span></div>
        <button onClick={start}>{view.phase==="over" ? "Run again" : "Start running"}</button>
        {view.phase==="over" && <p>Best: {record.best.toLocaleString()} · Total game points: {record.total.toLocaleString()}</p>}
      </>}
      <p className={styles.note}>Game points only. Best scores are saved on this device.</p>
      {reduced && <p className={styles.note}>Reduced motion: decorative effects are minimized. Running starts only when you choose Start.</p>}
    </section>}
    {view.phase==="running" && <div className={styles.controls} aria-label="Running controls">
      <button aria-label="Move left" onClick={()=>action("left")}>←<small>LEFT</small></button><button aria-label="Jump" onClick={()=>action("jump")}>↑<small>JUMP</small></button><button aria-label="Slide" onClick={()=>action("slide")}>↓<small>SLIDE</small></button><button aria-label="Move right" onClick={()=>action("right")}>→<small>RIGHT</small></button>
    </div>}
    <footer className={styles.footer}>Arrows / WASD · Space to jump · P to pause · Swipe or use the touch buttons</footer>
  </main>;
}
