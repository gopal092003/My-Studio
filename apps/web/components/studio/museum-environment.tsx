"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { exhibitions } from "@/lib/studio-museum/content";
import { StudioMuseumEntrance } from "@/components/studio/museum-entrance";
import { createGlazingTexture, createMarbleMaps, createMuseumEnvironmentTexture, createMuseumFloorTexture, createWalnutMaps } from "@/lib/studio-museum/textures";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MuseumFurnishings } from "@/components/studio/museum-furnishings";

const HALF_WIDTH = 29;
const HALF_LENGTH = 40;
const VAULT_SPRING = 14.7;
const VAULT_RISE = 7.6;

function vaultHeight(x: number) {
  return VAULT_SPRING + VAULT_RISE * Math.sqrt(Math.max(0, 1 - (x / HALF_WIDTH) ** 2));
}

function createVaultPanel(xStart: number, xEnd: number) {
  const geometry = new THREE.BufferGeometry();
  const across = 7;
  const along = 36;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let zIndex = 0; zIndex <= along; zIndex++) {
    const v = zIndex / along;
    const z = -HALF_LENGTH + v * HALF_LENGTH * 2;
    for (let xIndex = 0; xIndex <= across; xIndex++) {
      const u = xIndex / across;
      const x = xStart + u * (xEnd - xStart);
      positions.push(x, vaultHeight(x), z);
      uvs.push(u, v);
    }
  }

  for (let zIndex = 0; zIndex < along; zIndex++) {
    for (let xIndex = 0; xIndex < across; xIndex++) {
      const a = zIndex * (across + 1) + xIndex;
      const b = a + across + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createVaultCurve(z: number, halfWidth: number, spring: number, rise: number, radius: number) {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 48; index++) {
    const angle = Math.PI - (index / 48) * Math.PI;
    points.push(new THREE.Vector3(
      halfWidth * Math.cos(angle),
      spring + rise * Math.sin(angle),
      z,
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, radius, 8, false);
}

function createVaultMullion(x: number) {
  const points = Array.from({ length: 28 }, (_, index) => {
    const z = -HALF_LENGTH + (index / 27) * HALF_LENGTH * 2;
    return new THREE.Vector3(x, vaultHeight(x), z);
  });
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.055, 7, false);
}

function createFlutedShaft() {
  const geometry = new THREE.BufferGeometry();
  const radialSegments = 128;
  const heightSegments = 24;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let yIndex = 0; yIndex <= heightSegments; yIndex++) {
    const t = yIndex / heightSegments;
    const y = t * 12.6;
    const baseRadius = THREE.MathUtils.lerp(0.89, 0.75, t);
    for (let segment = 0; segment <= radialSegments; segment++) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const flute = (1 - Math.cos(angle * 32)) * 0.018;
      const radius = baseRadius - flute;
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    }
  }
  for (let yIndex = 0; yIndex < heightSegments; yIndex++) {
    for (let segment = 0; segment < radialSegments; segment++) {
      const a = yIndex * (radialSegments + 1) + segment;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCapitalLeaf() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.13, 0.12, 0.28, 0.38, 0.16, 0.66);
  shape.quadraticCurveTo(0.1, 0.8, 0, 0.96);
  shape.quadraticCurveTo(-0.1, 0.8, -0.16, 0.66);
  shape.bezierCurveTo(-0.28, 0.38, -0.13, 0.12, 0, 0);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 8,
  });
}

function createCapitalFoliage() {
  const leaf = createCapitalLeaf();
  const pieces: THREE.BufferGeometry[] = [];
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    rotation.setFromEuler(new THREE.Euler(0, Math.PI / 2 - angle, 0));
    position.set(Math.cos(angle) * 0.72, 13.48, Math.sin(angle) * 0.72);
    scale.setScalar(1);
    matrix.compose(position, rotation, scale);
    pieces.push(leaf.clone().applyMatrix4(matrix));

    const upperAngle = ((index + 0.5) / 8) * Math.PI * 2;
    rotation.setFromEuler(new THREE.Euler(0, Math.PI / 2 - upperAngle, 0));
    position.set(Math.cos(upperAngle) * 0.78, 13.56, Math.sin(upperAngle) * 0.78);
    scale.setScalar(0.76);
    matrix.compose(position, rotation, scale);
    pieces.push(leaf.clone().applyMatrix4(matrix));
  }
  leaf.dispose();
  const foliage = mergeGeometries(pieces, false);
  pieces.forEach((geometry) => geometry.dispose());
  foliage?.computeBoundingSphere();
  if (!foliage) throw new Error("Unable to assemble the column capital geometry");
  return foliage;
}

