import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  CombatGesture,
  EnemyAIState,
  GameState,
  GameStatus,
  HandState,
  MovementGesture,
  Target,
} from '../types';
import { DIFFICULTY_PROFILES, WAVE_ENEMY_STEP } from '../config/gameConfig';
import { TurnAxis } from '../domain/keyboard-input';

interface GameContainerProps {
  handState: HandState;
  /** Giro horizontal da câmera (modo teclado). O rastreamento de gestos não gira a câmera. */
  turn: TurnAxis;
  gameState: GameState;
  isMotionReduced: boolean;
  isPerformanceMode: boolean;
  onShoot: (didHit: boolean) => void;
  onEnemyDefeated: (points: number) => void;
  onTakeDamage: (amount: number) => void;
  onWaveChange: (wave: number) => void;
}

const WORLD_LIMIT = 95;
const PLAYER_HEIGHT = 1.6;
const BASE_MOVE_SPEED = 6;
const WEAPON_COOLDOWN_MS = 240;
const TURN_SPEED_RADIANS = 2.2;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ENEMY_SYNC_INTERVAL_SECONDS = 0.1;

const clampPosition = (position: THREE.Vector3) => {
  position.x = THREE.MathUtils.clamp(position.x, -WORLD_LIMIT, WORLD_LIMIT);
  position.z = THREE.MathUtils.clamp(position.z, -WORLD_LIMIT, WORLD_LIMIT);
};

