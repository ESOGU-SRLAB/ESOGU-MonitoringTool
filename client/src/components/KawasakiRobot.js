import React, { useRef, useMemo, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

/*
 * Kawasaki RS005L Robot (6-DOF) from ESOGU-HILTest-DualRobot-2.
 * Joint origins and axes from mobile_manipulator_description/urdf/khi_rs/rs005l_macro.xacro
 * STL files are already in meters (scale 1.0, no URDF scaling).
 *
 * Joint chain:
 *   joint1: base_link → link1  xyz(0, 0, 0.295)        axis(0, 0, -1)
 *   joint2: link1 → link2      xyz(0, 0.105, 0)        axis(0, 0, 1)   rpy(0, -π/2, 0)
 *   joint3: link2 → link3      xyz(0.380, 0, 0)        axis(0, 0, -1)
 *   joint4: link3 → link4      xyz(0.15, -0.08, 0)     axis(0, 0, 1)   rpy(0, π/2, 0)
 *   joint5: link4 → link5      xyz(0, 0, 0.26)         axis(0, 0, -1)  rpy(0, -π/2, 0)
 *   joint6: link5 → link6      xyz(0.078, 0, 0)        axis(0, 0, 1)   rpy(0, π/2, 0)
 */

const MESH_SCALE = [1, 1, 1];
const MESH_BASE = process.env.PUBLIC_URL + '/meshes/rs005l';

const WHITE_BODY = { color: '#e8e8e8', metalness: 0.3, roughness: 0.5 };
const RED_ACCENT = { color: '#ffffff', metalness: 0.4, roughness: 0.4 };
const DARK_JOINT = { color: '#ffffff', metalness: 0.6, roughness: 0.3 };
const GRIPPER_MAT = { color: '#ffffff', metalness: 0.5, roughness: 0.4 };

function STLMesh({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = MESH_SCALE, material = WHITE_BODY }) {
  const geometry = useLoader(STLLoader, url);
  const preparedGeometry = useMemo(() => {
    // STLLoader usually provides normals. Only compute if they're missing.
    if (!geometry.userData.__stlPrepared) {
      if (!geometry.attributes?.normal) {
        geometry.computeVertexNormals();
      }
      geometry.userData.__stlPrepared = true;
    }
    return geometry;
  }, [geometry]);

  return (
    <mesh geometry={preparedGeometry} position={position} rotation={rotation} scale={scale} castShadow receiveShadow>
      <meshStandardMaterial
        color={material.color}
        metalness={material.metalness}
        roughness={material.roughness}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function KawasakiRobot({
  jointAngles = [0, 0, 0, 0, 0, 0],
  animate = false,
  animationSpeed = 1,
  gripperOpen = 0.5,
}) {
  const jointRefs = useRef([]);
  const timeRef = useRef(0);
  const toRad = (deg) => (deg * Math.PI) / 180;

  useFrame((state, delta) => {
    // Demo mode ignores the live/manual jointAngles and drives one coherent
    // "scan left-right, dip down to inspect" cycle from a single shared
    // phase, mirroring UR10eRobot's demo pose -- consistent, repeatable
    // motion instead of independent per-joint noise on top of whatever
    // (possibly extreme) angles happen to be live.
    const angles = animate
      ? (() => {
          timeRef.current += delta * animationSpeed;
          const t = timeRef.current;
          const scan = Math.sin(t * 0.3);
          const dip = (1 - Math.cos(t * 0.6)) / 2;
          return [
            toRad(scan * 40),
            toRad(20 - dip * 20),
            toRad(-30 - dip * 25),
            toRad(0),
            toRad(45 + dip * 20),
            toRad(scan * 20),
          ];
        })()
      : jointAngles.map(toRad);

    // Axis Z = rotation.z; negative axis = negate angle
    if (jointRefs.current[0]) jointRefs.current[0].rotation.z = -angles[0]; // axis 0 0 -1
    if (jointRefs.current[1]) jointRefs.current[1].rotation.z = angles[1];  // axis 0 0 1
    if (jointRefs.current[2]) jointRefs.current[2].rotation.z = -angles[2]; // axis 0 0 -1
    if (jointRefs.current[3]) jointRefs.current[3].rotation.z = angles[3];  // axis 0 0 1
    if (jointRefs.current[4]) jointRefs.current[4].rotation.z = -angles[4]; // axis 0 0 -1
    if (jointRefs.current[5]) jointRefs.current[5].rotation.z = angles[5];  // axis 0 0 1
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* ROS Z-up → Three.js Y-up */}
      <Suspense fallback={null}>
        {/* BASE (J0) */}
        <group>
          <STLMesh url={`${MESH_BASE}/RS005L_J0.STL`} material={WHITE_BODY} />

          {/* JOINT 1: xyz(0, 0, 0.295) axis(0,0,-1) */}
          <group position={[0, 0, 0.295]}>
            <group ref={(el) => (jointRefs.current[0] = el)}>
              <STLMesh url={`${MESH_BASE}/RS005L_J1.STL`} material={RED_ACCENT} />

              {/* JOINT 2: xyz(0, 0.105, 0) rpy(0, -π/2, 0) axis(0,0,1) */}
              <group position={[0, 0.105, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <group ref={(el) => (jointRefs.current[1] = el)}>
                  <STLMesh url={`${MESH_BASE}/RS005L_J2.STL`} material={WHITE_BODY} />

                  {/* JOINT 3: xyz(0.380, 0, 0) axis(0,0,-1) */}
                  <group position={[0.380, 0, 0]}>
                    <group ref={(el) => (jointRefs.current[2] = el)}>
                      <STLMesh url={`${MESH_BASE}/RS005L_J3.STL`} material={RED_ACCENT} />

                      {/* JOINT 4: xyz(0.15, -0.08, 0) rpy(0, π/2, 0) axis(0,0,1) */}
                      <group position={[0.15, -0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
                        <group ref={(el) => (jointRefs.current[3] = el)}>
                          <STLMesh url={`${MESH_BASE}/RS005L_J4.STL`} material={DARK_JOINT} />

                          {/* JOINT 5: xyz(0, 0, 0.26) rpy(0, -π/2, 0) axis(0,0,-1) */}
                          <group position={[0, 0, 0.26]} rotation={[0, -Math.PI / 2, 0]}>
                            <group ref={(el) => (jointRefs.current[4] = el)}>
                              <STLMesh url={`${MESH_BASE}/RS005L_J5.STL`} material={WHITE_BODY} />

                              {/* JOINT 6: xyz(0.078, 0, 0) rpy(0, π/2, 0) axis(0,0,1) */}
                              <group position={[0.078, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                                <group ref={(el) => (jointRefs.current[5] = el)}>
                                  <STLMesh url={`${MESH_BASE}/RS005L_J6.STL`} material={DARK_JOINT} />

                                  {/* Gripper -- gripper.STL's own geometry already starts at
                                      local Z=0 (its mounting face) and extends to Z=0.10, so it
                                      mounts flush at J6's own origin with no extra offset; the old
                                      +0.05 push here was leaving a visible gap to J6. */}
                                  <group position={[0, 0, 0]}>
                                    <STLMesh url={`${MESH_BASE}/gripper.STL`} material={GRIPPER_MAT} />
                                    <STLMesh
                                      url={`${MESH_BASE}/left_finger.STL`}
                                      position={[-0.025 * gripperOpen, 0, 0]}
                                      material={GRIPPER_MAT}
                                    />
                                    <STLMesh
                                      url={`${MESH_BASE}/right_finger.STL`}
                                      position={[0.025 * gripperOpen, 0, 0]}
                                      material={GRIPPER_MAT}
                                    />
                                  </group>
                                </group>
                              </group>
                            </group>
                          </group>
                        </group>
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </Suspense>
    </group>
  );
}

