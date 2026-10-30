"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D, type InstancedMesh } from "three";
import { InstancedBoxes } from "./InstancedBoxes";
import { profiles, worldPoint, type BoxPart, type Quality } from "./scene-model";
import type { Ride } from "../CitySprites";
export function MovingActors({quality,paused,ride,built}:{quality:Quality;paused:boolean;ride:Ride;built:number}) {
  const mesh=useRef<InstancedMesh>(null), time=useRef(0);
  const object=useMemo(()=>new Object3D(),[]);
  const {cars,people:limit}=profiles[quality];
  const people=Math.min(limit,built*2+2);
  const parts=useMemo<BoxPart[]>(()=>{
    const result:BoxPart[]=[];
    for(let id=0;id<cars;id++) {
      result.push({position:[0,0,0],size:[.62,.19,.29],color:["#263247","#e9b94d","#b8c7cc","#e3e6d8"][id%4]});
      result.push({position:[0,0,0],size:[.28,.14,.23],color:"#314d66"});
      for(let wheel=0;wheel<4;wheel++) result.push({position:[0,0,0],size:[.13,.12,.06],color:"#1d2935"});
    }
    for(let id=0;id<people;id++) {
      result.push({position:[0,0,0],size:[.11,.2,.08],color:["#e7ba56","#63a5b5","#d08799"][id%3]});
      result.push({position:[0,0,0],size:[.085,.085,.085],color:["#79533d","#b98159","#4c362d"][id%3]});
      for(let leg=0;leg<2;leg++) result.push({position:[0,0,0],size:[.035,.13,.04],color:"#283f57"});
    }
    return result;
  },[cars,people]);
  useFrame((_,delta)=>{
    if(paused || !mesh.current) return;
    time.current+=Math.min(delta,.1);
    let index=0;
    const set=(x:number,y:number,z:number,sx:number,sy:number,sz:number,rotation=0)=>{
      object.position.set(x,y,z);object.scale.set(sx,sy,sz);object.rotation.set(0,rotation,0);object.updateMatrix();mesh.current!.setMatrixAt(index++,object.matrix);
    };
    for(let id=0;id<cars;id++) {
      const t=((time.current/(18+id*2)+id/cars)%1);
      const row=.5+(id%3)*3, col=-.5+t*14;
      const [x,,z]=worldPoint(row,col);
      const suv=id===0 && ride==="gwagon", truck=id===0 && ride==="cybertruck";
      set(x,.23,z,suv ? .57 : truck ? .78 : .7,suv ? .27 : .16,.29);
      set(x-.04,.39,z,suv ? .36 : .28,suv ? .2 : .12,.24);
      for(let wheel=0;wheel<4;wheel++) set(x+(wheel<2?-.2:.2),.14,z+(wheel%2?-.17:.17),.13,.12,.06);
    }
    for(let id=0;id<people;id++) {
      const phase=time.current/(13+id)+id/people;
      const t=1-Math.abs(1-(phase%2));
      const [x,,z]=worldPoint(1.1+(id%3)*3,-.3+t*13.6);
      set(x,.28,z,.11,.2,.08);set(x,.43,z,.085,.085,.085);
      for(let leg=0;leg<2;leg++) set(x+(leg?-.03:.03),.11,z+Math.sin(time.current*8+leg*Math.PI)*.035,.035,.13,.04);
    }
    mesh.current.instanceMatrix.needsUpdate=true;
    // Actors traverse the entire board; initial placeholder bounds cannot cull them.
  });
  return <InstancedBoxes parts={parts} meshRef={mesh} cull={false}/>;
}
