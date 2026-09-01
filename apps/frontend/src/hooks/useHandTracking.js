import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const DETECTION_INTERVAL_MS = 1000 / 15;

/** Camera processing stays in the browser. Only normalized landmarks leave the device. */
export function useHandTracking(onMotion) {
  const videoRef = useRef();
  const callbackRef = useRef(onMotion);
  const streamRef = useRef();
  const frameRef = useRef();
  const detectorRef = useRef();
  const lastSentRef = useRef(0);
  const lastDetectionRef = useRef(0);
  const lastGestureRef = useRef();
  // Three.js reads this directly in its render loop. Keeping landmarks out of
  // React state prevents a complete scene reconciliation for every detection.
  const landmarksRef = useRef();
  const [enabled, setEnabled] = useState(false);
  const [gesture, setGesture] = useState();
  const [error, setError] = useState('');

  useEffect(() => { callbackRef.current = onMotion; }, [onMotion]);
  useEffect(() => () => stopTracking(), []);

  async function startTracking() {
    try {
      setError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('A webcam exige HTTPS fora do localhost. Abra a URL iniciada com https:// e aceite o certificado local.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      detectorRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      lastDetectionRef.current = 0;
      lastSentRef.current = 0;
      setEnabled(true);
      trackFrame();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível acessar a webcam.');
      stopTracking();
    }
  }

  function trackFrame() {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || !streamRef.current) return;
    const now = performance.now();
    // detectForVideo is synchronous. Processing every animation frame makes
    // the rendering thread compete with MediaPipe and can cause WebGL flicker.
    // Fifteen detections per second are interpolated smoothly by Three.js.
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastDetectionRef.current >= DETECTION_INTERVAL_MS) {
      lastDetectionRef.current = now;
      const result = detector.detectForVideo(video, now);
      const hand = result.landmarks[0];
      if (hand) {
        const screenLandmarks = hand.map(({ x, y, z }) => [round(x), round(y), round(z)]);
        const worldHand = result.worldLandmarks?.[0];
        const worldLandmarks = worldHand
          ? worldHand.map(({ x, y, z }) => [round(x), round(y), round(z)])
          : screenLandmarks;
        // Handedness stays stable while fingertips cross during a fist. It is
        // used only to keep the 3D skeleton orientation consistent.
        const handedness = result.handedness?.[0]?.[0]?.categoryName;
        const pose = { screenLandmarks, worldLandmarks, handedness };
        const nextGesture = recognizeGesture(hand);
        landmarksRef.current = pose;
        if (lastGestureRef.current !== nextGesture) {
          lastGestureRef.current = nextGesture;
          setGesture(nextGesture);
        }
        // Eight small landmark packets per second are enough for smooth motion
        // while avoiding a request for every camera frame.
        if (now - lastSentRef.current >= 125) {
          lastSentRef.current = now;
          callbackRef.current?.(pose);
        }
      }
    }
    frameRef.current = requestAnimationFrame(trackFrame);
  }

  function stopTracking() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
    detectorRef.current?.close();
    detectorRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    if (videoRef.current) videoRef.current.srcObject = null;
    setEnabled(false);
    lastGestureRef.current = undefined;
    setGesture(undefined);
    landmarksRef.current = undefined;
  }

  return { videoRef, enabled, gesture, landmarksRef, error, startTracking, stopTracking };
}

function recognizeGesture(landmarks) {
  const extended = [8, 12, 16, 20].map((tip, index) => landmarks[tip].y < landmarks[[6, 10, 14, 18][index]].y);
  const count = extended.filter(Boolean).length;
  if (count >= 4) return 'paper';
  if (extended[0] && extended[1] && !extended[2] && !extended[3]) return 'scissors';
  if (count <= 1) return 'rock';
  return undefined;
}

function round(value) { return Math.round(value * 1000) / 1000; }
