import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/*
 * Slides the UR10e and AGV groups back and forth along their own rails
 * during demo mode. Mutates the group refs directly (the react-three-fiber
 * pattern for per-frame animation) instead of calling the React setters,
 * so this doesn't trigger a full React re-render 60x/second.
 *
 * Ranges are a conservative middle slice of each rail's real span --
 * UR10e's is 0-2.4m, the AGV's is roughly -0.45-3m -- clear of the chassis,
 * table and fence at either end.
 */
const UR10E_RAIL_RANGE = [0.8, 1.6];
const AGV_RAIL_RANGE = [0.6, 1.8];

export default function RailAnimator({ animate, animationSpeed, ur10eGroupRef, agvGroupRef }) {
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (!animate) return;
    timeRef.current += delta * animationSpeed;
    const t = timeRef.current;

    if (ur10eGroupRef.current) {
      const p = (Math.sin(t * 0.25) + 1) / 2;
      const rail = UR10E_RAIL_RANGE[0] + p * (UR10E_RAIL_RANGE[1] - UR10E_RAIL_RANGE[0]);
      ur10eGroupRef.current.position.z = -rail;
    }

    if (agvGroupRef.current) {
      const p = (Math.sin(t * 0.2 + 1.5) + 1) / 2;
      const rail = AGV_RAIL_RANGE[0] + p * (AGV_RAIL_RANGE[1] - AGV_RAIL_RANGE[0]);
      agvGroupRef.current.position.z = -rail;
    }
  });

  return null;
}
