"use client";
import { memo, useLayoutEffect, useRef, type RefObject } from "react";
import { Color, Object3D, type InstancedMesh } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { BoxPart } from "./scene-model";
type Props = { parts: BoxPart[]; cull?: boolean; shadows?: boolean; meshRef?: RefObject<InstancedMesh | null>; onSelect?: (id:number)=>void; onHover?: (id:number|null)=>void };
export const InstancedBoxes = memo(function InstancedBoxes({parts,cull=true,shadows=false,meshRef,onSelect,onHover}:Props) {
  const ownRef=useRef<InstancedMesh>(null);
  const ref=meshRef || ownRef;
  useLayoutEffect(()=>{
    const mesh=ref.current;
    if(!mesh) return;
    const object=new Object3D(), color=new Color();
    parts.forEach((part,id)=>{
      object.position.set(...part.position);
      object.scale.set(...part.size);
      object.rotation.set(0,part.rotation || 0,0);
      object.updateMatrix();
      mesh.setMatrixAt(id,object.matrix);
      mesh.setColorAt(id,color.set(part.color));
    });
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
  },[parts,ref]);
  function plotId(event:ThreeEvent<PointerEvent | MouseEvent>) {
    return event.instanceId===undefined ? undefined : parts[event.instanceId]?.plotId;
  }
  return <instancedMesh frustumCulled={cull} ref={ref} args={[undefined,undefined,parts.length]} castShadow={shadows} receiveShadow
    onClick={onSelect ? event=>{const id=plotId(event);if(id!==undefined){event.stopPropagation();onSelect(id);}} : undefined}
    onPointerMove={onHover ? event=>{const id=plotId(event);if(id!==undefined){event.stopPropagation();onHover(id);}} : undefined}
    onPointerOut={onHover ? ()=>onHover(null) : undefined}>
    <boxGeometry args={[1,1,1]}/>
    <meshStandardMaterial roughness={.92}/>
  </instancedMesh>;
});
