"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
/** Remove the listener before R3F deliberately releases a renderer during a quality switch. */
export function ContextGuard({onFailure}:{onFailure:()=>void}) {
  const gl=useThree(state=>state.gl);
  useEffect(()=>{
    const canvas=gl.domElement;
    const lost=(event:Event)=>{
      event.preventDefault();
      if(canvas.isConnected) onFailure();
    };
    canvas.addEventListener('webglcontextlost',lost);
    canvas.setAttribute('data-webgl-ready','true');
    return()=>{
      canvas.removeEventListener('webglcontextlost',lost);
      canvas.removeAttribute('data-webgl-ready');
    };
  },[gl,onFailure]);
  return null;
}