const nextEnemyId = () => `enemy-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const toTuple = (vector: THREE.Vector3): [number, number, number] => [vector.x, vector.y, vector.z];

const createEnemy = (cameraPos: THREE.Vector3, wave: number): Target => {
  const angle = Math.random() * Math.PI * 2;
  const radius = 28 + Math.random() * 20 + Math.min(15, wave * 1.5);
  const position = new THREE.Vector3(
    cameraPos.x + Math.cos(angle) * radius,
    PLAYER_HEIGHT,
    cameraPos.z + Math.sin(angle) * radius,
  );
  clampPosition(position);

  const targetPoint = new THREE.Vector3(
    position.x + (Math.random() - 0.5) * 28,
    PLAYER_HEIGHT,
    position.z + (Math.random() - 0.5) * 28,
  );
  clampPosition(targetPoint);

  return {
    id: nextEnemyId(),
    position: toTuple(position),
    health: 100,
    state: EnemyAIState.PATROLLING,
    targetPoint: toTuple(targetPoint),
    lastActionTime: performance.now(),
    strafeSeed: Math.random() * Math.PI * 2,
  };
};

const renderSafeCopy = (enemy: Target): Target => ({
  ...enemy,
  position: [...enemy.position] as [number, number, number],
  targetPoint: [...enemy.targetPoint] as [number, number, number],
});

const PatrolPath: React.FC<{ start: [number, number, number]; end: [number, number, number] }> = ({
  start,
  end,
}) => {
  const { midpoint, quaternion, length } = useMemo(() => {
    const startPoint = new THREE.Vector3(start[0], 0.16, start[2]);
    const endPoint = new THREE.Vector3(end[0], 0.16, end[2]);
    const direction = endPoint.clone().sub(startPoint);
    const segmentLength = Math.max(0.001, direction.length());
    const unitDirection = direction.clone().normalize();
    const unitY = new THREE.Vector3(0, 1, 0);
    const segmentQuaternion = new THREE.Quaternion().setFromUnitVectors(unitY, unitDirection);

    return {
      midpoint: startPoint.clone().add(endPoint).multiplyScalar(0.5),
      quaternion: segmentQuaternion,
      length: segmentLength,
    };
  }, [start, end]);

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[0.035, 0.035, length, 10]} />
      <meshBasicMaterial color="#89e9ff" transparent opacity={0.24} />
    </mesh>
  );
};

const EnemyDrone: React.FC<{ enemy: Target; isMotionReduced: boolean }> = ({ enemy, isMotionReduced }) => {
  const groupRef = useRef<THREE.Group>(null);
  const eyeRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!groupRef.current || !eyeRef.current || enemy.state === EnemyAIState.DEAD) return;

    const pulseSpeed = enemy.state === EnemyAIState.ATTACKING ? 9 : enemy.state === EnemyAIState.ALERT ? 6 : 2.6;
    const pulseAmplitude = isMotionReduced ? 0.02 : 0.09;
    groupRef.current.position.y = enemy.position[1] + Math.sin(state.clock.elapsedTime * pulseSpeed) * pulseAmplitude;

    const eyeMaterial = eyeRef.current.material as THREE.MeshStandardMaterial;
    if (enemy.state === EnemyAIState.ATTACKING) {
      eyeMaterial.color.set('#ff4739');
      eyeMaterial.emissive.set('#ff4739');
      eyeMaterial.emissiveIntensity = 4;
    } else if (enemy.state === EnemyAIState.ALERT) {
      eyeMaterial.color.set('#ffc14d');
      eyeMaterial.emissive.set('#ffc14d');
      eyeMaterial.emissiveIntensity = 2.4;
    } else {
      eyeMaterial.color.set('#89e9ff');
      eyeMaterial.emissive.set('#89e9ff');
      eyeMaterial.emissiveIntensity = 1.2;
    }
  });

  return (
    <group ref={groupRef} position={enemy.position} userData={{ targetId: enemy.id }}>
      <mesh castShadow>
        <octahedronGeometry args={[0.78, 1]} />
        <meshStandardMaterial color="#1f2430" metalness={0.92} roughness={0.12} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.15, 0.055, 14, 40]} />
        <meshStandardMaterial color="#2f3747" emissive="#111822" />
      </mesh>
      <mesh ref={eyeRef} position={[0, 0, 0.58]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial color="#89e9ff" emissive="#89e9ff" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
};

const Weapon: React.FC<{ combat: CombatGesture; isReloading: boolean }> = ({ combat, isReloading }) => {
  const weaponRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!weaponRef.current) return;
    const targetPos = new THREE.Vector3(0.53, -0.43, -0.82);
    if (combat === CombatGesture.IRON_SIGHT) targetPos.set(0.08, -0.25, -0.52);
    weaponRef.current.position.lerp(targetPos, 0.12);

    const targetRotationX = combat === CombatGesture.FIRE ? -0.42 : 0;
    weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, targetRotationX, 0.24);

    if (isReloading) {
      weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0.6, 0.08);
      weaponRef.current.position.y = THREE.MathUtils.lerp(weaponRef.current.position.y, -0.72, 0.08);
    } else {
      weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, 0.1);
    }
  });

  return (
    <group ref={weaponRef}>
      <mesh>
        <boxGeometry args={[0.16, 0.25, 0.65]} />
        <meshStandardMaterial color="#171a20" metalness={1} roughness={0.09} />
      </mesh>
      <mesh position={[0, 0.1, -0.35]}>
        <boxGeometry args={[0.12, 0.1, 0.9]} />
        <meshStandardMaterial color="#0a0c11" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.155, -0.77]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 14]} />
        <meshBasicMaterial color="#ff6f61" transparent opacity={0.35} />
      </mesh>
    </group>
  );
};

const GameLogic: React.FC<GameContainerProps> = ({
  handState,
  turn,
  gameState,
  onShoot,
  onEnemyDefeated,
  onTakeDamage,
  onWaveChange,
  isMotionReduced,
  isPerformanceMode,
}) => {
  const { camera, raycaster, scene } = useThree();
  const enemiesRef = useRef<Target[]>([]);
  const [renderEnemies, setRenderEnemies] = useState<Target[]>([]);
  const spawnClockRef = useRef(0);
  const syncClockRef = useRef(0);
  const lastShotTimeRef = useRef(0);
  const killsRef = useRef(0);
  const waveRef = useRef(1);

  const profile = DIFFICULTY_PROFILES[gameState.difficulty];

  useEffect(() => {
    if (gameState.status === GameStatus.MENU) {
      enemiesRef.current = [];
      setRenderEnemies([]);
      spawnClockRef.current = 0;
      syncClockRef.current = 0;
      killsRef.current = 0;
      waveRef.current = 1;
      lastShotTimeRef.current = 0;
      camera.position.set(0, PLAYER_HEIGHT, 7);
      camera.lookAt(0, PLAYER_HEIGHT, -14);
    }
  }, [camera, gameState.status]);

  useEffect(() => {
    if (gameState.status !== GameStatus.PLAYING) return;
    if (enemiesRef.current.length > 0) return;

    for (let i = 0; i < 3; i += 1) {
      enemiesRef.current.push(createEnemy(camera.position.clone(), waveRef.current));
    }
    setRenderEnemies(enemiesRef.current.map(renderSafeCopy));
  }, [camera.position, gameState.status]);

  useFrame((state, delta) => {
    if (gameState.status !== GameStatus.PLAYING || gameState.isGameOver) return;

    const now = performance.now();
    if (turn !== 0) camera.rotateOnWorldAxis(WORLD_UP, -turn * TURN_SPEED_RADIANS * delta);

    const playerForward = new THREE.Vector3();
    camera.getWorldDirection(playerForward);
    playerForward.y = 0;
    playerForward.normalize();

    const playerRight = new THREE.Vector3().crossVectors(playerForward, new THREE.Vector3(0, 1, 0)).normalize();
    const speedModifier = handState.combat === CombatGesture.IRON_SIGHT ? 0.75 : 1;
    const moveSpeed = BASE_MOVE_SPEED * delta * speedModifier;

    if (handState.movement === MovementGesture.FORWARD) camera.position.add(playerForward.multiplyScalar(moveSpeed));
    if (handState.movement === MovementGesture.BACKWARD) camera.position.add(playerForward.multiplyScalar(-moveSpeed));
    if (handState.movement === MovementGesture.LEFT) camera.position.add(playerRight.multiplyScalar(-moveSpeed));
    if (handState.movement === MovementGesture.RIGHT) camera.position.add(playerRight.multiplyScalar(moveSpeed));

    camera.position.y = PLAYER_HEIGHT;
    clampPosition(camera.position);

    spawnClockRef.current += delta * 1000;
    const spawnInterval = Math.max(1100, profile.spawnIntervalMs - Math.floor((waveRef.current - 1) * 110));
    const dynamicMaxEnemies = profile.maxEnemies + Math.floor((waveRef.current - 1) / 2);

    if (spawnClockRef.current >= spawnInterval && enemiesRef.current.length < dynamicMaxEnemies) {
      enemiesRef.current.push(createEnemy(camera.position.clone(), waveRef.current));
      spawnClockRef.current = 0;
    }

    const playerPosition = new THREE.Vector3(camera.position.x, PLAYER_HEIGHT, camera.position.z);
    enemiesRef.current = enemiesRef.current.map((enemy) => {
      if (enemy.state === EnemyAIState.DEAD) return enemy;

      const enemyPosition = new THREE.Vector3(...enemy.position);
      const targetPoint = new THREE.Vector3(...enemy.targetPoint);
      const distanceToPlayer = enemyPosition.distanceTo(playerPosition);
      const attackRange = 11 + Math.min(5, waveRef.current * 0.4);
      const alertRange = 30 + Math.min(8, waveRef.current * 0.45);
      const baseSpeed = profile.enemySpeedScale * delta;

      let nextState = enemy.state;
      if (distanceToPlayer <= attackRange) nextState = EnemyAIState.ATTACKING;
      else if (distanceToPlayer <= alertRange) nextState = EnemyAIState.ALERT;
      else nextState = EnemyAIState.PATROLLING;

      if (nextState === EnemyAIState.PATROLLING) {
        const toTarget = targetPoint.clone().sub(enemyPosition);
        if (toTarget.length() < 1.5) {
          const patrolTarget = enemyPosition.clone().add(
            new THREE.Vector3((Math.random() - 0.5) * 24, 0, (Math.random() - 0.5) * 24),
          );
          clampPosition(patrolTarget);
          enemy.targetPoint = [patrolTarget.x, PLAYER_HEIGHT, patrolTarget.z];
        } else {
          toTarget.normalize();
          enemyPosition.add(toTarget.multiplyScalar(baseSpeed * 2.2));
        }
      } else if (nextState === EnemyAIState.ALERT) {
        const towardPlayer = playerPosition.clone().sub(enemyPosition).normalize();
        const sideSearch = new THREE.Vector3(0, 1, 0)
          .cross(towardPlayer)
          .multiplyScalar(Math.sin(state.clock.elapsedTime * 2 + enemy.strafeSeed) * 0.2);
        towardPlayer.add(sideSearch).normalize();
        enemyPosition.add(towardPlayer.multiplyScalar(baseSpeed * 4));
      } else if (nextState === EnemyAIState.ATTACKING) {
        const towardPlayer = playerPosition.clone().sub(enemyPosition).normalize();
        const tangent = new THREE.Vector3(0, 1, 0).cross(towardPlayer).normalize();
        const strafeDirection = Math.sin(state.clock.elapsedTime * 1.8 + enemy.strafeSeed) > 0 ? 1 : -1;
        let approachFactor = 0;
        if (distanceToPlayer > attackRange + 2) approachFactor = 1;
        if (distanceToPlayer < attackRange - 2) approachFactor = -1;

        const velocity = tangent.multiplyScalar(strafeDirection).add(towardPlayer.multiplyScalar(approachFactor));
        velocity.normalize();
        enemyPosition.add(velocity.multiplyScalar(baseSpeed * 5.6));

        if (now - enemy.lastActionTime > profile.enemyAttackCooldownMs) {
          onTakeDamage(profile.enemyDamage);
          enemy.lastActionTime = now;
        }
      }

      clampPosition(enemyPosition);
      enemy.position = [enemyPosition.x, PLAYER_HEIGHT, enemyPosition.z];
      enemy.state = nextState;
      return enemy;
    });

    if (handState.combat === CombatGesture.FIRE && gameState.ammo > 0 && !gameState.isReloading) {
      if (now - lastShotTimeRef.current > WEAPON_COOLDOWN_MS) {
        lastShotTimeRef.current = now;
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersections = raycaster.intersectObjects(scene.children, true);
        let hitEnemyId: string | null = null;

        for (const intersection of intersections) {
          let object: THREE.Object3D | null = intersection.object;
          while (object) {
            if (object.userData?.targetId) {
              hitEnemyId = object.userData.targetId;
              break;
            }
            object = object.parent;
          }
          if (hitEnemyId) break;
        }

        if (hitEnemyId) {
          enemiesRef.current = enemiesRef.current.filter((enemy) => enemy.id !== hitEnemyId);
          killsRef.current += 1;
          const score = Math.round(320 * profile.scoreMultiplier * (1 + (waveRef.current - 1) * 0.18));
          onEnemyDefeated(score);

          const expectedWave = Math.floor(killsRef.current / WAVE_ENEMY_STEP) + 1;
          if (expectedWave > waveRef.current) {
            waveRef.current = expectedWave;
            onWaveChange(expectedWave);
          }
          onShoot(true);
        } else {
          onShoot(false);
        }
      }
    }

    syncClockRef.current += delta;
    if (syncClockRef.current >= ENEMY_SYNC_INTERVAL_SECONDS) {
      syncClockRef.current = 0;
      setRenderEnemies(enemiesRef.current.map(renderSafeCopy));
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, PLAYER_HEIGHT, 7]} />
      {!gameState.isGameOver && <Weapon combat={handState.combat} isReloading={gameState.isReloading} />}

      {renderEnemies.map((enemy) => (
        <React.Fragment key={enemy.id}>
          <EnemyDrone enemy={enemy} isMotionReduced={isMotionReduced} />
          {enemy.state === EnemyAIState.PATROLLING ? <PatrolPath start={enemy.position} end={enemy.targetPoint} /> : null}
        </React.Fragment>
      ))}

      <Sky sunPosition={[100, 18, 100]} />
      <Stars
        radius={140}
        depth={42}
        count={isPerformanceMode ? 1200 : isMotionReduced ? 2600 : 4200}
        factor={isPerformanceMode ? 2.3 : 4}
        saturation={0}
        fade
        speed={isPerformanceMode ? 0.8 : 1.3}
      />
      <Environment preset="night" />

      <ambientLight intensity={isPerformanceMode ? 0.5 : 0.42} />
      <pointLight position={[8, 9, 6]} intensity={isPerformanceMode ? 1.1 : 1.4} color="#82a7ff" />
      {!isPerformanceMode ? (
        <spotLight position={[-14, 26, -10]} intensity={1} color="#7ce8ff" angle={0.6} penumbra={0.5} />
      ) : null}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#0f131b" roughness={1} metalness={0.04} />
      </mesh>
      <gridHelper args={[320, 180, '#2b3f5a', '#101822']} position={[0, 0.01, 0]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
        <ringGeometry args={[105, 165, 64]} />
        <meshBasicMaterial color="#05070d" />
      </mesh>
    </>
  );
};

const GameContainer: React.FC<GameContainerProps> = (props) => {
  const crosshairStateClass = props.handState.combat === CombatGesture.FIRE
    ? 'crosshair-fire'
    : props.handState.combat === CombatGesture.AIM || props.handState.combat === CombatGesture.IRON_SIGHT
      ? 'crosshair-aim'
      : 'crosshair-idle';

  return (
    <div className="game-canvas-shell" aria-label="Cena 3D do jogo">
      <Canvas shadows={!props.isPerformanceMode} dpr={props.isPerformanceMode ? [1, 1.2] : [1, 1.8]}>
        <Suspense fallback={null}>
          <GameLogic {...props} />
        </Suspense>
      </Canvas>

      {!props.gameState.isGameOver ? (
        <div className="crosshair-root" aria-hidden>
          <div className={`crosshair-ring ${crosshairStateClass}`}>
            <span />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GameContainer;
