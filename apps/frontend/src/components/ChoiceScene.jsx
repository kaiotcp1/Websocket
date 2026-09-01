import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const handModels = {
  local: '/models/webxr-hand-right.glb',
  opponent: '/models/webxr-hand-left.glb',
};

const jointChains = [
  ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
  ['wrist', 'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'],
  ['wrist', 'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'],
  ['wrist', 'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'],
  ['wrist', 'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'],
];

const landmarkSources = {
  wrist: { index: 0 },
  'thumb-metacarpal': { index: 1 },
  'thumb-phalanx-proximal': { index: 2 },
  'thumb-phalanx-distal': { index: 3 },
  'thumb-tip': { index: 4 },
  'index-finger-metacarpal': { between: [0, 5, 0.45] },
  'index-finger-phalanx-proximal': { index: 5 },
  'index-finger-phalanx-intermediate': { index: 6 },
  'index-finger-phalanx-distal': { index: 7 },
  'index-finger-tip': { index: 8 },
  'middle-finger-metacarpal': { between: [0, 9, 0.45] },
  'middle-finger-phalanx-proximal': { index: 9 },
  'middle-finger-phalanx-intermediate': { index: 10 },
  'middle-finger-phalanx-distal': { index: 11 },
  'middle-finger-tip': { index: 12 },
  'ring-finger-metacarpal': { between: [0, 13, 0.45] },
  'ring-finger-phalanx-proximal': { index: 13 },
  'ring-finger-phalanx-intermediate': { index: 14 },
  'ring-finger-phalanx-distal': { index: 15 },
  'ring-finger-tip': { index: 16 },
  'pinky-finger-metacarpal': { between: [0, 17, 0.45] },
  'pinky-finger-phalanx-proximal': { index: 17 },
  'pinky-finger-phalanx-intermediate': { index: 18 },
  'pinky-finger-phalanx-distal': { index: 19 },
  'pinky-finger-tip': { index: 20 },
};

/**
 * WebXR hands expose 25 standardized joints. MediaPipe exposes 21 points, so
 * four metacarpals are interpolated inside the palm before the pose is applied.
 */
export default function ChoiceScene({ localHandRef, remoteHandRef, result }) {
  return <div className="relative h-[26rem] overflow-hidden rounded-2xl border border-sky-300/25 bg-slate-950/70 sm:h-[30rem]">
    <span className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded bg-sky-400/15 px-3 py-1 text-xs font-black tracking-wider text-sky-300">VOCÊ</span>
    <span className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded bg-amber-300/15 px-3 py-1 text-xs font-black tracking-wider text-amber-300">OPONENTE</span>
    <Canvas
      camera={{ position: [0, 7.4, 4.8], fov: 39, near: 0.1, far: 50 }}
      dpr={1}
      gl={{ antialias: false, powerPreference: 'low-power' }}
      shadows
    >
      <color attach="background" args={['#07111f']} />
      <fog attach="fog" args={['#07111f', 9, 18]} />
      <CameraRig />
      <ambientLight intensity={1.35} />
      <hemisphereLight args={['#dbefff', '#102b24', 1.25]} />
      <directionalLight position={[3, 7, 5]} intensity={3.2} color="#fff4e8" castShadow shadow-mapSize={[512, 512]} />
      <pointLight position={[0, 2.5, -3]} intensity={10} color="#ffd8b4" />
      <TrucoTable />
      <RiggedHand landmarksRef={localHandRef} side="local" skinTone="#d8a17d" accent="#66c0f4" />
      <RiggedHand landmarksRef={remoteHandRef} side="opponent" skinTone="#c98c6d" accent="#f4c769" />
      {result && <ResultBeacon result={result} />}
    </Canvas>
  </div>;
}

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    // A slightly higher angle keeps curled fingers and the scissors silhouette
    // readable without losing the across-the-table card-game perspective.
    camera.position.set(0, 7.4, 4.8);
    camera.lookAt(0, -0.55, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function TrucoTable() {
  return <group>
    <mesh position={[0, -0.86, 0]} receiveShadow castShadow>
      <boxGeometry args={[7.4, 0.34, 5.35]} />
      <meshStandardMaterial color="#3a241a" roughness={0.72} metalness={0.08} />
    </mesh>
    <mesh position={[0, -0.66, 0]} receiveShadow>
      <boxGeometry args={[6.95, 0.12, 4.9]} />
      <meshStandardMaterial color="#12483b" roughness={0.96} />
    </mesh>
    <mesh position={[0, -0.585, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[2.2, 0.025]} />
      <meshBasicMaterial color="#6eb8a0" transparent opacity={0.32} />
    </mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.08, 0]} receiveShadow>
      <circleGeometry args={[11, 64]} />
      <meshStandardMaterial color="#08131c" roughness={1} />
    </mesh>
  </group>;
}

