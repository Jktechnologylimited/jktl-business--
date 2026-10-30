"use client";
import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
/** Only static buildings and trees cast shadows; traffic never invalidates the map. */
export function ShadowCache({revision}:{revision:unknown}) {
  const gl=useThree(state=>state.gl),invalidate=useThree(state=>state.invalidate);
  useLayoutEffect(()=>{
    // Three renderer resources are intentionally mutable, outside React state.
    // eslint-disable-next-line react-hooks/immutability
    gl.shadowMap.autoUpdate=false;
    gl.shadowMap.needsUpdate=true;
    invalidate();
  },[gl,revision,invalidate]);
  return null;
}
