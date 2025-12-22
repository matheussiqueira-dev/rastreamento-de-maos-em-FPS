
import React, { useRef, useEffect, useState } from 'react';
import { HandState, MovementGesture, CombatGesture } from '../types';

interface HandTrackerProps {
  onUpdate: (state: HandState) => void;
  onError?: (message: string) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onUpdate, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastStateRef = useRef<HandState | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    // Use any casting for window to access MediaPipe global variables
    const hands = new (window as any).Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    const onResults = (results: any) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

      let newState: HandState = {
        movement: MovementGesture.STOP,
        combat: CombatGesture.IDLE,
        leftHandPresent: false,
        rightHandPresent: false,
      };

      if (results.multiHandLandmarks && results.multiHandedness) {
        const drawingUtils = window as any;
        results.multiHandLandmarks.forEach((landmarks: any, index: number) => {
          const handedness = results.multiHandedness[index].label; 
          const isActuallyLeft = handedness === 'Right'; 

          drawingUtils.drawConnectors(ctx, landmarks, (window as any).HAND_CONNECTIONS, { color: isActuallyLeft ? '#3b82f6' : '#ef4444', lineWidth: 2 });
          drawingUtils.drawLandmarks(ctx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 2 });

          const wrist = landmarks[0];
          
          if (wrist.x < 0.5) {
            newState.leftHandPresent = true;
            newState.movement = detectMovement(landmarks);
          } else {
            newState.rightHandPresent = true;
            newState.combat = detectCombat(landmarks);
          }
        });
      }

      if (JSON.stringify(lastStateRef.current) !== JSON.stringify(newState)) {
        onUpdate(newState);
        lastStateRef.current = newState;
      }
    };

    hands.onResults(onResults);

    let animationFrameId: number;
    const processFrame = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        await hands.send({ image: videoRef.current });
      }
      animationFrameId = requestAnimationFrame(processFrame);
    };

    const initCamera = async () => {
      try {
        // Try to get a stream with flexible constraints to avoid NotFoundError on some hardware
        const constraints = {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraActive(true);
            processFrame();
          };
        }
      } catch (err: any) {
        console.error("HandTracker Camera Error:", err);
        let message = "Could not access camera.";
        
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = "No camera device was found. Please check your hardware connection and ensure no other app is using the camera.";
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = "Camera access denied. Please allow camera permissions in your browser settings to play.";
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = "Camera is already in use by another application or tab.";
        } else if (err.message) {
          message = err.message;
        }
        
        if (onError) onError(message);
      }
    };

    initCamera();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onUpdate, onError]);

  const detectMovement = (landmarks: any): MovementGesture => {
    const wrist = landmarks[0];
    const isFist = [8, 12, 16, 20].every(idx => getDistance(landmarks[idx], landmarks[0]) < 0.15);
    if (isFist) return MovementGesture.STOP;

    const centerX = 0.25;
    const centerY = 0.5;
    const threshold = 0.08;

    if (wrist.y < centerY - threshold) return MovementGesture.FORWARD;
    if (wrist.y > centerY + threshold) return MovementGesture.BACKWARD;
    if (wrist.x < centerX - threshold) return MovementGesture.RIGHT; 
    if (wrist.x > centerX + threshold) return MovementGesture.LEFT;  

    return MovementGesture.STOP;
  };

  const detectCombat = (landmarks: any): CombatGesture => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexBase = landmarks[5];
    const middleTip = landmarks[12];

    const indexExtended = getDistance(indexTip, landmarks[0]) > 0.3;
    const middleExtended = getDistance(middleTip, landmarks[0]) > 0.3;
    const thumbUp = thumbTip.y < indexBase.y;
    const othersCurled = [16, 20].every(idx => getDistance(landmarks[idx], landmarks[0]) < 0.2);

    const isFullHand = [8, 12, 16, 20].every(idx => getDistance(landmarks[idx], landmarks[0]) > 0.3);
    if (isFullHand) return CombatGesture.RELOAD;

    if (indexExtended && thumbUp && othersCurled) {
      const indexCurvature = getDistance(indexTip, indexBase);
      if (indexCurvature < 0.12) return CombatGesture.FIRE;
      if (middleExtended) return CombatGesture.IRON_SIGHT;
      return CombatGesture.AIM;
    }

    return CombatGesture.IDLE;
  };

  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <video ref={videoRef} className="hidden" playsInline muted />
      {!cameraActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full object-cover scale-x-[-1]" width={640} height={480} />
    </div>
  );
};

export default HandTracker;
