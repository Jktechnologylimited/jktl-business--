"use client";
import { Component, memo, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Object3D, type Group, type InstancedMesh } from "three";
import { InstancedBoxes } from "@/components/tycoon/three/InstancedBoxes";
import type { BoxPart } from "@/components/tycoon/three/scene-model";
import { ContextGuard } from "@/components/tycoon/three/ContextGuard";
import { RenderDriver } from "@/components/tycoon/three/RenderDriver";
import { coinAt, hazardAt, jumpHeight, type RunState } from "@/lib/runner";

type Props={read:()=>RunState;tick:(delta:number)=>RunState;phase:RunState["phase"];onFailure:()=>void;reduced:boolean};
class SceneBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed ? null : this.props.children;}
}
const ignoreStats=()=>{};
function Street({read}:{read:()=>RunState}) {
  const moving=useRef<InstancedMesh>(null);
  const object=useMemo(()=>new Object3D(),[]);
  const parts=useMemo(()=>{
    const parts:BoxPart[]=[];
    for(let i=0;i<18;i++) {
      const side=i%2 ? -1 : 1,height=2+(i%4)*.8,z=-i*9;
      parts.push({position:[side*5,height/2,z],size:[3,height,4],color:["#d6a75f","#79aeb7","#c48f9e","#95b49a"][i%4]});
      parts.push({position:[side*5,height+.1,z],size:[3.2,.2,4.2],color:"#f6e6bc"});
      for(let floor=0;floor<3;floor++) for(let window=0;window<3;window++) parts.push({position:[side*3.49,.7+floor*.65,z-1.2+window*1.2],size:[.035,.35,.5],color:"#30516b"});
      parts.push({position:[side*2.9,.45,z+2.8],size:[.12,.9,.12],color:"#776044"});
      parts.push({position:[side*2.9,1.2,z+2.8],size:[.75,1,.75],color:"#579569"});
    }
    for(let i=0;i<36;i++)parts.push({position:[i%2 ? -.66 : .66,.055,-Math.floor(i/2)*8],size:[.055,.025,2],color:"#e9deb7"});
    return parts;
  },[]);
  useFrame(()=>{
    if(!moving.current)return;
    const distance=read().distance;
    parts.forEach((part,id)=>{
      const z=((part.position[2]+distance+155)%162)-155;
      object.position.set(part.position[0],part.position[1],z);object.scale.set(...part.size);object.rotation.set(0,0,0);object.updateMatrix();moving.current!.setMatrixAt(id,object.matrix);
    });moving.current.instanceMatrix.needsUpdate=true;
  });
  return <>
    <mesh position={[0,-.14,-65]} receiveShadow><boxGeometry args={[90,.2,180]}/><meshStandardMaterial color="#a5c489"/></mesh>
    <mesh position={[0,-.02,-65]}><boxGeometry args={[4.8,.1,180]}/><meshStandardMaterial color="#536678"/></mesh>
    {[-1,1].map(side=><mesh key={side} position={[side*2.65,.015,-65]}><boxGeometry args={[.55,.16,180]}/><meshStandardMaterial color="#e0d5b7"/></mesh>)}
    <InstancedBoxes parts={parts} meshRef={moving} cull={false}/>
  </>;
}
function Course({tick}:{tick:(delta:number)=>RunState}) {
  const hazards=useRef<InstancedMesh>(null),coins=useRef<InstancedMesh>(null);
  const player=useRef<Group>(null),leftLeg=useRef<Group>(null),rightLeg=useRef<Group>(null),leftArm=useRef<Group>(null),rightArm=useRef<Group>(null);
  const object=useMemo(()=>new Object3D(),[]),coinObject=useMemo(()=>new Object3D(),[]);
  const hazardParts=useMemo<BoxPart[]>(()=>Array.from({length:8*5},(_,index)=>({position:[0,-50,0],size:[1,1,1],color:["#edb33c","#263f59","#f2e5bd","#172b40","#172b40"][index%5]})),[]);
  useFrame((_,delta)=>{
    const run=tick(delta),start=Math.max(0,Math.floor((run.distance-26)/14));
    let partIndex=0;
    const set=(x:number,y:number,z:number,size:[number,number,number])=>{
      object.position.set(x,y,z);object.scale.set(...size);object.rotation.set(0,0,0);object.updateMatrix();hazards.current!.setMatrixAt(partIndex++,object.matrix);
    };
    if(hazards.current) {
      for(let i=0;i<8;i++) {
        const hazard=hazardAt(start+i,run.seed),x=hazard.lane*1.33,z=run.distance-hazard.distance;
        if(hazard.kind==="vehicle") {
          set(x,1.05,z,[1.05,2.1,2.5]);set(x,1.7,z+1.27,[.85,.5,.025]);set(x,.32,z+1.3,[.75,.12,.05]);set(x-.38,.35,z+1,[.18,.45,.5]);set(x+.38,.35,z+1,[.18,.45,.5]);
        } else if(hazard.kind==="gate") {
          set(x,1.25,z,[1.2,.4,.22]);set(x-.5,.6,z,[.1,1.2,.12]);set(x+.5,.6,z,[.1,1.2,.12]);set(x,1.25,z+.12,[.8,.1,.04]);set(x,-20,z,[.01,.01,.01]);
        } else {
          set(x,.4,z,[1.05,.8,.4]);set(x,.45,z+.23,[.85,.1,.04]);set(x-.38,.15,z,[.15,.3,.6]);set(x+.38,.15,z,[.15,.3,.6]);set(x,.65,z+.23,[.85,.08,.04]);
        }
      }
      hazards.current.instanceMatrix.needsUpdate=true;
    }
    if(coins.current) {
      const first=Math.max(0,Math.floor((run.distance-6)/4));
      for(let i=0;i<28;i++) {
        const coin=coinAt(first+i),hidden=run.collected.includes(coin.id) || coin.distance<run.distance;
        coinObject.position.set(coin.lane*1.33,1,run.distance-coin.distance);coinObject.rotation.set(.15,run.seconds*2,0);coinObject.scale.setScalar(hidden ? 0 : 1);coinObject.updateMatrix();coins.current.setMatrixAt(i,coinObject.matrix);
      }
      coins.current.instanceMatrix.needsUpdate=true;
    }
    if(player.current) {
      player.current.position.x+=(run.lane*1.33-player.current.position.x)*Math.min(1,delta*20);
      player.current.position.y=jumpHeight(run);
      player.current.scale.y=run.slideLeft>0 ? .48 : 1;
      const stride=run.phase==="running" ? Math.sin(run.seconds*14)*.65 : 0;
      if(leftLeg.current)leftLeg.current.rotation.x=stride;if(rightLeg.current)rightLeg.current.rotation.x=-stride;
      if(leftArm.current)leftArm.current.rotation.x=-stride;if(rightArm.current)rightArm.current.rotation.x=stride;
    }
  });
  return <>
    <InstancedBoxes parts={hazardParts} meshRef={hazards} cull={false}/>
    <instancedMesh ref={coins} args={[undefined,undefined,28]} frustumCulled={false}><torusGeometry args={[.2,.065,6,10]}/><meshStandardMaterial color="#ffce58" metalness={.35} roughness={.4}/></instancedMesh>
    <group ref={player} position={[0,0,0]}>
      <mesh position={[0,.78,0]}><boxGeometry args={[.4,.48,.25]}/><meshStandardMaterial color="#f0bd50"/></mesh>
      <mesh position={[0,1.22,0]}><sphereGeometry args={[.2,8,8]}/><meshStandardMaterial color="#79503a"/></mesh>
      <mesh position={[0,1.35,.02]}><boxGeometry args={[.36,.12,.33]}/><meshStandardMaterial color="#192d45"/></mesh>
      {[[-.23,leftArm],[.23,rightArm]].map(([x,ref],id)=><group key={`arm${id}`} ref={ref as React.RefObject<Group>} position={[x as number,.93,0]}><mesh position={[0,-.18,0]}><boxGeometry args={[.12,.42,.13]}/><meshStandardMaterial color="#79503a"/></mesh></group>)}
      {[[-.12,leftLeg],[.12,rightLeg]].map(([x,ref],id)=><group key={`leg${id}`} ref={ref as React.RefObject<Group>} position={[x as number,.55,0]}><mesh position={[0,-.23,0]}><boxGeometry args={[.15,.46,.17]}/><meshStandardMaterial color="#163359"/></mesh><mesh position={[0,-.45,-.05]}><boxGeometry args={[.18,.12,.3]}/><meshStandardMaterial color="#f5eace"/></mesh></group>)}
    </group>
  </>;
}
function Scene({read,tick,phase,onFailure}:Props) {
  return <SceneBoundary onFailure={onFailure}><Canvas dpr={1} frameloop="demand" camera={{position:[0,3.8,7],fov:58,near:.1,far:130}} gl={{antialias:false,powerPreference:"low-power"}} onCreated={({camera,gl})=>{camera.lookAt(0,1,-14);gl.domElement.setAttribute('aria-label','JKTL Street Run 3D game');}}>
    <color attach="background" args={["#c9e4ec"]}/><fog attach="fog" args={["#c9e4ec",30,110]}/><ambientLight intensity={1.8}/><directionalLight position={[-5,10,6]} intensity={2} color="#fff2d4"/>
    <ContextGuard onFailure={onFailure}/><Street read={read}/><Course tick={tick}/><RenderDriver fps={30} animate={phase==="running"} onStats={ignoreStats}/>
  </Canvas></SceneBoundary>;
}
export default memo(Scene);