function MuseumImageBasedLighting({ texture }: { texture: THREE.Texture }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = texture;
    scene.environmentIntensity = 0.46;
    invalidate();
    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
    };
  }, [scene, texture, invalidate]);
  return null;
}

function BarrelVault({ glassMap }: { glassMap: THREE.Texture }) {
  const panels = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const start = -28 + index * 7;
    return createVaultPanel(start, start + 7);
  }), []);
  const ribs = useMemo(() => [-36, -27, -18, -9, 0, 9, 18, 27, 36].map((z) => ({
    z,
    geometry: createVaultCurve(z, 28.8, VAULT_SPRING, VAULT_RISE, 0.18),
  })), []);
  const mullions = useMemo(() => [-24.5, -18, -11.5, -5, 0, 5, 11.5, 18, 24.5].map((x) => ({
    x,
    geometry: createVaultMullion(x),
  })), []);

  useEffect(() => () => {
    panels.forEach((geometry) => geometry.dispose());
    ribs.forEach(({ geometry }) => geometry.dispose());
    mullions.forEach(({ geometry }) => geometry.dispose());
  }, [panels, ribs, mullions]);

  return (
    <group>
      {panels.map((geometry, index) => (
        <mesh key={`glass-${index}`} geometry={geometry} receiveShadow>
          <meshBasicMaterial map={glassMap} color="#fff" transparent opacity={0.82} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
      {ribs.map(({ z, geometry }) => (
        <mesh key={`vault-rib-${z}`} geometry={geometry} castShadow>
          <meshStandardMaterial color="#506c6c" roughness={0.3} metalness={0.66} />
        </mesh>
      ))}
      {mullions.map(({ x, geometry }) => (
        <mesh key={`vault-mullion-${x}`} geometry={geometry} castShadow>
          <meshStandardMaterial color="#768f88" roughness={0.27} metalness={0.63} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={`spring-line-${side}`}>
          <mesh position={[side * 28.4, 14.75, 0]}><boxGeometry args={[0.42, 0.38, 80]} /><meshStandardMaterial color="#b49b6e" roughness={0.3} metalness={0.62} /></mesh>
          <mesh position={[side * 15.6, 14.2, 0]}><boxGeometry args={[0.62, 0.68, 80]} /><meshStandardMaterial color="#b4aa98" roughness={0.35} /></mesh>
          <mesh position={[side * 15.6, 14.57, 0]}><boxGeometry args={[0.7, 0.1, 80]} /><meshStandardMaterial color="#ac9060" roughness={0.26} metalness={0.66} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Column({
  position,
  marbleMap,
  bumpMap,
}: {
  position: [number, number, number];
  marbleMap?: THREE.Texture;
  bumpMap?: THREE.Texture;
}) {
  const shaft = useMemo(createFlutedShaft, []);
  const foliage = useMemo(createCapitalFoliage, []);
  useEffect(() => () => { shaft.dispose(); foliage.dispose(); }, [shaft, foliage]);
  const marble = { map: marbleMap, bumpMap, bumpScale: 0.025 };
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow><cylinderGeometry args={[1.2, 1.34, 0.52, 64]} /><meshStandardMaterial color="#bcb4a5" roughness={0.42} {...marble} /></mesh>
      <mesh position={[0, 0.67, 0]} castShadow receiveShadow><cylinderGeometry args={[0.88, 0.97, 0.22, 64]} /><meshStandardMaterial color="#d6cebf" roughness={0.32} {...marble} /></mesh>
      <mesh position={[0, 0.9, 0]}><torusGeometry args={[0.83, 0.035, 8, 64]} /><meshStandardMaterial color="#bcb4a5" roughness={0.38} {...marble} /></mesh>
      <mesh geometry={shaft} position={[0, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d6d0c3" roughness={0.34} {...marble} />
      </mesh>
      <mesh position={[0, 7.1, 0]} castShadow><cylinderGeometry args={[0.95, 0.91, 0.18, 64]} /><meshStandardMaterial color="#ac956d" roughness={0.36} metalness={0.24} /></mesh>
      <mesh position={[0, 13.48, 0]} castShadow receiveShadow><cylinderGeometry args={[0.9, 0.79, 0.18, 64]} /><meshStandardMaterial color="#d6d0c3" roughness={0.34} {...marble} /></mesh>
      <mesh position={[0, 13.72, 0]} castShadow receiveShadow><cylinderGeometry args={[1.2, 1.02, 0.38, 64]} /><meshStandardMaterial color="#bdb6a7" roughness={0.38} {...marble} /></mesh>
      <mesh geometry={foliage} castShadow receiveShadow>
        <meshStandardMaterial color="#c8c0b2" roughness={0.45} {...marble} />
      </mesh>
      <mesh position={[0, 14.08, 0]} castShadow><cylinderGeometry args={[1.34, 1.28, 0.12, 64]} /><meshStandardMaterial color="#ad9d7d" roughness={0.38} /></mesh>
    </group>
  );
}

function WallSconce({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh><sphereGeometry args={[0.3, 16, 12]} /><meshBasicMaterial color="#f5dcae" toneMapped={false} /></mesh>
      <mesh position={[0, -0.43, 0]}><cylinderGeometry args={[0.13, 0.27, 0.58, 14]} /><meshStandardMaterial color="#b69864" metalness={0.65} roughness={0.26} emissive="#684a1e" emissiveIntensity={0.3} /></mesh>
    </group>
  );
}

function WallRelief({ side, z }: { side: -1 | 1; z: number }) {
  return (
    <group position={[side * 28.42, 0, z]}>
      <mesh position={[0, 4.8, 0]}><boxGeometry args={[0.16, 7.7, 7.5]} /><meshStandardMaterial color="#bcb4a5" roughness={0.42} /></mesh>
      <mesh position={[-side * 0.1, 4.8, 0]}><boxGeometry args={[0.08, 7.15, 6.94]} /><meshStandardMaterial color="#d2cbbd" roughness={0.35} /></mesh>
      {[-3.38, 3.38].map((offset) => (
        <mesh key={offset} position={[-side * 0.17, 4.8, offset]}><boxGeometry args={[0.09, 6.6, 0.1]} /><meshStandardMaterial color="#a98d5d" metalness={0.58} roughness={0.3} /></mesh>
      ))}
      <group position={[-side * 0.17, 0, 0]}>
        <mesh position={[0, 1.55, 0]}><boxGeometry args={[0.11, 0.1, 6.94]} /><meshStandardMaterial color="#a98d5d" metalness={0.58} roughness={0.3} /></mesh>
        <mesh position={[0, 8.05, 0]}><boxGeometry args={[0.11, 0.1, 6.94]} /><meshStandardMaterial color="#a98d5d" metalness={0.58} roughness={0.3} /></mesh>
      </group>
    </group>
  );
}

type MarbleMaps = NonNullable<ReturnType<typeof createMarbleMaps>>;

export function StudioMuseumEnvironment({ marbleMaps }: { marbleMaps: MarbleMaps | null }) {
  const floorTexture = useMemo(createMuseumFloorTexture, []);
  const glassTexture = useMemo(createGlazingTexture, []);
  const environmentTexture = useMemo(createMuseumEnvironmentTexture, []);
  const walnutMaps = useMemo(createWalnutMaps, []);
  useEffect(() => () => {
    floorTexture.dispose();
    glassTexture.dispose();
    environmentTexture.dispose();
    walnutMaps?.map.dispose();
    walnutMaps?.bumpMap.dispose();
  }, [floorTexture, glassTexture, environmentTexture, walnutMaps]);
  const columnZ = [-30, -15, 0, 15, 30];
  return (
    <group>
      <MuseumImageBasedLighting texture={environmentTexture} />
      <color attach="background" args={["#99ada8"]} />
      <ambientLight intensity={0.3} color="#e4e8dc" />
      <hemisphereLight args={["#f5f5e9", "#41433e", 0.62]} />
      <directionalLight
        position={[-12, 30, 8]}
        intensity={2.25}
        color="#fff4dc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-bias={-0.00012}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[16, 18, -18]} intensity={0.38} color="#bbd7d5" />
      <pointLight position={[0, 17, -4]} intensity={58} distance={34} color="#f5e3c0" decay={2} />
      <pointLight position={[0, 17, 25]} intensity={46} distance={30} color="#e6f0e3" decay={2} />

      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[58, 0.5, 80]} />
        <meshStandardMaterial color="#bcb8ac" roughness={0.29} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[57.5, 79.5]} />
        <meshPhysicalMaterial map={floorTexture} color="#f1eee5" roughness={0.23} metalness={0.025} clearcoat={0.22} clearcoatRoughness={0.3} />
      </mesh>
      <mesh position={[0, 8.5, 40.1]} castShadow receiveShadow><boxGeometry args={[58, 17, 1.1]} /><meshStandardMaterial map={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} bumpScale={0.025} color="#f2ebdf" roughness={0.4} /></mesh>
      <mesh position={[-18.1, 8.5, -39.5]} castShadow receiveShadow><boxGeometry args={[21.8, 17, 1.1]} /><meshStandardMaterial map={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} bumpScale={0.025} color="#f2ebdf" roughness={0.4} /></mesh>
      <mesh position={[18.1, 8.5, -39.5]} castShadow receiveShadow><boxGeometry args={[21.8, 17, 1.1]} /><meshStandardMaterial map={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} bumpScale={0.025} color="#f2ebdf" roughness={0.4} /></mesh>
      <mesh position={[0, 15, -39.5]} castShadow receiveShadow><boxGeometry args={[14.4, 4, 1.1]} /><meshStandardMaterial map={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} bumpScale={0.025} color="#f2ebdf" roughness={0.4} /></mesh>
      <mesh position={[-29.1, 8.5, 0]} castShadow receiveShadow><boxGeometry args={[1.1, 17, 80]} /><meshStandardMaterial map={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} bumpScale={0.025} color="#f2ebdf" roughness={0.4} /></mesh>
      <mesh position={[29.1, 8.5, 0]} castShadow receiveShadow><boxGeometry args={[1.1, 17, 80]} /><meshStandardMaterial map={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} bumpScale={0.025} color="#f2ebdf" roughness={0.4} /></mesh>

      {[-28.35, 28.35].map((x, index) => (
        <group key={`wall-mould-${index}`} position={[x, 0, 0]}>
          {[0.65, 1.0, 14.5, 14.9, 16.6].map((height) => (
            <mesh key={height} position={[0, height, 0]}><boxGeometry args={[0.18, height === 0.65 || height === 16.6 ? 0.42 : 0.12, 79]} /><meshStandardMaterial color={height > 15 ? "#a99670" : "#e0d8c8"} roughness={0.31} metalness={height > 15 ? 0.3 : 0.06} /></mesh>
          ))}
        </group>
      ))}

      {[-19.5, -6.5, 6.5, 19.5].map((z, index) => <WallRelief key={`left-relief-${index}`} side={-1} z={z} />)}
      {[-29, -13, 0, 13, 29].map((z, index) => <WallRelief key={`right-relief-${index}`} side={1} z={z} />)}

      {[...columnZ.map((z) => [-15.6, 0, z] as [number, number, number]), ...columnZ.map((z) => [15.6, 0, z] as [number, number, number])].map((position, index) => (
        <group key={`column-${index}`} position={position}>
          <Column position={[0, 0, 0]} marbleMap={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} />
        </group>
      ))}

      <MuseumFurnishings
        stoneMap={marbleMaps?.map}
        stoneBump={marbleMaps?.bumpMap}
        walnutMap={walnutMaps?.map}
        walnutBump={walnutMaps?.bumpMap}
      />

      {[-32, -16, 0, 16, 32].map((z, index) => (
        <group key={`sconce-pair-${index}`}>
          <WallSconce position={[-28.0, 10.6, z]} />
          <WallSconce position={[28.0, 10.6, z]} />
        </group>
      ))}

      <BarrelVault glassMap={glassTexture} />
      {exhibitions.map((exhibition) => <StudioMuseumEntrance key={exhibition.id} exhibition={exhibition} marbleMap={marbleMaps?.map} bumpMap={marbleMaps?.bumpMap} />)}
    </group>
  );
}
