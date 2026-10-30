"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
export type RenderStats = { fps:number; calls:number; triangles:number; geometries:number; textures:number; dpr:number };
export function RenderDriver({fps,animate,onStats}:{fps:number;animate:boolean;onStats:(stats:RenderStats)=>void}) {
  const invalidate=useThree(state=>state.invalidate);
  const sample=useRef({start:0,frames:0});
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout> | undefined;
    const stop=()=>{if(timer) clearTimeout(timer);};
    const tick=()=>{
      if(document.hidden || !animate) return;
      invalidate();
      timer=setTimeout(tick,1000/fps);
    };
    const visibility=()=>{stop();if(!document.hidden && animate) tick();};
    visibility();
    document.addEventListener('visibilitychange',visibility);
    return ()=>{stop();document.removeEventListener('visibilitychange',visibility);};
  },[fps,animate,invalidate]);
  useEffect(()=>{const timer=setTimeout(()=>{if(!animate)onStats({fps:0,calls:0,triangles:0,geometries:0,textures:0,dpr:0});},1100);return()=>clearTimeout(timer);},[animate,onStats]);
  useFrame(({gl})=>{
    const now=performance.now();
    if(!sample.current.start || now-sample.current.start>3000) sample.current={start:now,frames:0};
    sample.current.frames++;
    const elapsed=now-sample.current.start;
    if(elapsed>=1000) {
      onStats({fps:Math.round(sample.current.frames*10000/elapsed)/10,calls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,dpr:gl.getPixelRatio()});
      sample.current={start:now,frames:0};
    }
  });
  return null;
}
