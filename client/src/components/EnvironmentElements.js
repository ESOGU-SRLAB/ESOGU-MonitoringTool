import React, { useMemo, Suspense } from "react";
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import * as THREE from "three";

/*
 * Static workcell/facility dressing recreated from the original Gazebo
 * world (ifarlab.sdf). In that world every model is spawned at pose
 * (0 0 0) because the STL vertices already carry absolute world-space
 * coordinates (scale 0.001, i.e. mm -> m), and the UR10e itself is
 * spawned at that same world origin (whole_ifarlab_gazebo.launch.py).
 * So this group only re-applies the shared Z-up -> Y-up axis flip and
 * leaves translation at identity -- no extra offset -- to stay in that
 * same true world frame.
 */

const MM_TO_M = [0.001, 0.001, 0.001];
const FURNITURE_BASE = process.env.PUBLIC_URL + "/meshes/ur10e";
const FACILITY_BASE = process.env.PUBLIC_URL + "/meshes/environment";

const ALUMINUM = { color: "#c7c9cf", metalness: 0.6, roughness: 0.4 };
const DARK_AGV = { color: "#b3bdd9", metalness: 0.4, roughness: 0.6 };
const CONVEYOR = { color: "#6b6f7a", metalness: 0.2, roughness: 0.8 };
const FACILITY_GRAY = { color: "#000000", metalness: 0.05, roughness: 0.85 };
const RAIL = { color: "#4a4a50", metalness: 0.5, roughness: 0.5 };