function RiggedHand({ landmarksRef, side, skinTone, accent }) {
  const isLocal = side === 'local';
  const gltf = useLoader(GLTFLoader, handModels[side]);
  const hand = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene]);
  const groupRef = useRef();
  const rig = useMemo(() => createRig(hand, isLocal ? 1 : -1), [hand, isLocal]);
  const targetPosition = useMemo(() => new THREE.Vector3(), []);
  const targetRotation = useMemo(() => new THREE.Euler(), []);

  useEffect(() => {
    hand.traverse((node) => {
      if (!node.isMesh) return;
      node.frustumCulled = false;
      node.castShadow = true;
      node.receiveShadow = true;
      node.material = node.material.clone();
      node.material.color.set(skinTone);
      // Low metalness and high roughness avoid the previous wax/jelly finish.
      node.material.metalness = 0;
      node.material.roughness = 0.76;
      node.material.side = THREE.DoubleSide;
      node.material.needsUpdate = true;
    });
  }, [hand, skinTone]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const baseZ = isLocal ? 1.75 : -1.75;
    const handSign = isLocal ? 1 : -1;
    const pose = resolvePose(landmarksRef.current);
    const wrist = pose?.screenLandmarks[0];

    targetPosition.set(
      wrist ? (wrist[0] - 0.5) * handSign * 0.52 : 0,
      wrist ? -0.22 + THREE.MathUtils.clamp(-wrist[2] * 0.16, -0.07, 0.12) : -0.22 + Math.sin(time * 0.8 + baseZ) * 0.01,
      wrist ? baseZ + (0.5 - wrist[1]) * handSign * 0.2 : baseZ,
    );
    groupRef.current.position.lerp(targetPosition, 1 - Math.exp(-delta * 5));

    const middleBase = wrist ? pose.screenLandmarks[9] : undefined;
    const tilt = middleBase ? Math.atan2(middleBase[0] - wrist[0], wrist[1] - middleBase[1]) : 0;
    targetRotation.set(0, handSign * tilt * 0.08, 0);
    groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotation.x, 5, delta);
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotation.y, 5, delta);
    groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, targetRotation.z, 5, delta);

    if (pose) applyHandPose(rig, pose.worldLandmarks, pose.handedness, delta);
  });

  return <group ref={groupRef}>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.365, 0]}>
      <ringGeometry args={[0.31, 0.39, 40]} />
      <meshBasicMaterial color={accent} transparent opacity={0.34} depthWrite={false} />
    </mesh>
    {/* The GLBs are mirrored: opposite Z rotations put both palms above the
        table while the shared Y rotation points both sets of fingers inward. */}
    <group scale={8.2} rotation-y={-Math.PI / 2}>
      <primitive object={hand} rotation-z={isLocal ? -Math.PI / 2 : Math.PI / 2} dispose={null} />
    </group>
  </group>;
}

