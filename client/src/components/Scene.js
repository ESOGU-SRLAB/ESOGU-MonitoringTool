import React, { useMemo } from 'react';
import * as THREE from 'three';

const TILE_METERS = 10; // matches the bold section line spacing
const CELL_METERS = 1;
const PIXELS_PER_METER = 64;

function useGridTexture() {
  return useMemo(() => {
    const size = TILE_METERS * PIXELS_PER_METER;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#eeeeef';
    ctx.fillRect(0, 0, size, size);

    const cellPx = CELL_METERS * PIXELS_PER_METER;
    ctx.strokeStyle = '#8c8c92';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i < TILE_METERS; i++) {
      const p = i * cellPx;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();

    ctx.strokeStyle = '#2e2e33';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  }, []);
}

/*
 * Lighting/ground rig shared by the workcell viewport.
 * Sun direction approximates the "sun" light from the original Gazebo
 * world file (ifarlab.sdf) so the look stays close to the sim.
 * The floor grid is baked into a single tiled texture (rather than a
 * separate drei <Grid> plane) so there's only one surface at ground level --
 * two coincident planes there caused constant z-fighting flicker.
 */
export default function Scene({ children }) {
  const gridTexture = useGridTexture();
  const floorSize = 80;
  gridTexture.repeat.set(floorSize / TILE_METERS, floorSize / TILE_METERS);

  return (
    <>
      <color attach="background" args={['#e8e8ed']} />
      <fog attach="fog" args={['#e8e8ed', 18, 40]} />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <hemisphereLight args={['#ffffff', '#8a8a92', 0.4]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[floorSize, floorSize]} />
        <meshStandardMaterial map={gridTexture} roughness={1} metalness={0} />
      </mesh>

      {children}
    </>
  );
}
