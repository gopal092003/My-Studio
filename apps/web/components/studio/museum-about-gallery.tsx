"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { aboutMeExhibition, museumIntroduction } from "@/lib/studio-museum/content";
import { createSignTexture } from "@/lib/studio-museum/textures";

function makeEntranceArch() {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 48; index++) {
    const angle = (index / 48) * Math.PI;
    points.push(new THREE.Vector3(5.55 * Math.cos(angle), 6.45 + 5.55 * Math.sin(angle), 0));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 0.22, 10, false);
}

export function StudioMuseumAboutGallery({ marbleMap, bumpMap }: { marbleMap?: THREE.Texture; bumpMap?: THREE.Texture }) {
  const focused = false;
  const entranceTexture = useMemo(() => createSignTexture({
    eyebrow: aboutMeExhibition.marker,
    title: "ABOUT ME",
    subtitle: "THE CURATOR'S ROOM",
  }), []);
  const roomTexture = useMemo(() => createSignTexture({
    eyebrow: "A NOTE FROM THE CURATOR",
    title: "ABOUT ME",
    subtitle: museumIntroduction.greeting,
    large: true,
  }), []);
  const arch = useMemo(makeEntranceArch, []);

  useEffect(() => () => {
    entranceTexture.dispose();
    roomTexture.dispose();
    arch.dispose();
  }, [entranceTexture, roomTexture, arch]);

  return (
    <group>
      <group position={aboutMeExhibition.position}>
        <mesh position={[-5.55, 3.15, 0.28]}><boxGeometry args={[0.62, 6.45, 0.82]} /><meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.02} color="#eee7d9" roughness={0.35} /></mesh>
        <mesh position={[5.55, 3.15, 0.28]}><boxGeometry args={[0.62, 6.45, 0.82]} /><meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.02} color="#eee7d9" roughness={0.35} /></mesh>
        <mesh position={[-5.55, 3.3, 0.72]}><boxGeometry args={[0.12, 6.2, 0.13]} /><meshStandardMaterial color={focused ? "#e1c68f" : "#a99062"} metalness={0.68} roughness={0.26} emissive={focused ? "#9a7843" : "#382d1a"} emissiveIntensity={focused ? 0.65 : 0.16} /></mesh>
        <mesh position={[5.55, 3.3, 0.72]}><boxGeometry args={[0.12, 6.2, 0.13]} /><meshStandardMaterial color={focused ? "#e1c68f" : "#a99062"} metalness={0.68} roughness={0.26} emissive={focused ? "#9a7843" : "#382d1a"} emissiveIntensity={focused ? 0.65 : 0.16} /></mesh>
        <mesh geometry={arch} position={[0, 0, 0.68]}>
          <meshStandardMaterial color={focused ? "#dfc493" : "#a88d5c"} metalness={0.72} roughness={0.25} emissive={focused ? "#917242" : "#302615"} emissiveIntensity={focused ? 0.65 : 0.16} />
        </mesh>
        <mesh position={[0, 6.55, 0.35]}><boxGeometry args={[12.1, 0.42, 0.92]} /><meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.015} color="#e7dfd0" roughness={0.34} /></mesh>
        <mesh position={[0, 13.18, 0.74]}><planeGeometry args={[10.2, 1.55]} /><meshBasicMaterial map={entranceTexture} toneMapped={false} /></mesh>
        <mesh position={[0, 5.9, 1.12]} userData={{ interactionId: aboutMeExhibition.id }}>
          <planeGeometry args={[11.2, 11.8]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.15, 0.55]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[10.8, 1.4]} /><meshBasicMaterial color={focused ? "#ddc18d" : "#a98d5e"} transparent opacity={focused ? 0.58 : 0.22} toneMapped={false} /></mesh>
      </group>

      <group>
        <mesh position={[0, -0.16, -49.85]}><boxGeometry args={[27.6, 0.32, 21.1]} /><meshStandardMaterial map={marbleMap} color="#f0eadf" roughness={0.32} /></mesh>
        <mesh position={[-13.35, 8, -49.85]}><boxGeometry args={[0.65, 16, 21.1]} /><meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.02} color="#eee7d9" roughness={0.38} /></mesh>
        <mesh position={[13.35, 8, -49.85]}><boxGeometry args={[0.65, 16, 21.1]} /><meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.02} color="#eee7d9" roughness={0.38} /></mesh>
        <mesh position={[0, 8, -60.45]}><boxGeometry args={[27.6, 16, 0.65]} /><meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.02} color="#eee7d9" roughness={0.38} /></mesh>

        {Array.from({ length: 5 }, (_, index) => {
          const height = 0.24 * (index + 1);
          return (
            <group key={`about-step-${index}`}>
            <mesh position={[0, height / 2, -41.25 - index * 1.12]}>
              <boxGeometry args={[17.2, height, 1.14]} />
              <meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.015} color={index % 2 === 0 ? "#e7e0d3" : "#f1ebdf"} roughness={0.3} />
            </mesh>
            <mesh position={[0, height + 0.03, -41.25 - index * 1.12]}>
              <boxGeometry args={[17.25, 0.055, 1.15]} />
              <meshStandardMaterial color="#b49a6e" metalness={0.56} roughness={0.3} />
            </mesh>
          </group>
          );
        })}

        <mesh position={[0, 8.2, -60.04]}><boxGeometry args={[15.8, 8.6, 0.3]} /><meshStandardMaterial color="#a88d5c" metalness={0.58} roughness={0.3} /></mesh>
        <mesh position={[0, 8.2, -59.86]}><planeGeometry args={[15.25, 8.05]} /><meshBasicMaterial map={roomTexture} toneMapped={false} /></mesh>
        <mesh position={[0, 8.2, -59.72]} userData={{ interactionId: aboutMeExhibition.id }}>
          <planeGeometry args={[15.3, 8.1]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {[-9, 9].map((x) => (
          <group key={`about-room-sconce-${x}`} position={[x, 10.5, -59.55]}>
            <mesh><sphereGeometry args={[0.28, 16, 12]} /><meshBasicMaterial color="#f3d9aa" toneMapped={false} /></mesh>
            <pointLight position={[0, 0, 0.7]} intensity={20} distance={10} color="#f0d8ad" decay={2} />
          </group>
        ))}
      </group>
    </group>
  );
}
