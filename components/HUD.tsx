import React from 'react';
import { DIFFICULTY_PROFILES } from '../config/gameConfig';
import { CombatGesture, GameState, HandState } from '../types';

interface HUDProps {
  gameState: GameState;
  handState: HandState;
  sessionDurationMs: number;
  inputMode: 'GESTURE' | 'KEYBOARD';
}

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const HUD: React.FC<HUDProps> = ({ gameState, handState, sessionDurationMs, inputMode }) => {
  const isKeyboard = inputMode === 'KEYBOARD';
  const difficulty = DIFFICULTY_PROFILES[gameState.difficulty];
  const healthRatio = Math.max(0, Math.min(1, gameState.health / 100));
  const ammoRatio = Math.max(0, Math.min(1, gameState.ammo / gameState.maxAmmo));
  const accuracy = gameState.stats.shotsFired > 0
    ? (gameState.stats.shotsHit / gameState.stats.shotsFired) * 100
    : 0;
  const lowHealth = gameState.health <= 28;

  return (
    <section className="hud-layer" aria-label="Painel tático" aria-live="off">
      <div className="hud-top-row">
        <article className="hud-card score-card">
          <small>Combat Score</small>
          <strong>{gameState.score.toLocaleString('pt-BR')}</strong>
          <p>
            Onda {gameState.wave} • {difficulty.label}
          </p>
        </article>

        <article className="hud-card signal-card">
          <div className="signal-grid">
            <div className={handState.leftHandPresent ? 'signal-item active-left' : 'signal-item'}>
              <small>{isKeyboard ? 'Movimento' : 'Mão Esquerda'}</small>
              <strong>{handState.movement}</strong>
            </div>
            <div className={handState.rightHandPresent ? 'signal-item active-right' : 'signal-item'}>
              <small>{isKeyboard ? 'Combate' : 'Mão Direita'}</small>
              <strong>{handState.combat}</strong>
            </div>
          </div>
        </article>
      </div>

      <div className="hud-bottom-row">
        <article className={lowHealth ? 'hud-card vitals-card danger' : 'hud-card vitals-card'}>
          <header>
            <small>Sinais Vitais</small>
            <strong>{gameState.health}%</strong>
          </header>
          <div className="meter-track" role="progressbar" aria-label="Vida do operador" aria-valuemin={0} aria-valuemax={100} aria-valuenow={gameState.health}>
            <div className="meter-fill health-fill" style={{ width: `${healthRatio * 100}%` }} />
          </div>
          <p>{lowHealth ? 'Estado crítico: evasão imediata recomendada.' : 'Condição estável para avanço.'}</p>
        </article>

        <article className="hud-card ammo-card">
          <header>
            <small>Munição</small>
            <strong>{gameState.isReloading ? 'Recarregando...' : `${gameState.ammo}/${gameState.maxAmmo}`}</strong>
          </header>
          <div
            className="meter-track"
            role="progressbar"
            aria-label="Munição disponível"
            aria-valuemin={0}
            aria-valuemax={gameState.maxAmmo}
            aria-valuenow={gameState.ammo}
          >
            <div className="meter-fill ammo-fill" style={{ width: `${ammoRatio * 100}%` }} />
          </div>
          <p>{gameState.isReloading ? 'Aguarde conclusão do ciclo.' : 'Cadência ativa.'}</p>
        </article>

        <article className="hud-card metrics-card">
          <small>Telemetria da Sessão</small>
          <div className="metric-row">
            <span>Tempo</span>
            <strong>{formatTime(sessionDurationMs)}</strong>
          </div>
          <div className="metric-row">
            <span>Precisão</span>
            <strong>{accuracy.toFixed(1)}%</strong>
          </div>
          <div className="metric-row">
            <span>Abates</span>
            <strong>{gameState.stats.enemiesDefeated}</strong>
          </div>
          <div className="metric-row">
            <span>Melhor sequência</span>
            <strong>{gameState.stats.bestStreak}</strong>
          </div>
          <div className="metric-row">
            <span>Estado de mira</span>
            <strong>{handState.combat === CombatGesture.IRON_SIGHT ? 'Precisão' : 'Padrão'}</strong>
          </div>
        </article>
      </div>
    </section>
  );
};

export default HUD;