function EnvMesh({
  url,
  material,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  castShadow = false,
  receiveShadow = true,
}) {
  const geometry = useLoader(STLLoader, url);
  const prepared = useMemo(() => {
    if (!geometry.userData.__stlPrepared) {
      if (!geometry.attributes?.normal) {
        geometry.computeVertexNormals();
      }
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
      <meshStandardMaterial
        color={material.color}
        metalness={material.metalness}
        roughness={material.roughness}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* Nearby workcell furniture -- loads first, cheap enough to cast shadows.
 * wall_door/wall_server (generic wall slabs from the same source folder)
 * occupy almost the exact same footprint as barrier_closetable / barrier +
 * barrier_closekabinet from the facility set below, so they're dropped here
 * to stop the two wall representations from clipping into each other.
 * linear_axis_moving_link now rides with UR10e (see UR10eMount) instead of
 * sitting fixed here, since it's the arm's own travelling mount. */
function Furniture() {
  return (
    <Suspense fallback={null}>
      <EnvMesh
        url={`${FURNITURE_BASE}/alumuniumtable.stl`}
        material={ALUMINUM}
        receiveShadow
      />
      <EnvMesh
        url={`${FURNITURE_BASE}/conveyorbelt.stl`}
        material={CONVEYOR}
        receiveShadow
      />
      <EnvMesh
        url={`${FURNITURE_BASE}/base_link.stl`}
        material={ALUMINUM}
        receiveShadow
      />
      <EnvMesh
        url={`${FURNITURE_BASE}/chassis.stl`}
        material={DARK_AGV}
        receiveShadow
      />
    </Suspense>
  );
}

/* Perimeter/facility props -- heavier meshes, streamed in behind the furniture.
 * Each piece's raw STL coordinates already place it at its true position in
 * the shared room frame (see the note above), which packs everything in
 * tighter than is comfortable for a demo viewport. SPREAD pushes every piece
 * outward from the room origin by 20% of its own raw (X,Y) center -- distance
 * only, not size -- to open up clearance around the AGV/Kawasaki corner.
 * barrier_kaw1/2/3 are one contiguous wall (edge-to-edge along Y), so they
 * all get the SAME offset (derived from the wall's combined center) instead
 * of each segment's own center, otherwise the wall would fan apart. That
 * wall sits right behind the AGV/Kawasaki, so it's excluded from the general
 * spread (like ifarlab_ray below) and instead only nudged back in close to
 * line up with Kabinet's own (spread) position, closing the gap the general
 * spread had opened up there.
 * ifarlab_ray is excluded from the spread entirely: it's the AGV's own floor
 * guide rail, and its raw X (-2.298) already lines up almost exactly with
 * the AGV/Kawasaki spawn X (-2.301949) with the AGV's position falling
 * inside the rail's length -- spreading it breaks that real alignment. */
const SPREAD = 0.2;
const spreadOffset = (rawX, rawY) => [rawX * SPREAD, rawY * SPREAD, 0];
const KAW_WALL_OFFSET = [-0.15, 0, 0];

/* barrier.stl reused as generic 1.25m fence segments to close the perimeter.
 * Its own raw center is (0.216, -1.005); BARRIER_AT(x, y) returns the
 * position offset that puts a fresh copy's center at (x, y) in the same raw
 * frame everything else here uses, optionally rotated 90 deg (about the
 * Z-up vertical axis) to run the segment along Y instead of X. */
const BARRIER_RAW_CENTER = [0.216, -1.005];
const BARRIER_AT = (x, y, rotated = false) => {
  const [rawX, rawY] = rotated
    ? [-BARRIER_RAW_CENTER[1], BARRIER_RAW_CENTER[0]]
    : BARRIER_RAW_CENTER;
  return [x - rawX, y - rawY, 0];
};

function Facility() {
  return (
    <Suspense fallback={null}>
      <EnvMesh
        url={`${FACILITY_BASE}/barrier.stl`}
        material={FACILITY_GRAY}
        position={spreadOffset(3.716, -0.005)}
        receiveShadow
      />
      <EnvMesh
        url={`${FACILITY_BASE}/barrier.stl`}
        material={FACILITY_GRAY}
        position={spreadOffset(-3.116, -0.005)}
        receiveShadow
      />
      <EnvMesh
        url={`${FACILITY_BASE}/barrier_closekabinet.stl`}
        material={FACILITY_GRAY}
        position={spreadOffset(-5.134, -0.005)}
        receiveShadow
      />
      <EnvMesh
        url={`${FACILITY_BASE}/barrier_kaw1.stl`}
        material={FACILITY_GRAY}
        position={KAW_WALL_OFFSET}
        receiveShadow
      />
      <EnvMesh
        url={`${FACILITY_BASE}/barrier_kaw2.stl`}
        material={FACILITY_GRAY}
        position={KAW_WALL_OFFSET}
        receiveShadow
      />
      <EnvMesh
        url={`${FACILITY_BASE}/barrier_kaw3.stl`}
        material={FACILITY_GRAY}
        position={KAW_WALL_OFFSET}
        receiveShadow
      />
      <EnvMesh
        url={`${FACILITY_BASE}/ifarlab_ray.stl`}
        material={RAIL}
        receiveShadow
      />

      {/* Extra fence run: closes the open stretch along the top edge, from
          the existing barrier_closetable wall back over to the left
          (barrier_kaw) wall. */}
      <EnvMesh
        url={`${FACILITY_BASE}/barrier.stl`}
        material={FACILITY_GRAY}
        position={BARRIER_AT(-0.591, 3.194)}
        receiveShadow
      />
      <EnvMesh
        url={`${FACILITY_BASE}/barrier.stl`}
        material={FACILITY_GRAY}
        position={BARRIER_AT(-2.241, 3.194)}
        receiveShadow
      />

      {/* Corner + side fence where the mannequin used to stand -- turned 90
          degrees to run alongside the table, offset out from it so there's
          clearance to the aluminum table / conveyor. */}
      <EnvMesh
        url={`${FACILITY_BASE}/barrier.stl`}
        material={FACILITY_GRAY}
        position={BARRIER_AT(1.117, 3.194)}
        receiveShadow
      />
      <EnvMesh
        url={`${FACILITY_BASE}/barrier.stl`}
        material={FACILITY_GRAY}
        position={BARRIER_AT(1.7, 2.525, true)}
        rotation={[0, 0, Math.PI / 2]}
        receiveShadow
      />

      {/* Fence added in front of the conveyor */}
      <EnvMesh
        url={`${FACILITY_BASE}/barrier.stl`}
        material={FACILITY_GRAY}
        position={BARRIER_AT(1.7, -0.4, true)}
        rotation={[0, 0, Math.PI / 2]}
        receiveShadow
      />
      
    </Suspense>
  );
}

export default function EnvironmentElements({ showEnvironment = true }) {
  if (!showEnvironment) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <Furniture />
      <Facility />
    </group>
  );
}
