import React, { useRef, useMemo, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

/*
 * UR10e Robot Visualizer using actual STL meshes from the
 * ESOGU-PickandPlaceScenario / Universal_Robots_ROS2_Description repository.
 *
 * Joint origins and mesh visual offsets are taken directly from ur_macro.xacro.
 * STL files are in millimeters, so scale = 0.001.
 */

const MESH_SCALE = [0.001, 0.001, 0.001];
const MESH_BASE = process.env.PUBLIC_URL + '/meshes/ur10e';

// Material presets
const SILVER = { color: '#ffffff', metalness: 0.65, roughness: 0.35 };
const DARK_METAL = { color: '#ffffff', metalness: 0.7, roughness: 0.3 };
const BLUE_ACCENT = { color: '#6babf4', metalness: 0.5, roughness: 0.4 };
const GRIPPER_MAT = { color: '#ffffff', metalness: 0.7, roughness: 0.3  };

// gripper_body_1/lower_1/upper_1.stl share the same raw coordinate frame as
// the rest of the arm's collision meshes (their raw centers sit right past
// flange.stl's along the tool's forward direction), so re-using flange's own
// recentering offset here lands them correctly relative to it -- same trick
// as every other mesh in this chain.
const FLANGE_OFFSET = [-1.106132, -0.502789, -0.727752];
const GRIPPER_FINGER_TRAVEL = 0.02; // metres of additional opening travel

function STLMesh({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = MESH_SCALE, material = SILVER }) {
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

function CoordinateFrame({ size = 0.1 }) {
  return (
    <group>
      <mesh position={[size / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.003, 0.003, size, 8]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <mesh position={[0, size / 2, 0]}>
        <cylinderGeometry args={[0.003, 0.003, size, 8]} />
        <meshBasicMaterial color="green" />
      </mesh>
      <mesh position={[0, 0, size / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, size, 8]} />
        <meshBasicMaterial color="blue" />
      </mesh>
    </group>
  );
}

export default function UR10eRobot({
  jointAngles = [0, 0, 0, 0, 0, 0],
  showFrames = false,
  gripperOpen = 0.5,
  animate = false,
  animationSpeed = 1,
}) {
  const jointRefs = useRef([]);
  const timeRef = useRef(0);
  const toRad = (deg) => (deg * Math.PI) / 180;

  useFrame((state, delta) => {
    if (animate) {
      // Demo mode ignores the live/manual jointAngles entirely and instead
      // drives a single, coherent sway/scan cycle from one shared phase --
      // a fixed, repeatable pose sequence instead of independent per-joint
      // noise added on top of whatever (possibly extreme) angles happen to
      // be live. The arm stays close to its rest pose (elbow near 0, wrist 1
      // near -90) rather than reaching forward/down: the UR10e's own mount
      // sits right next to the conveyor/linear-axis rack furniture, and any
      // real forward reach there put the tool straight through it.
      timeRef.current += delta * animationSpeed;
      const t = timeRef.current;
      const scan = Math.sin(t * 0.3); // -1..1, slow left/right sweep

      const demo = [
        scan * 25, // base: look around
        -90 + Math.sin(t * 0.4) * 6, // shoulder: small sway around rest
        Math.sin(t * 0.5 + 1) * 8, // elbow: small flex, stays near rest (0)
        -90 + Math.sin(t * 0.45 + 2) * 10, // wrist 1: small tilt around rest
        Math.sin(t * 0.5 + 3) * 15, // wrist 2: gentle rotation
        Math.sin(t * 0.6) * 20, // wrist 3: gentle spin, doesn't change reach
      ];

      // Joint axes from URDF: J1=Z, J2=Y, J3=Y, J4=Y, J5=-Z, J6=Y
      if (jointRefs.current[0]) jointRefs.current[0].rotation.z = toRad(demo[0]);
      if (jointRefs.current[1]) jointRefs.current[1].rotation.y = toRad(demo[1]);
      if (jointRefs.current[2]) jointRefs.current[2].rotation.y = toRad(demo[2]);
      if (jointRefs.current[3]) jointRefs.current[3].rotation.y = toRad(demo[3]);
      if (jointRefs.current[4]) jointRefs.current[4].rotation.z = -toRad(demo[4]);
      if (jointRefs.current[5]) jointRefs.current[5].rotation.y = toRad(demo[5]);
    } else {
      if (jointRefs.current[0]) jointRefs.current[0].rotation.z = toRad(jointAngles[0]);
      if (jointRefs.current[1]) jointRefs.current[1].rotation.y = toRad(jointAngles[1]);
      if (jointRefs.current[2]) jointRefs.current[2].rotation.y = toRad(jointAngles[2]);
      if (jointRefs.current[3]) jointRefs.current[3].rotation.y = toRad(jointAngles[3]);
      if (jointRefs.current[4]) jointRefs.current[4].rotation.z = -toRad(jointAngles[4]);
      if (jointRefs.current[5]) jointRefs.current[5].rotation.y = toRad(jointAngles[5]);
    }
  });

  /*
   * Kinematic chain from ur_macro.xacro.
   * This component only renders the UR10e arm (base through tool0).
   * Environment meshes (table, chassis, conveyor, etc.) are in EnvironmentElements.js.
   *
   * The MESH_BASE prop selects between /meshes/ur10e and /meshes/ur10e_second.
   */

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Rotate entire robot from ROS Z-up to Three.js Y-up */}
      <Suspense fallback={null}>
        {/* ===== BASE_LINK ===== */}
        <group>
          {showFrames && <CoordinateFrame size={0.15} />}

          {/* base_link_inertia (fixed joint offset) */}
          <group position={[0.052439, 0.0768, 0.05815]}>
            <STLMesh
              url={`${MESH_BASE}/base.stl`}
              position={[0.105561, -0.1918, -0.6445]}
              material={SILVER}
            />

            {/* ===== JOINT 1: shoulder_pan_joint (axis Z) ===== */}
            <group position={[-4e-06, 0.0, 0.09955]}>
              <group ref={(el) => (jointRefs.current[0] = el)}>
                <STLMesh
                  url={`${MESH_BASE}/shoulder.stl`}
                  position={[0.105565, -0.1918, -0.74405]}
                  material={BLUE_ACCENT}
                />
                {showFrames && <CoordinateFrame size={0.12} />}

                {/* ===== JOINT 2: shoulder_lift_joint (axis Y) ===== */}
                <group position={[0.0, 0.086, 0.09]}>
                  <group ref={(el) => (jointRefs.current[1] = el)}>
                    <STLMesh
                      url={`${MESH_BASE}/upperarm.stl`}
                      position={[0.105565, -0.2778, -0.83405]}
                      material={SILVER}
                    />
                    {showFrames && <CoordinateFrame size={0.1} />}

                    {/* ===== JOINT 3: elbow_joint (axis Y) ===== */}
                    <group position={[0.612099, 0.021891, -0.000601]}>
                      <group ref={(el) => (jointRefs.current[2] = el)}>
                        <STLMesh
                          url={`${MESH_BASE}/forearm.stl`}
                          position={[-0.506534, -0.299691, -0.833449]}
                          material={BLUE_ACCENT}
                        />
                        {showFrames && <CoordinateFrame size={0.08} />}

                        {/* ===== JOINT 4: wrist_1_joint (axis Y) ===== */}
                        <group position={[0.571598, 0.002, 0.0]}>
                          <group ref={(el) => (jointRefs.current[3] = el)}>
                            <STLMesh
                              url={`${MESH_BASE}/wrist1.stl`}
                              position={[-1.078132, -0.301691, -0.833449]}
                              material={SILVER}
                            />
                            {showFrames && <CoordinateFrame size={0.07} />}

                            {/* ===== JOINT 5: wrist_2_joint (axis -Z) ===== */}
                            <group position={[0.0, 0.054, -0.061699]}>
                              <group ref={(el) => (jointRefs.current[4] = el)}>
                                <STLMesh
                                  url={`${MESH_BASE}/wrist2.stl`}
                                  position={[-1.078132, -0.355691, -0.77175]}
                                  material={BLUE_ACCENT}
                                />
                                {showFrames && <CoordinateFrame size={0.06} />}

                                {/* ===== JOINT 6: wrist_3_joint (axis Y) ===== */}
                                <group position={[0.0, 0.061698, -0.054]}>
                                  <group ref={(el) => (jointRefs.current[5] = el)}>
                                    <STLMesh
                                      url={`${MESH_BASE}/wrist3.stl`}
                                      position={[-1.078132, -0.417389, -0.71775]}
                                      material={SILVER}
                                    />
                                    {showFrames && <CoordinateFrame size={0.05} />}

                                    {/* ===== TOOL0 (fixed from wrist_3) ===== */}
                                    <group position={[0.0, 0.0605, 2e-06]}>
                                      <STLMesh
                                        url={`${MESH_BASE}/tool0.stl`}
                                        position={[-1.078132, -0.477889, -0.717752]}
                                        material={DARK_METAL}
                                      />

                                      {/* Flange (fixed from tool0) */}
                                      <group position={[0.028, 0.0249, 0.01]}>
                                        <STLMesh
                                          url={`${MESH_BASE}/flange.stl`}
                                          position={[-1.106132, -0.502789, -0.727752]}
                                          material={DARK_METAL}
                                        />

                                        {/* SICK Camera (fixed from flange) */}
                                        <group position={[-0.081802, 0.043811, 0.003]}>
                                          <STLMesh
                                            url={`${MESH_BASE}/sick_camera_mo.stl`}
                                            position={[-1.02433, -0.5466, -0.730752]}
                                            material={{ color: '#6babf4', metalness: 0.5, roughness: 0.4 }}
                                          />
                                        </group>

                                        {/* Gripper (fixed body + opening fingers, mounted on flange) */}
                                        <STLMesh
                                          url={`${MESH_BASE}/gripper_body_1.stl`}
                                          position={FLANGE_OFFSET}
                                          material={GRIPPER_MAT}
                                        />
                                        <STLMesh
                                          url={`${MESH_BASE}/gripper_lower_1.stl`}
                                          position={[
                                            FLANGE_OFFSET[0],
                                            FLANGE_OFFSET[1],
                                            FLANGE_OFFSET[2] - gripperOpen * GRIPPER_FINGER_TRAVEL,
                                          ]}
                                          material={GRIPPER_MAT}
                                        />
                                        <STLMesh
                                          url={`${MESH_BASE}/gripper_upper_1.stl`}
                                          position={[
                                            FLANGE_OFFSET[0],
                                            FLANGE_OFFSET[1],
                                            FLANGE_OFFSET[2] + gripperOpen * GRIPPER_FINGER_TRAVEL,
                                          ]}
                                          material={GRIPPER_MAT}
                                        />
                                      </group>

                                      {/* Cable channel flange (fixed from tool0) */}
                                      <group position={[0.0, 0.0599, -0.01]}>
                                        <STLMesh
                                          url={`${MESH_BASE}/cable_channel_flange.stl`}
                                          position={[-1.078132, -0.537789, -0.707752]}
                                          material={DARK_METAL}
                                        />
                                        {/* Cable channel (fixed from cable_channel_flange) */}
                                        <group position={[0.0, -0.051, -0.038]}>
                                          <STLMesh
                                            url={`${MESH_BASE}/cable_channel.stl`}
                                            position={[-1.078132, -0.486789, -0.669752]}
                                            material={DARK_METAL}
                                          />
                                        </group>
                                      </group>

                                      {showFrames && <CoordinateFrame size={0.05} />}
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

          {/* ===== ENVIRONMENT MESHES now in EnvironmentElements.js ===== */}
        </group>
      </Suspense>
    </group>
  );
}