function resolvePose(value) {
  if (isLandmarkSet(value)) return { screenLandmarks: value, worldLandmarks: value, handedness: undefined };
  if (!value || typeof value !== 'object') return undefined;
  const screenLandmarks = value.screenLandmarks;
  const worldLandmarks = value.worldLandmarks;
  if (!isLandmarkSet(screenLandmarks)) return undefined;
  return {
    screenLandmarks,
    worldLandmarks: isLandmarkSet(worldLandmarks) ? worldLandmarks : screenLandmarks,
    handedness: value.handedness,
  };
}

function isLandmarkSet(landmarks) {
  return Array.isArray(landmarks)
    && landmarks.length === 21
    && landmarks.every((point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite));
}

function createRig(hand, normalSign) {
  const bones = {};
  hand.traverse((node) => {
    if (node.isBone) bones[node.name] = node;
  });

  const parentNames = {};
  const childNames = {};
  jointChains.forEach((chain) => chain.forEach((name, index) => {
    if (index > 0) parentNames[name] = chain[index - 1];
    if (index < chain.length - 1 && (!childNames[name] || name !== 'wrist')) childNames[name] = chain[index + 1];
  }));
  // The middle metacarpal provides a stable forward axis for the wrist.
  childNames.wrist = 'middle-finger-metacarpal';

  const order = [...new Set(jointChains.flat())];
  const joints = Object.fromEntries(order.map((name) => {
    const bone = bones[name];
    if (!bone) throw new Error(`WebXR hand is missing required joint: ${name}`);
    const parentName = parentNames[name];
    const restPosition = bone.position.clone();
    const parentRestPosition = parentName ? bones[parentName].position : undefined;
    return [name, {
      name,
      bone,
      parentName,
      childName: childNames[name],
      restPosition,
      restQuaternion: bone.quaternion.clone(),
      restLength: parentRestPosition ? restPosition.distanceTo(parentRestPosition) : 0,
      targetPosition: restPosition.clone(),
      targetQuaternion: bone.quaternion.clone(),
      direction: new THREE.Vector3(),
      restTangent: new THREE.Vector3(),
      targetTangent: new THREE.Vector3(),
      restNormal: new THREE.Vector3(),
      targetNormal: new THREE.Vector3(),
      restFrameQuaternion: new THREE.Quaternion(),
      targetFrameQuaternion: new THREE.Quaternion(),
      orientationOffset: new THREE.Quaternion(),
    }];
  }));

  const rig = {
    joints,
    order,
    normalSign,
    widthMirror: undefined,
    sourceHandedness: undefined,
    sourcePoint: new THREE.Vector3(),
    parentSourcePoint: new THREE.Vector3(),
    palmForward: new THREE.Vector3(),
    palmAcross: new THREE.Vector3(),
    palmNormal: new THREE.Vector3(),
    palmOutward: new THREE.Vector3(),
    restWristOutward: new THREE.Vector3(),
    frameMatrix: new THREE.Matrix4(),
    frameXAxis: new THREE.Vector3(),
    frameYAxis: new THREE.Vector3(),
    frameZAxis: new THREE.Vector3(),
    swingQuaternion: new THREE.Quaternion(),
  };

  // The two official meshes use opposite geometric winding. Calibrating the
  // palm normal against the authored wrist orientation works for both sides.
  palmNormal(rig, 'restPosition');
  rig.restWristOutward.set(0, -1, 0).applyQuaternion(joints.wrist.restQuaternion);
  rig.outwardSign = Math.sign(rig.palmNormal.dot(rig.restWristOutward)) || 1;

  buildJointFrames(rig, 'restPosition', 'restTangent', 'restNormal', 'restFrameQuaternion');
  rig.order.forEach((name) => {
    const joint = rig.joints[name];
    // Keeps the model author's roll, especially the thumb, on top of the
    // stable frame reconstructed from MediaPipe points.
    joint.orientationOffset.copy(joint.restFrameQuaternion).invert().multiply(joint.restQuaternion);
  });
  return rig;
}

