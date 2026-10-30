"use client";
import { Component, memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { TycoonState } from "@/lib/tycoon";
import type { Ride } from "./scene-model";
import { landPlots } from "../world/isometric";
import { useConstruction } from "../world/useWorldMotion";
import { buildingParts, profiles, roadParts, selectionParts, terrainParts, TREE_POINTS, type Quality } from "./scene-model";
import { InstancedBoxes } from "./InstancedBoxes";
import { ContextGuard } from "./ContextGuard";
import { ShadowCache } from "./ShadowCache";
import { CameraRig } from "./CameraRig";
import { MovingActors } from "./MovingActors";
import { GroundShadows, Trees } from "./WorldDetails";
import { RenderDriver, type RenderStats } from "./RenderDriver";
import styles from "./Prototype.module.css";

type Props={state:TycoonState;selected:number;onSlot:(id:number)=>void;night:boolean;paused:boolean;ride:Ride;ready:boolean;zoom:number;onFailure:()=>void};
class RendererBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed ? <p role="status">3D is unavailable. Please retry with graphics acceleration enabled.</p> : this.props.children;}
}
const StaticGround=memo(function StaticGround(){
  const terrain=useMemo(()=>terrainParts(),[]),roads=useMemo(()=>roadParts(),[]);
  return <><InstancedBoxes parts={terrain}/><InstancedBoxes parts={roads}/></>;
});
export default function Neighbourhood3D({state,selected,onSlot,night,paused,ride,ready,zoom,onFailure}:Props) {
  const [quality,setQuality]=useState<Quality>("low");
  const [reduced,setReduced]=useState(false);
  const [hover,setHover]=useState<number|null>(null);
  const [stats,setStats]=useState<RenderStats|null>(null);
  useEffect(()=>{
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduced(motion.matches);
    const frame=requestAnimationFrame(sync);
    motion.addEventListener('change',sync);
    return()=>{cancelAnimationFrame(frame);motion.removeEventListener('change',sync);};
  },[]);
  const profile=profiles[quality], stages=useConstruction(state.plots,ready);
  const construction=useMemo(()=>new Set(Object.entries(stages).filter(([,stage])=>stage==='building').map(([id])=>Number(id))),[stages]);
  const buildings=useMemo(()=>buildingParts(state,construction,night),[state,construction,night]);
  const plots=useMemo(()=>landPlots(state),[state]);
  const active=plots.find(plot=>plot.id===(hover ?? selected));
  const outline=useMemo(()=>active ? selectionParts(active.row,active.col) : [],[active]);
  const shadows=useMemo<[number,number][]>(()=>[...TREE_POINTS.map(([row,col]):[number,number]=>[row,col]),...plots.filter(p=>p.status==='active').map((p):[number,number]=>[p.row,p.col])],[plots]);
  const report=useCallback((value:RenderStats)=>setStats(value),[]);
  const animate=!paused && !reduced;
  return <RendererBoundary onFailure={onFailure}>
    <div className={styles.scene} data-renderer="three" data-quality={quality} data-animated={animate}>
      <Canvas key={quality} orthographic camera={{position:[19,21,19],zoom:43*zoom,near:.1,far:120}}
        dpr={profile.dpr} shadows={profile.shadows ? "basic" : false} frameloop="demand"
        gl={{antialias:false,alpha:false,powerPreference:'low-power'}}
        fallback={<p>WebGL is required for the 3D game.</p>}
        onCreated={({gl,camera})=>{
          camera.lookAt(0,0,0);
          gl.domElement.setAttribute('aria-label','Interactive 3D business neighbourhood');
        }}>
        <color attach="background" args={[night ? '#162b43' : '#a8d9e7']}/>
        <ambientLight intensity={night ? .9 : 1.4}/>
        <directionalLight position={[-7,16,9]} intensity={night ? .8 : 2.2} color={night ? '#adcaff' : '#fff2d2'} castShadow={profile.shadows}
          shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-.001}/>
        <ContextGuard onFailure={onFailure}/>
        <CameraRig zoom={zoom}/>
        <ShadowCache revision={buildings}/>
        <StaticGround/>
        <GroundShadows points={shadows}/>
        <Trees shadows={profile.shadows}/>
        <InstancedBoxes parts={buildings} shadows={profile.shadows} onSelect={onSlot} onHover={setHover}/>
        <InstancedBoxes parts={outline}/>
        <MovingActors quality={quality} paused={!animate} ride={ride} built={state.plots.filter(Boolean).length}/>
        <OrbitControls makeDefault enableDamping={false} enableRotate={false} minZoom={10} maxZoom={90} minPolarAngle={Math.PI/5} maxPolarAngle={Math.PI/3}/>
        <RenderDriver fps={profile.fps} animate={animate} onStats={report}/>
      </Canvas>
      <section className={styles.metrics} aria-label="3D game performance">
        <label>3D quality <select aria-label="3D quality" value={quality} onChange={event=>setQuality(event.target.value as Quality)}><option value="low">Mobile · 30 FPS target</option><option value="high">Desktop · 60 FPS target</option></select></label>
        <output data-three-stats data-fps={stats?.fps ?? ''} data-calls={stats?.calls ?? ''} data-triangles={stats?.triangles ?? ''} data-geometries={stats?.geometries ?? ''} data-textures={stats?.textures ?? ''} data-dpr={stats?.dpr ?? ''}>
          {animate ? stats ? `${stats.fps} FPS · ${stats.calls} draws · ${stats.triangles.toLocaleString()} triangles` : 'Measuring rendered frames…' : 'Motion paused · demand rendering'}
        </output>
        <small>Drag to pan, pinch or scroll to zoom. Existing buildings and saves are shared.</small>
      </section>
      <div className={styles.accessiblePlots} aria-label="3D city plot controls">
        {plots.map(plot=><button key={plot.id} onClick={()=>onSlot(plot.id)} onFocus={()=>setHover(plot.id)} onBlur={()=>setHover(null)}>Plot {plot.id+1}: {plot.buildingType || 'empty'}</button>)}
      </div>
    </div>
  </RendererBoundary>;
}
