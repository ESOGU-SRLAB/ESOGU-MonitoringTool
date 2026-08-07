import React, { useMemo, Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

/*
 * OTA mobile base (AGV) that carries the Kawasaki RS005L arm.
 * Geometry + joint offsets taken from mobile_manipulator_description's
 * ota_base.xacro / ota_wheel.xacro / ota_caster.xacro (all in the AGV's
 * own base_link frame, meters, Z-up -- same "-90 X" conversion as the
 * arm components).
 */

const MM_TO_M = [0.001, 0.001, 0.001];
const BASE = process.env.PUBLIC_URL + '/meshes/ota';

const BODY = { color: '#d97a1f', metalness: 0.3, roughness: 0.55 };
const WHEEL = { color: '#1a1a1a', metalness: 0.1, roughness: 0.7 };
const CASTER = { color: '#3a3a3a', metalness: 0.4, roughness: 0.5 };

function StlMesh({ url, position, rotation, material, castShadow = true, receiveShadow = true }) {
  const geometry = useLoader(STLLoader, url);
  const prepared = useMemo(() => {
    if (!geometry.userData.__stlPrepared) {
      if (!geometry.attributes?.normal) geometry.computeVertexNormals();
      geometry.userData.__stlPrepared = true;
    }
    return geometry;
  }, [geometry]);

  return (
    <mesh
      geometry={prepared}
      scale={MM_TO_M}
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <meshStandardMaterial color={material.color} metalness={material.metalness} roughness={material.roughness} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Caster({ position }) {
  return (
    <mesh position={position} receiveShadow>
      <cylinderGeometry args={[0.05, 0.05, 0.07, 16]} />
      <meshStandardMaterial color={CASTER.color} metalness={CASTER.metalness} roughness={CASTER.roughness} />
    </mesh>
  );
}

export default function AGVBase() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <Suspense fallback={null}>
        <StlMesh url={`${BASE}/OTA-v0.7.stl`} position={[-0.1, 0, -0.1625]} material={BODY} />
        <StlMesh url={`${BASE}/AnaTeker.stl`} position={[0, -0.3, -0.06]} rotation={[0, 0, Math.PI / 2]} material={WHEEL} />
        <StlMesh url={`${BASE}/AnaTeker.stl`} position={[0, 0.3, -0.06]} rotation={[0, 0, Math.PI / 2]} material={WHEEL} />
      </Suspense>
      <Caster position={[0.37, -0.22, -0.048]} />
      <Caster position={[0.37, 0.22, -0.048]} />
      <Caster position={[-0.37, -0.22, -0.048]} />
      <Caster position={[-0.37, 0.22, -0.048]} />
    </group>
  );
}