function applyHandPose(rig, landmarks, handedness, delta) {
  const widthMirror = resolveWidthMirror(rig, landmarks, handedness);

  rig.order.forEach((name) => {
    const joint = rig.joints[name];
    if (!joint.parentName) {
      joint.targetPosition.copy(joint.restPosition);
      return;
    }

    sourcePoint(landmarkSources[name], landmarks, rig.sourcePoint);
    sourcePoint(landmarkSources[joint.parentName], landmarks, rig.parentSourcePoint);
    const dx = rig.sourcePoint.x - rig.parentSourcePoint.x;
    const dy = rig.sourcePoint.y - rig.parentSourcePoint.y;
    const dz = rig.sourcePoint.z - rig.parentSourcePoint.z;
    // MediaPipe uses smaller Z values for points closer to the camera. The
    // WebXR mesh uses -Y as the palm-facing normal, so the previous minus sign
    // folded a fist through the back of the hand instead of into the palm.
    joint.direction.set(dz * 0.78 * rig.normalSign, dy, dx * widthMirror);

    if (joint.direction.lengthSq() < 1e-8) {
      joint.direction.subVectors(joint.restPosition, rig.joints[joint.parentName].restPosition);
    }
    joint.direction.normalize();

    const parent = rig.joints[joint.parentName];
    if (parent.parentName && parent.direction.lengthSq() > 0) {
      constrainDirection(joint.direction, parent.direction, name.startsWith('thumb') ? 1.75 : 1.65);
    }
    joint.targetPosition.copy(parent.targetPosition).addScaledVector(joint.direction, joint.restLength);
  });

  // Transporting one frame along each finger avoids the unstable 180-degree
  // shortest-path rotation that previously twisted closed fingers into loops.
  buildJointFrames(rig, 'targetPosition', 'targetTangent', 'targetNormal', 'targetFrameQuaternion');

  const smoothing = 1 - Math.exp(-delta * 10);
  rig.order.forEach((name) => {
    const joint = rig.joints[name];
    joint.targetQuaternion.copy(joint.targetFrameQuaternion).multiply(joint.orientationOffset);
    joint.bone.position.lerp(joint.targetPosition, smoothing);
    joint.bone.quaternion.slerp(joint.targetQuaternion, smoothing);
  });
}

function resolveWidthMirror(rig, landmarks, handedness) {
  const normalizedHandedness = typeof handedness === 'string' ? handedness.toLowerCase() : undefined;
  if (normalizedHandedness && rig.sourceHandedness !== normalizedHandedness) {
    rig.sourceHandedness = normalizedHandedness;
    rig.widthMirror = undefined;
  }
  if (rig.widthMirror) return rig.widthMirror;

  // MCP joints 5 and 17 stay on their respective sides of the palm even in a
  // fist. Fingertips do not: the thumb crosses the palm and used to flip the
  // complete skeleton between mirrored poses.
  const sourceAcross = landmarks[5][0] - landmarks[17][0];
  const restAcross = rig.joints['index-finger-phalanx-proximal'].restPosition.z
    - rig.joints['pinky-finger-phalanx-proximal'].restPosition.z;
  if (Math.abs(sourceAcross) > 1e-4) {
    rig.widthMirror = Math.sign(sourceAcross * restAcross) || 1;
  }
  return rig.widthMirror ?? 1;
}

