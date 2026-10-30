"use client";
import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { OrthographicCamera } from "three";
export function CameraRig({zoom}:{zoom:number}) {
  const camera=useThree(state=>state.camera);
  const size=useThree(state=>state.size);
  const invalidate=useThree(state=>state.invalidate);
  useLayoutEffect(()=>{
    if(camera instanceof OrthographicCamera) {
      // Three cameras are mutable renderer objects; projection updates are imperative.
      // eslint-disable-next-line react-hooks/immutability
      camera.zoom=Math.max(12,Math.min(size.width/24,size.height/19,62))*zoom;
      camera.updateProjectionMatrix();
      invalidate();
    }
  },[camera,size.width,size.height,zoom,invalidate]);
  return null;
}
