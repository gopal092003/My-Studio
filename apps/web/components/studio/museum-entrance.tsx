"use client";

import { useEffect, useMemo } from "react";
import type { Exhibition } from "@/lib/studio-museum/content";
import { createSignTexture } from "@/lib/studio-museum/textures";
import * as THREE from "three";

const GOLD = "#bfa06c";

export function StudioMuseumEntrance({
  exhibition,
  marbleMap,
  bumpMap,
}: {
  exhibition: Exhibition;
  marbleMap?: THREE.Texture;
  bumpMap?: THREE.Texture;
}) {
  const focused = false;
  const texture = useMemo(() => createSignTexture({ eyebrow: exhibition.marker, title: exhibition.title }), [exhibition]);
  useEffect(() => () => texture.dispose(), [texture]);
  const archCurve = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const angle = (i / 32) * Math.PI;
      points.push(new THREE.Vector3(Math.cos(angle) * 1.95, 4.55 + Math.sin(angle) * 1.95, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.14, 8, false);
  }, []);
  useEffect(() => () => archCurve.dispose(), [archCurve]);
  const arch = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.95, 0.08);
    shape.lineTo(1.95, 0.08);
    shape.lineTo(1.95, 4.55);
    shape.absarc(0, 4.55, 1.95, 0, Math.PI, false);
    shape.lineTo(-1.95, 0.08);
    return new THREE.ShapeGeometry(shape, 20);
  }, []);
  useEffect(() => () => arch.dispose(), [arch]);

  return (
    <group position={exhibition.position} rotation={[0, exhibition.rotationY, 0]}>
      <mesh geometry={arch} position={[0, 0, 0.12]}>
        <meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.025} color="#6f8179" emissive={focused ? "#394b3b" : "#1a2522"} emissiveIntensity={focused ? 0.22 : 0.08} roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh position={[-2.04, 2.28, 0.24]}>
        <boxGeometry args={[0.28, 4.6, 0.5]} />
        <meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.02} color={focused ? "#e3d7bc" : "#c8c0b0"} roughness={0.36} emissive={focused ? GOLD : "#15130e"} emissiveIntensity={focused ? 0.24 : 0.04} />
      </mesh>
      <mesh position={[2.04, 2.28, 0.24]}>
        <boxGeometry args={[0.28, 4.6, 0.5]} />
        <meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.02} color={focused ? "#e3d7bc" : "#c8c0b0"} roughness={0.36} emissive={focused ? GOLD : "#15130e"} emissiveIntensity={focused ? 0.24 : 0.04} />
      </mesh>
      <mesh geometry={archCurve} position={[0, 0, 0.24]}>
        <meshStandardMaterial color={focused ? "#dfc493" : "#a78d60"} metalness={0.72} roughness={0.25} emissive={focused ? GOLD : "#372b17"} emissiveIntensity={focused ? 0.8 : 0.18} />
      </mesh>
      <mesh position={[0, 2.42, 0.08]}>
        <planeGeometry args={[3.7, 4.75]} />
        <meshPhysicalMaterial color="#6b9992" roughness={0.18} metalness={0.18} transparent opacity={0.48} side={THREE.DoubleSide} emissive="#142726" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 7.05, 0.36]}>
        <planeGeometry args={[5.3, 1.28]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.13, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.2, 1.55]} />
        <meshBasicMaterial color={focused ? "#dec18d" : "#927b54"} transparent opacity={focused ? 0.7 : 0.3} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.2, 0.8]} userData={{ interactionId: exhibition.id }}>
        <planeGeometry args={[4.15, 6.2]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.32, -0.25]}>
        <boxGeometry args={[4.8, 0.5, 1.45]} />
        <meshStandardMaterial map={marbleMap} bumpMap={bumpMap} bumpScale={0.018} color="#f0e9dc" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.62, -0.25]}>
        <boxGeometry args={[4.5, 0.12, 1.12]} />
        <meshStandardMaterial color="#aa8b59" metalness={0.65} roughness={0.32} />
      </mesh>
    </group>
  );
}