function buildJointFrames(rig, positionProperty, tangentProperty, normalProperty, quaternionProperty) {
  palmNormal(rig, positionProperty);
  rig.palmOutward.copy(rig.palmNormal).multiplyScalar(rig.outwardSign);

  const wrist = rig.joints.wrist;
  const middleMetacarpal = rig.joints['middle-finger-metacarpal'];
  wrist[tangentProperty].subVectors(middleMetacarpal[positionProperty], wrist[positionProperty]).normalize();
  wrist[normalProperty].copy(rig.palmOutward);
  projectNormal(wrist[normalProperty], wrist[tangentProperty], rig.palmAcross);
  frameQuaternion(rig, wrist[tangentProperty], wrist[normalProperty], wrist[quaternionProperty]);

  jointChains.forEach((chain) => {
    let previousTangent = wrist[tangentProperty];
    let previousNormal = wrist[normalProperty];

    for (let index = 1; index < chain.length; index += 1) {
      const joint = rig.joints[chain[index]];
      const directionStart = joint.childName ? joint : rig.joints[joint.parentName];
      const directionEnd = joint.childName ? rig.joints[joint.childName] : joint;

      joint[tangentProperty]
        .subVectors(directionEnd[positionProperty], directionStart[positionProperty])
        .normalize();
      rig.swingQuaternion.setFromUnitVectors(previousTangent, joint[tangentProperty]);
      joint[normalProperty].copy(previousNormal).applyQuaternion(rig.swingQuaternion);
      projectNormal(joint[normalProperty], joint[tangentProperty], rig.palmOutward);
      frameQuaternion(rig, joint[tangentProperty], joint[normalProperty], joint[quaternionProperty]);

      previousTangent = joint[tangentProperty];
      previousNormal = joint[normalProperty];
    }
  });
}

function palmNormal(rig, positionProperty) {
  const wrist = rig.joints.wrist[positionProperty];
  const middle = rig.joints['middle-finger-phalanx-proximal'][positionProperty];
  const index = rig.joints['index-finger-phalanx-proximal'][positionProperty];
  const pinky = rig.joints['pinky-finger-phalanx-proximal'][positionProperty];

  rig.palmForward.subVectors(middle, wrist).normalize();
  rig.palmAcross.subVectors(index, pinky);
  rig.palmAcross.addScaledVector(rig.palmForward, -rig.palmAcross.dot(rig.palmForward)).normalize();
  rig.palmNormal.crossVectors(rig.palmForward, rig.palmAcross).normalize();
}

function projectNormal(normal, tangent, fallback) {
  normal.addScaledVector(tangent, -normal.dot(tangent));
  if (normal.lengthSq() < 1e-8) {
    normal.copy(fallback).addScaledVector(tangent, -fallback.dot(tangent));
  }
  normal.normalize();
}

function frameQuaternion(rig, tangent, outward, target) {
  // WebXR joint convention: -Z follows the bone away from the wrist and -Y
  // points out of the skin. The generated basis is an absolute Armature pose.
  rig.frameZAxis.copy(tangent).negate();
  rig.frameYAxis.copy(outward).negate();
  rig.frameXAxis.crossVectors(rig.frameYAxis, rig.frameZAxis).normalize();
  rig.frameYAxis.crossVectors(rig.frameZAxis, rig.frameXAxis).normalize();
  rig.frameMatrix.makeBasis(rig.frameXAxis, rig.frameYAxis, rig.frameZAxis);
  target.setFromRotationMatrix(rig.frameMatrix);
}

function sourcePoint(source, landmarks, target) {
  if ('index' in source) return target.fromArray(landmarks[source.index]);
  const [from, to, ratio] = source.between;
  const first = landmarks[from];
  const second = landmarks[to];
  target.set(
    THREE.MathUtils.lerp(first[0], second[0], ratio),
    THREE.MathUtils.lerp(first[1], second[1], ratio),
    THREE.MathUtils.lerp(first[2], second[2], ratio),
  );
  return target;
}

function constrainDirection(direction, parentDirection, maximumAngle) {
  const angle = direction.angleTo(parentDirection);
  if (angle <= maximumAngle) return;
  direction.copy(parentDirection).lerp(direction, maximumAngle / angle).normalize();
}

function ResultBeacon({ result }) {
  const mesh = useRef();
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.scale.setScalar(1 + Math.sin(state.clock.getElapsedTime() * 3) * 0.08);
  });
  const color = result === 'Empate!' ? '#f4c769' : result === 'Você venceu!' ? '#66c0f4' : '#ed7f9d';
  return <mesh ref={mesh} position={[0, 0.35, 0]}>
    <icosahedronGeometry args={[0.15, 2]} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
  </mesh>;
}
