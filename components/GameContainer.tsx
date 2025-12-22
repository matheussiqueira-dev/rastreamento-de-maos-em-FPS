
import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { Sky, Stars, Environment, PerspectiveCamera, Box, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { HandState, MovementGesture, CombatGesture, GameState, Target, EnemyAIState } from '../types';

// Extend the JSX namespace to include Three.js elements used by React Three Fiber
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

interface GameContainerProps {
  handState: HandState;
  gameState: GameState;
  onShoot: () => void;
  onScore: (points: number) => void;
  onTakeDamage: (amount: number) => void;
}

/**
 * Visualizes the path an enemy is currently following.
 * Renders a holographic dashed line on the ground.
 */
const PatrolPath: React.FC<{ start: [number, number, number]; end: [number, number, number] }> = ({ start, end }) => {
  const lineRef = useRef<THREE.Line>(null);

  const points = useMemo(() => {
    return [
      new THREE.Vector3(start[0], 0.1, start[2]),
      new THREE.Vector3(end[0], 0.1, end[2])
    ];
  }, [start, end]);

  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.geometry.setFromPoints(points);
      lineRef.current.computeLineDistances();
    }
  }, [points]);

  return (
    <line ref={lineRef as any}>
      <bufferGeometry />
      <lineDashedMaterial 
        color="#00ff88" 
        dashSize={0.5} 
        gapSize={0.3} 
        transparent 
        opacity={0.4} 
        depthWrite={false}
      />
    </line>
  );
};

const EnemyAIComponent: React.FC<{ 
  target: Target; 
  onHit: (id: string) => void;
  onEnemyShoot: () => void;
}> = ({ target, onHit, onEnemyShoot }) => {
  const meshRef = useRef<THREE.Group>(null);
  const eyeRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (!meshRef.current || target.state === EnemyAIState.DEAD) return;

    // Pulse animation - speed varies by state
    const pulseFreq = target.state === EnemyAIState.ATTACKING ? 10 : (target.state === EnemyAIState.ALERT ? 5 : 2);
    meshRef.current.position.y = target.position[1] + Math.sin(state.clock.elapsedTime * pulseFreq) * 0.15;
    
    // Rotation logic
    if (target.state === EnemyAIState.ALERT || target.state === EnemyAIState.ATTACKING) {
      // Look at player (camera)
      const lookPos = new THREE.Vector3(state.camera.position.x, meshRef.current.position.y, state.camera.position.z);
      meshRef.current.lookAt(lookPos);
      
      // Update eye color and intensity based on aggression
      if (eyeRef.current) {
        const color = target.state === EnemyAIState.ATTACKING ? '#ff0000' : '#ffff00';
        const intensity = target.state === EnemyAIState.ATTACKING ? 5 : 2;
        (eyeRef.current.material as THREE.MeshStandardMaterial).color.set(color);
        (eyeRef.current.material as THREE.MeshStandardMaterial).emissive.set(color);
        (eyeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity + Math.sin(state.clock.elapsedTime * pulseFreq) * 1.5;
      }
    } else {
      // Look towards patrol target
      const lookPos = new THREE.Vector3(target.targetPoint[0], meshRef.current.position.y, target.targetPoint[2]);
      meshRef.current.lookAt(lookPos);
      if (eyeRef.current) {
        (eyeRef.current.material as THREE.MeshStandardMaterial).color.set('#00ff00');
        (eyeRef.current.material as THREE.MeshStandardMaterial).emissive.set('#00ff00');
        (eyeRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0;
      }
    }
  });

  return (
    <group ref={meshRef} position={target.position} userData={{ isTarget: true, id: target.id }}>
      {/* Drone Body */}
      <mesh castShadow>
        <octahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Floating Rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.2, 0.05, 16, 32]} />
        <meshStandardMaterial color="#444" emissive="#111" />
      </mesh>
      {/* Eye Sensor */}
      <mesh ref={eyeRef} position={[0, 0, 0.6]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
      </mesh>
    </group>
  );
};

