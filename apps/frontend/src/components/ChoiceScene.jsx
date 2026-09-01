import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const visualChoices = {
  rock: { emoji: '✊', color: '#6ea8df', glow: '#306bb1' },
  paper: { emoji: '✋', color: '#f4c769', glow: '#b9781d' },
  scissors: { emoji: '✌️', color: '#ed7f9d', glow: '#b13064' },
  unknown: { emoji: '❔', color: '#5f7892', glow: '#274459' },
};

export default function ChoiceScene({ yourChoice, opponentChoice, winner, youAre }) {
  const preview = !yourChoice && !opponentChoice;
  const yourWon = winner && winner !== 'draw' && winner === youAre;
  const opponentWon = winner && winner !== 'draw' && winner !== youAre;

  return <div className="h-72 overflow-hidden rounded-2xl border border-sky-300/25 bg-slate-950/70">
    <Canvas camera={{ position: [0, 0.6, 7], fov: 42 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#07111f']} />
      <ambientLight intensity={1.5} />
      <pointLight position={[-3, 3, 4]} intensity={30} color="#4b99eb" />
      <pointLight position={[3, 2, 4]} intensity={25} color="#ed7f9d" />
      <Stage />
      {preview ? <Preview /> : <Duel yourChoice={yourChoice} opponentChoice={opponentChoice} yourWon={yourWon} opponentWon={opponentWon} />}
    </Canvas>
  </div>;
}

function Stage() {
  return <mesh rotation-x={-Math.PI / 2} position={[0, -1.3, 0]}>
    <circleGeometry args={[6, 64]} />
    <meshStandardMaterial color="#0b2139" metalness={0.75} roughness={0.45} />
  </mesh>;
}

function Preview() {
  return <group>
    <EmojiToken type="rock" position={[-2, 0, 0]} />
    <EmojiToken type="paper" position={[0, 0, 0]} />
    <EmojiToken type="scissors" position={[2, 0, 0]} />
  </group>;
}

function Duel({ yourChoice, opponentChoice, yourWon, opponentWon }) {
  return <group>
    <EmojiToken type={yourChoice ?? 'unknown'} position={[-1.7, 0, 0]} winner={yourWon} />
    <EmojiToken type={opponentChoice ?? 'unknown'} position={[1.7, 0, 0]} winner={opponentWon} />
  </group>;
}

function EmojiToken({ type, position, winner = false }) {
  const group = useRef();
  const { emoji, color, glow } = visualChoices[type];
  const texture = useEmojiTexture(emoji);

  useFrame((state) => {
    if (!group.current) return;
    const time = state.clock.getElapsedTime();
    group.current.position.y = position[1] + Math.sin(time * 1.7 + position[0]) * 0.14;
    // A gentle sway keeps the emoji readable, unlike a full spin that turns it edge-on.
    group.current.rotation.y = Math.sin(time * 0.9 + position[0]) * 0.2;
    group.current.scale.setScalar((winner ? 1.16 : 1) + Math.sin(time * 2.1) * 0.025);
  });

  return <group ref={group} position={position}>
    {/* The token is deliberately behind the emoji, so it cannot cut across it while floating. */}
    <mesh rotation-x={Math.PI / 2} position={[0, 0, -0.22]} castShadow>
      <cylinderGeometry args={[0.9, 0.9, 0.24, 48]} />
      <meshStandardMaterial color={color} emissive={glow} emissiveIntensity={winner ? 0.95 : 0.35} metalness={0.55} roughness={0.25} />
    </mesh>
    <sprite position={[0, 0, 0.16]} scale={[1.48, 1.48, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  </group>;
}

function useEmojiTexture(emoji) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    context.font = '330px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emoji, 256, 272);
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    return nextTexture;
  }, [emoji]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
