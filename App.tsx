
import React, { useState, useCallback, useEffect, useRef } from 'react';
import GameContainer from './components/GameContainer';
import HandTracker from './components/HandTracker';
import HUD from './components/HUD';
import VeoAnimator from './components/VeoAnimator';
import { HandState, MovementGesture, CombatGesture, GameState } from './types';

const App: React.FC = () => {
  const [handState, setHandState] = useState<HandState>({
    movement: MovementGesture.STOP,
    combat: CombatGesture.IDLE,
    leftHandPresent: false,
    rightHandPresent: false,
  });

  const [gameState, setGameState] = useState<GameState>({
    ammo: 10,
    score: 0,
    health: 100,
    isGameOver: false,
    isReloading: false,
    lastDamageTime: 0,
  });

  const [error, setError] = useState<string | null>(null);
  const [isVeoOpen, setIsVeoOpen] = useState(false);
  const stepCount = useRef(0);

  const HAPTIC_PATTERNS = {
    FIRE: [45],
    RELOAD: [50, 80, 50, 150, 100],
    DAMAGE_CRITICAL: [200, 100, 200, 100, 300],
    WALK_CONCRETE: [15],
    WALK_METAL: [10, 25, 10],
  };

  const triggerHaptic = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const handleHandUpdate = useCallback((newState: HandState) => {
    setHandState(newState);
  }, []);

  const handleScoreUpdate = useCallback((points: number) => {
    setGameState(prev => ({ ...prev, score: prev.score + points }));
  }, []);

  const handleShoot = useCallback(() => {
    setGameState(prev => {
      if (prev.ammo > 0 && !prev.isReloading) {
        triggerHaptic(HAPTIC_PATTERNS.FIRE);
        return { ...prev, ammo: prev.ammo - 1 };
      }
      return prev;
    });
  }, []);

  const handleReload = useCallback(() => {
    if (gameState.isReloading || gameState.ammo === 10) return;
    
    setGameState(prev => ({ ...prev, isReloading: true }));
    triggerHaptic(HAPTIC_PATTERNS.RELOAD);
    
    setTimeout(() => {
      setGameState(prev => ({ ...prev, ammo: 10, isReloading: false }));
    }, 1500);
  }, [gameState.isReloading, gameState.ammo]);

  const handleTakeDamage = useCallback((amount: number) => {
    setGameState(prev => {
      if (prev.health <= 0) return prev;
      triggerHaptic(HAPTIC_PATTERNS.DAMAGE_CRITICAL);
      const newHealth = Math.max(0, prev.health - amount);
      return { 
        ...prev, 
        health: newHealth, 
        lastDamageTime: Date.now(),
        isGameOver: newHealth <= 0
      };
    });
  }, []);

  useEffect(() => {
    if (handState.combat === CombatGesture.RELOAD) {
      handleReload();
    }
  }, [handState.combat, handleReload]);

  useEffect(() => {
    let interval: number;
    if (handState.movement !== MovementGesture.STOP && !gameState.isGameOver && !isVeoOpen) {
      interval = window.setInterval(() => {
        stepCount.current++;
        const stepCycle = stepCount.current % 16;
        const isOnMetal = stepCycle > 12;
        triggerHaptic(isOnMetal ? HAPTIC_PATTERNS.WALK_METAL : HAPTIC_PATTERNS.WALK_CONCRETE);
      }, 450);
    }
    return () => clearInterval(interval);
  }, [handState.movement, gameState.isGameOver, isVeoOpen]);

  return (
    <div className="relative w-full h-screen bg-neutral-900 overflow-hidden font-sans">
      {/* 3D Game World */}
      <GameContainer 
        handState={handState} 
        gameState={gameState}
        onShoot={handleShoot}
        onScore={handleScoreUpdate}
        onTakeDamage={handleTakeDamage}
      />

      {/* Veo Cinematic Generator Button */}
      <button 
        onClick={() => setIsVeoOpen(true)}
        className="absolute top-4 right-4 z-[60] bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg transition-all border border-white/20 active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
        CINEMATIC GEN
      </button>

      {/* Veo Modal */}
      {isVeoOpen && <VeoAnimator onClose={() => setIsVeoOpen(false)} />}

      {/* Hand Tracking Overlay & Camera Feed */}
      <div className="absolute bottom-4 right-4 w-64 h-48 border-2 border-white/20 rounded-lg overflow-hidden bg-black/50 shadow-2xl z-50">
        <HandTracker onUpdate={handleHandUpdate} onError={setError} />
      </div>

      {/* Camera Error Modal */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-[110] p-6 text-center">
          <div className="max-w-md">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Camera Error</h2>
            <p className="text-white/80 mb-6">{error}</p>
            <p className="text-sm text-white/40 mb-6">This prototype requires a webcam for gesture control. Please ensure your camera is connected and permissions are granted.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 text-white font-bold rounded uppercase hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Damage Overlay */}
      {Date.now() - gameState.lastDamageTime < 300 && (
        <div className="absolute inset-0 pointer-events-none bg-red-600/20 z-40 animate-pulse border-[20px] border-red-900/40" />
      )}

      {/* Game Over Screen */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-[100] animate-in fade-in duration-500">
           <div className="text-center">
             <h1 className="text-8xl font-black text-red-600 italic tracking-tighter mb-4">Wasted</h1>
             <p className="text-white/60 mb-8">Score: {gameState.score}</p>
             <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-white text-black font-bold uppercase hover:bg-red-600 hover:text-white transition-all transform hover:scale-110"
             >
               Respawn
             </button>
           </div>
        </div>
      )}

      {/* Movement & Combat Zones Visualization */}
      <div className="absolute inset-0 pointer-events-none flex">
        <div className={`w-1/2 h-full border-r border-white/10 flex items-center justify-center transition-colors duration-300 ${handState.leftHandPresent ? 'bg-blue-500/5' : ''}`}>
           <span className="text-white/20 uppercase tracking-widest font-black text-4xl">Movement</span>
        </div>
        <div className={`w-1/2 h-full flex items-center justify-center transition-colors duration-300 ${handState.rightHandPresent ? 'bg-red-500/5' : ''}`}>
           <span className="text-white/20 uppercase tracking-widest font-black text-4xl">Combat</span>
        </div>
      </div>

      {/* HUD UI */}
      <HUD gameState={gameState} handState={handState} />

      {/* Credits */}
      <div className="absolute top-4 left-4 z-50">
        <div className="bg-black/40 backdrop-blur-sm px-3 py-1 border border-white/10 rounded text-[10px] font-bold text-white/60 tracking-widest uppercase">
          Projeto Criado por Matheus Siqueira
        </div>
      </div>

      {/* Startup Overlay */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/60 px-6 py-2 rounded-full border border-white/20 text-xs text-white/80 backdrop-blur-md z-40">
        GESTURE CONTROLS: LEFT HAND = MOVE (✋/👊) | RIGHT HAND = GUN (👉) + TRIGGER (👆)
      </div>
    </div>
  );
};

export default App;
