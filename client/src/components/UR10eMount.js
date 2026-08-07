import React, { useMemo, Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

/*
 * The UR10e's own travelling mount (7th-axis linear carriage). The arm's
 * "ur10e_base_to_robot_mount" joint (see api/server.js) rides this carriage
 * along the fixed rail (EnvironmentElements' base_link.stl). The carriage's
 * raw STL center is only a few cm from base.stl's raw center, so re-using
 * UR10eRobot.js's own base.stl recentering offset lands it right under the
 * arm instead of at its unrelated resting spot on the rail.
 */

const MESH_SCALE = [0.001, 0.001, 0.001];
const MESH_URL = process.env.PUBLIC_URL + '/meshes/ur10e/linear_axis_moving_link.stl';
const RECENTER_OFFSET = [0.105561, -0.1918, -0.6445];
const CARRIAGE_MATERIAL = { color: '#000072', metalness: 0.4, roughness: 0.6 };

export default function UR10eMount() {
  const geometry = useLoader(STLLoader, MESH_URL);
  const prepared = useMemo(() => {
    if (!geometry.userData.__stlPrepared) {
      if (!geometry.attributes?.normal) geometry.computeVertexNormals();
      geometry.userData.__stlPrepared = true;
    }
    return geometry;
  }, [geometry]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <Suspense fallback={null}>
        <mesh geometry={prepared} scale={MESH_SCALE} position={RECENTER_OFFSET} castShadow receiveShadow>
          <meshStandardMaterial
            color={CARRIAGE_MATERIAL.color}
            metalness={CARRIAGE_MATERIAL.metalness}
            roughness={CARRIAGE_MATERIAL.roughness}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Suspense>
    </group>
  );
}
