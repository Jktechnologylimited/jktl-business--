"use client";
import { useLayoutEffect, useRef } from "react";
import { Color, Object3D, type InstancedMesh } from "three";
import { TREE_POINTS, worldPoint } from "./scene-model";
export function Trees({shadows}:{shadows:boolean}) {
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{
    const object=new Object3D(), color=new Color();
    TREE_POINTS.forEach(([row,col],id)=>{
      const [x,,z]=worldPoint(row,col);
      object.position.set(x,.75,z);object.scale.set(.48,.62,.48);object.updateMatrix();
      ref.current!.setMatrixAt(id,object.matrix);
      ref.current!.setColorAt(id,color.set(["#4d8a63","#649c6c","#73a777"][id%3]));
    });
    ref.current!.instanceMatrix.needsUpdate=true;
    if(ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate=true;
    ref.current!.computeBoundingSphere();
  },[]);
  return <instancedMesh ref={ref} args={[undefined,undefined,TREE_POINTS.length]} castShadow={shadows} receiveShadow>
    <icosahedronGeometry args={[1,0]}/><meshStandardMaterial roughness={1}/>
  </instancedMesh>;
}
/** Cheap contact-shadow approximations remain available when mobile real shadows are off. */
export function GroundShadows({points}:{points:[number,number][]}) {
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{
    const object=new Object3D();
    points.forEach(([row,col],id)=>{
      const [x,,z]=worldPoint(row,col);
      object.position.set(x+.2,.081,z+.2);object.rotation.set(-Math.PI/2,0,0);object.scale.set(.85,.7,1);object.updateMatrix();ref.current!.setMatrixAt(id,object.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate=true;ref.current!.computeBoundingSphere();
  },[points]);
  return <instancedMesh ref={ref} args={[undefined,undefined,points.length]} raycast={()=>{}}>
    <circleGeometry args={[1,16]}/><meshBasicMaterial color="#263d39" transparent opacity={.13} depthWrite={false}/>
  </instancedMesh>;
}
