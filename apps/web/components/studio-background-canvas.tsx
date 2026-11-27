"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { StudioMuseumScene } from "@/components/studio/museum-scene";

export function StudioBackgroundCanvas() {
  return (
    <div className="studio-background-canvas" aria-hidden="true">
      <Canvas
        className="studio-background-renderer"
        shadows
        dpr={[1, 1.25]}
        frameloop="demand"
        camera={{ fov: 58, near: 0.1, far: 120, position: [0, 1.72, 36] }}
        gl={{ antialias: true, powerPreference: "low-power", alpha: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.06;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        fallback={<div className="studio-canvas-fallback" />}
      >
        <Suspense fallback={null}>
          <StudioMuseumScene />
        </Suspense>
      </Canvas>
      <div className="studio-background-shade" />
    </div>
  );
}
