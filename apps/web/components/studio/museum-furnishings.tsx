"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { createSignTexture } from "@/lib/studio-museum/textures";

type MuseumFurnishingsProps = {
  stoneMap?: THREE.Texture;
  stoneBump?: THREE.Texture;
  walnutMap?: THREE.Texture;
  walnutBump?: THREE.Texture;
};

export function ReceptionDesk({ stoneMap, stoneBump, walnutMap, walnutBump }: MuseumFurnishingsProps) {
  const plaque = useMemo(() => createSignTexture({
    eyebrow: "THE PERSONAL MUSEUM",
    title: "INFORMATION",
    subtitle: "MAIN HALL",
  }), []);
  useEffect(() => () => plaque.dispose(), [plaque]);

  return (
    <group position={[-9, 0, 10]}>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.92, 0.16, 1.3]} />
        <meshStandardMaterial color="#35322c" metalness={0.58} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.68, 0.86, 1.12]} />
        <meshStandardMaterial map={walnutMap} bumpMap={walnutBump} bumpScale={0.026} color="#d2c1a8" roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.58, 0.58]} castShadow>
        <boxGeometry args={[4.46, 0.7, 0.045]} />
        <meshStandardMaterial map={walnutMap} bumpMap={walnutBump} bumpScale={0.025} color="#d5c2a6" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.04, 0.612]}>
        <boxGeometry args={[2.42, 0.46, 0.025]} />
        <meshStandardMaterial color="#987b50" metalness={0.72} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.04, 0.63]}>
        <planeGeometry args={[2.3, 0.36]} />
        <meshBasicMaterial map={plaque} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.08, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[5.04, 0.16, 1.48]} />
        <meshPhysicalMaterial map={stoneMap} bumpMap={stoneBump} bumpScale={0.018} color="#f0e9dc" roughness={0.24} clearcoat={0.24} clearcoatRoughness={0.22} />
      </mesh>
      <mesh position={[0, 0.16, 0.63]}>
        <boxGeometry args={[4.7, 0.035, 0.035]} />
        <meshStandardMaterial color="#a88d5e" metalness={0.72} roughness={0.27} />
      </mesh>
      <mesh position={[0, 1.0, 0.63]}>
        <boxGeometry args={[4.68, 0.025, 0.025]} />
        <meshStandardMaterial color="#b99d6d" metalness={0.72} roughness={0.28} />
      </mesh>
    </group>
  );
}

export function GalleryBench({
  position,
  walnutMap,
  walnutBump,
}: {
  position: [number, number, number];
  walnutMap?: THREE.Texture;
  walnutBump?: THREE.Texture;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.16, 0.68]} />
        <meshStandardMaterial map={walnutMap} bumpMap={walnutBump} bumpScale={0.02} color="#d1c0a7" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.64, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.96, 0.12, 0.56]} />
        <meshPhysicalMaterial color="#65574a" roughness={0.64} clearcoat={0.08} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[2.88, 0.07, 0.12]} />
        <meshStandardMaterial color="#ad9469" metalness={0.68} roughness={0.31} />
      </mesh>
      {[-1.28, 1.28].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-0.22, 0.22].map((z) => (
            <mesh key={z} position={[0, 0.25, z]} castShadow>
              <boxGeometry args={[0.075, 0.5, 0.075]} />
              <meshStandardMaterial color="#95815f" metalness={0.66} roughness={0.33} />
            </mesh>
          ))}
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[0.11, 0.065, 0.6]} />
            <meshStandardMaterial color="#95815f" metalness={0.66} roughness={0.33} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function MuseumFurnishings(props: MuseumFurnishingsProps) {
  return (
    <group>
      <ReceptionDesk {...props} />
      <GalleryBench position={[-22.4, 0, 19.5]} walnutMap={props.walnutMap} walnutBump={props.walnutBump} />
      <GalleryBench position={[22.4, 0, -26]} walnutMap={props.walnutMap} walnutBump={props.walnutBump} />
    </group>
  );
}