const Weapon: React.FC<{ combat: CombatGesture; isReloading: boolean }> = ({ combat, isReloading }) => {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const targetPos = new THREE.Vector3(0.5, -0.4, -0.8);
    if (combat === CombatGesture.IRON_SIGHT) targetPos.set(0, -0.25, -0.5);
    
    meshRef.current.position.lerp(targetPos, 0.1);
    
    if (combat === CombatGesture.FIRE) {
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, -0.4, 0.3);
    } else {
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.1);
    }

    if (isReloading) {
       meshRef.current.position.y -= 0.1;
       meshRef.current.rotation.z += 0.2;
    }
  });

  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.25, 0.6]} />
        <meshStandardMaterial color="#111" metalness={1} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.1, -0.3]}>
        <boxGeometry args={[0.1, 0.1, 0.8]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      {/* Laser Sight */}
      <mesh position={[0, 0.15, -0.7]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 15]} />
        <meshBasicMaterial color="red" transparent opacity={0.4} />
      </mesh>
    </group>
  );
};

const GameLogic: React.FC<GameContainerProps> = ({ handState, gameState, onShoot, onScore, onTakeDamage }) => {
  const { camera, raycaster, scene } = useThree();
  const [enemies, setEnemies] = useState<Target[]>([]);
  const lastShotTime = useRef(0);

  // AI & Movement Logic
  useFrame((state, delta) => {
    if (gameState.isGameOver) return;

    // Player Movement
    const moveSpeed = 6 * delta;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    const sideDirection = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    if (handState.movement === MovementGesture.FORWARD) camera.position.add(direction.multiplyScalar(moveSpeed));
    if (handState.movement === MovementGesture.BACKWARD) camera.position.add(direction.multiplyScalar(-moveSpeed));
    if (handState.movement === MovementGesture.LEFT) camera.position.add(sideDirection.multiplyScalar(moveSpeed));
    if (handState.movement === MovementGesture.RIGHT) camera.position.add(sideDirection.multiplyScalar(-moveSpeed));

    // Handle Enemy AI States
    setEnemies(prev => prev.map(enemy => {
      const enemyVec = new THREE.Vector3(...enemy.position);
      const distToPlayer = enemyVec.distanceTo(camera.position);
      
      let newState = enemy.state;
      let newPos = [...enemy.position] as [number, number, number];
      let newTargetPoint = [...enemy.targetPoint] as [number, number, number];
      let lastAction = enemy.lastActionTime;

      // State Transitions
      if (distToPlayer < 15) newState = EnemyAIState.ATTACKING;
      else if (distToPlayer < 30) newState = EnemyAIState.ALERT;
      else newState = EnemyAIState.PATROLLING;

      const playerPos = new THREE.Vector3(camera.position.x, enemy.position[1], camera.position.z);

      // Behavior Logic
      if (newState === EnemyAIState.PATROLLING) {
        // Slow, wandering patrol
        const targetVec = new THREE.Vector3(...newTargetPoint);
        const distToTarget = enemyVec.distanceTo(targetVec);
        if (distToTarget < 2) {
           newTargetPoint = [(Math.random() - 0.5) * 80, 1.5, (Math.random() - 0.5) * 80];
        } else {
           const moveDir = targetVec.sub(enemyVec).normalize();
           const patrolSpeed = 2.0 * delta;
           newPos = [
             enemy.position[0] + moveDir.x * patrolSpeed,
             enemy.position[1],
             enemy.position[2] + moveDir.z * patrolSpeed
           ];
        }
      } else if (newState === EnemyAIState.ALERT) {
        // Investigating: move quickly towards player position with minor lateral searching
        const towardsPlayer = playerPos.clone().sub(enemyVec).normalize();
        const lateralSearch = new THREE.Vector3(0, 1, 0).cross(towardsPlayer).multiplyScalar(Math.sin(state.clock.elapsedTime * 2) * 0.3);
        const alertMove = towardsPlayer.add(lateralSearch).normalize();
        const alertSpeed = 4.0 * delta;
        newPos = [
          enemy.position[0] + alertMove.x * alertSpeed,
          enemy.position[1],
          enemy.position[2] + alertMove.z * alertSpeed
        ];
      } else if (newState === EnemyAIState.ATTACKING) {
        // Tactical combat: strafing and distance maintenance
        const towardsPlayer = playerPos.clone().sub(enemyVec).normalize();
        const tangent = new THREE.Vector3(0, 1, 0).cross(towardsPlayer).normalize();
        
        // Strafe direction based on time, faster oscillations during attack
        const strafeDir = Math.sin(state.clock.elapsedTime * 1.5 + Number(enemy.id) % 10) > 0 ? 1 : -1;
        const combatMoveSpeed = 5.0 * delta;
        
        // Strategic distance maintenance (7-11 units)
        let approachStrength = 0;
        if (distToPlayer > 11) approachStrength = 1.2;
        if (distToPlayer < 7) approachStrength = -1.2;
        
        const velocity = tangent.multiplyScalar(strafeDir).add(towardsPlayer.multiplyScalar(approachStrength)).normalize();
        
        newPos = [
          enemy.position[0] + velocity.x * combatMoveSpeed,
          enemy.position[1],
          enemy.position[2] + velocity.z * combatMoveSpeed
        ];

        // Attack logic: shoot more frequently when attacking
        if (Date.now() - lastAction > 1800) {
          onTakeDamage(15);
          lastAction = Date.now();
        }
      }

      return { ...enemy, state: newState, position: newPos, targetPoint: newTargetPoint, lastActionTime: lastAction };
    }));

    // Player Shooting Logic
    if (handState.combat === CombatGesture.FIRE && gameState.ammo > 0 && !gameState.isReloading) {
      const now = Date.now();
      if (now - lastShotTime.current > 250) {
        onShoot();
        lastShotTime.current = now;

        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        const hit = intersects.find(i => {
          let p = i.object.parent;
          while(p) {
            if(p.userData?.isTarget) return true;
            p = p.parent;
          }
          return false;
        });
        
        if (hit) {
          let p = hit.object.parent;
          while(p && !p.userData?.isTarget) p = p.parent;
          const targetId = p?.userData?.id;
          
          onScore(500);
          setEnemies(prev => prev.filter(e => e.id !== targetId));
        }
      }
    }
  });

  // Spawn Enemies
  useEffect(() => {
    const interval = setInterval(() => {
      if (enemies.length < 6 && !gameState.isGameOver) {
        const id = Math.random().toString();
        const angle = Math.random() * Math.PI * 2;
        const radius = 35 + Math.random() * 20;
        setEnemies(prev => [...prev, {
          id,
          position: [Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius],
          health: 100,
          state: EnemyAIState.PATROLLING,
          targetPoint: [(Math.random() - 0.5) * 60, 1.5, (Math.random() - 0.5) * 60],
          lastActionTime: Date.now()
        }]);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [enemies, gameState.isGameOver]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.6, 5]} />
      {!gameState.isGameOver && (
        <Weapon combat={handState.combat} isReloading={gameState.isReloading} />
      )}
      
      {enemies.map(e => (
        <React.Fragment key={e.id}>
          <EnemyAIComponent 
            target={e} 
            onHit={() => {}} 
            onEnemyShoot={() => onTakeDamage(10)} 
          />
          {/* Path Visualization: Only shown when patrolling */}
          {e.state === EnemyAIState.PATROLLING && (
            <PatrolPath start={e.position} end={e.targetPoint} />
          )}
        </React.Fragment>
      ))}

      {/* Environment */}
      <Sky sunPosition={[100, 20, 100]} />
      <Stars radius={150} depth={50} count={7000} factor={4} saturation={0} fade speed={2} />
      <Environment preset="night" />
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#4444ff" />

      {/* Grid Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
      <gridHelper args={[300, 150, "#222", "#080808"]} position={[0, 0.01, 0]} />
      
      {/* Distant Fog-like geometry */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <ringGeometry args={[100, 150, 64]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </>
  );
};

const GameContainer: React.FC<GameContainerProps> = (props) => {
  return (
    <div className="w-full h-full cursor-none">
      <Canvas shadows dpr={[1, 2]}>
        <Suspense fallback={null}>
          <GameLogic {...props} />
        </Suspense>
      </Canvas>
      
      {/* Crosshair */}
      {!props.gameState.isGameOver && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className={`w-12 h-12 border-2 rounded-full flex items-center justify-center transition-all duration-300 ${props.handState.combat === CombatGesture.AIM || props.handState.combat === CombatGesture.IRON_SIGHT ? 'scale-[0.4] border-cyan-400 rotate-45' : 'scale-100 border-white/20'}`}>
            <div className="w-[2px] h-5 bg-white/50 absolute -top-3" />
            <div className="w-[2px] h-5 bg-white/50 absolute -bottom-3" />
            <div className="w-5 h-[2px] bg-white/50 absolute -left-3" />
            <div className="w-5 h-[2px] bg-white/50 absolute -right-3" />
            <div className={`w-1.5 h-1.5 bg-white rounded-full transition-transform duration-100 ${props.handState.combat === CombatGesture.FIRE ? 'scale-[6] bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]' : ''}`} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GameContainer;
