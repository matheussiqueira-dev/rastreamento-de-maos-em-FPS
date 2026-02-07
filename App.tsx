import React, { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import CalibrationPanel from './components/CalibrationPanel';
import HandTracker from './components/HandTracker';
import HelpPanel from './components/HelpPanel';
import HUD from './components/HUD';
import {
  BASE_AMMO,
  DEFAULT_HAND_STATE,
  DEFAULT_TRACKER_CALIBRATION,
  DIFFICULTY_PROFILES,
  HAPTIC_PATTERNS,
  MAX_HEALTH,
} from './config/gameConfig';
import {
  CombatGesture,
  DifficultyLevel,
  GameState,
  GameStatus,
  HandState,
  MatchStats,
  MovementGesture,
  TrackerCalibration,
} from './types';
import { usePersistentState } from './hooks/usePersistentState';

const createBaseStats = (): MatchStats => ({
  shotsFired: 0,
  shotsHit: 0,
  enemiesDefeated: 0,
  highestWave: 1,
  currentStreak: 0,
  bestStreak: 0,
  sessionStartedAt: null,
  sessionEndedAt: null,
});

const createInitialState = (difficulty: DifficultyLevel = 'TACTICAL'): GameState => ({
  ammo: BASE_AMMO,
  maxAmmo: BASE_AMMO,
  score: 0,
  health: MAX_HEALTH,
  status: GameStatus.MENU,
  isReloading: false,
  lastDamageTime: 0,
  isGameOver: false,
  wave: 1,
  difficulty,
  stats: createBaseStats(),
});

type GameAction =
  | { type: 'START_MATCH'; difficulty: DifficultyLevel; startedAt: number }
  | { type: 'RETURN_MENU'; difficulty: DifficultyLevel }
  | { type: 'PAUSE_MATCH' }
  | { type: 'RESUME_MATCH' }
  | { type: 'REGISTER_SHOT'; didHit: boolean }
  | { type: 'RELOAD_START' }
  | { type: 'RELOAD_COMPLETE' }
  | { type: 'TAKE_DAMAGE'; amount: number; at: number }
  | { type: 'ENEMY_DEFEATED'; points: number }
  | { type: 'SET_WAVE'; wave: number; at: number };

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'START_MATCH':
      return {
        ...createInitialState(action.difficulty),
        status: GameStatus.PLAYING,
        difficulty: action.difficulty,
        stats: {
          ...createBaseStats(),
          sessionStartedAt: action.startedAt,
        },
      };
    case 'RETURN_MENU':
      return createInitialState(action.difficulty);
    case 'PAUSE_MATCH':
      if (state.status !== GameStatus.PLAYING) return state;
      return { ...state, status: GameStatus.PAUSED };
    case 'RESUME_MATCH':
      if (state.status !== GameStatus.PAUSED) return state;
      return { ...state, status: GameStatus.PLAYING };
    case 'REGISTER_SHOT':
      if (state.status !== GameStatus.PLAYING || state.isReloading || state.ammo <= 0) return state;
      return {
        ...state,
        ammo: state.ammo - 1,
        stats: {
          ...state.stats,
          shotsFired: state.stats.shotsFired + 1,
          shotsHit: state.stats.shotsHit + (action.didHit ? 1 : 0),
          currentStreak: action.didHit ? state.stats.currentStreak + 1 : 0,
          bestStreak: action.didHit
            ? Math.max(state.stats.bestStreak, state.stats.currentStreak + 1)
            : state.stats.bestStreak,
        },
      };
    case 'RELOAD_START':
      if (state.isReloading || state.ammo === state.maxAmmo || state.status !== GameStatus.PLAYING) return state;
      return { ...state, isReloading: true };
    case 'RELOAD_COMPLETE':
      if (!state.isReloading) return state;
      return { ...state, isReloading: false, ammo: state.maxAmmo };
    case 'TAKE_DAMAGE': {
      if (state.status !== GameStatus.PLAYING || state.health <= 0) return state;
      const newHealth = Math.max(0, state.health - action.amount);
      const defeated = newHealth <= 0;
      return {
        ...state,
        health: newHealth,
        lastDamageTime: action.at,
        status: defeated ? GameStatus.GAMEOVER : state.status,
        isGameOver: defeated,
        stats: defeated
          ? {
              ...state.stats,
              sessionEndedAt: action.at,
            }
          : state.stats,
      };
    }
    case 'ENEMY_DEFEATED':
      if (state.status !== GameStatus.PLAYING) return state;
      return {
        ...state,
        score: state.score + action.points,
        stats: {
          ...state.stats,
          enemiesDefeated: state.stats.enemiesDefeated + 1,
        },
      };
    case 'SET_WAVE':
      if (state.status === GameStatus.MENU) return state;
      return {
        ...state,
        wave: action.wave,
        stats: {
          ...state.stats,
          highestWave: Math.max(action.wave, state.stats.highestWave),
          sessionEndedAt: state.status === GameStatus.GAMEOVER ? action.at : state.stats.sessionEndedAt,
        },
      };
    default:
      return state;
  }
};

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const CinematicGenerator = React.lazy(() => import('./components/CinematicGenerator'));
const GameContainer = React.lazy(() => import('./components/GameContainer'));

const STORAGE_KEYS = {
  difficulty: 'gesturestrike:settings:difficulty',
  haptics: 'gesturestrike:settings:haptics',
  reduceMotion: 'gesturestrike:settings:reduceMotion',
  performanceMode: 'gesturestrike:settings:performanceMode',
  calibration: 'gesturestrike:settings:calibration',
} as const;

interface UXToast {
  id: number;
  tone: 'info' | 'success';
  title: string;
  description: string;
}

const isDifficultyLevel = (value: unknown): value is DifficultyLevel =>
  value === 'CASUAL' || value === 'TACTICAL' || value === 'INSANE';

const isTrackerCalibration = (value: unknown): value is TrackerCalibration => {
  if (!value || typeof value !== 'object') return false;
  const calibration = value as Record<string, unknown>;
  return (
    typeof calibration.movementCenterX === 'number' &&
    typeof calibration.movementCenterY === 'number' &&
    typeof calibration.movementDeadzone === 'number' &&
    typeof calibration.fistStopThreshold === 'number' &&
    typeof calibration.indexExtendedThreshold === 'number' &&
    typeof calibration.fireCurlThreshold === 'number' &&
    typeof calibration.openHandThreshold === 'number' &&
    typeof calibration.smoothingFrames === 'number'
  );
};

const App: React.FC = () => {
  const [selectedDifficulty, setSelectedDifficulty] = usePersistentState<DifficultyLevel>(
    STORAGE_KEYS.difficulty,
    'TACTICAL',
    { validate: isDifficultyLevel },
  );
  const [gameState, dispatch] = useReducer(gameReducer, createInitialState(selectedDifficulty));
  const [handState, setHandState] = useState<HandState>(DEFAULT_HAND_STATE);
  const [trackerCalibration, setTrackerCalibration] = usePersistentState<TrackerCalibration>(
    STORAGE_KEYS.calibration,
    DEFAULT_TRACKER_CALIBRATION,
    { validate: isTrackerCalibration },
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCinematicOpen, setIsCinematicOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = usePersistentState<boolean>(STORAGE_KEYS.haptics, true);
  const [reduceMotion, setReduceMotion] = usePersistentState<boolean>(
    STORAGE_KEYS.reduceMotion,
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  const [performanceMode, setPerformanceMode] = usePersistentState<boolean>(STORAGE_KEYS.performanceMode, false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [isDamageFlashVisible, setIsDamageFlashVisible] = useState(false);
  const [uxToast, setUxToast] = useState<UXToast | null>(null);
  const stepCycleRef = useRef(0);
  const reloadTimeoutRef = useRef<number | null>(null);
  const firstRenderRef = useRef(true);

  const triggerHaptic = useCallback(
    (pattern: number | readonly number[]) => {
      if (!hapticsEnabled) return;
      if ('vibrate' in navigator) {
        const vibratePattern: VibratePattern = typeof pattern === 'number' ? pattern : Array.from(pattern);
        navigator.vibrate(vibratePattern);
      }
    },
    [hapticsEnabled],
  );

  const pushToast = useCallback((tone: UXToast['tone'], title: string, description: string) => {
    setUxToast({
      id: Date.now(),
      tone,
      title,
      description,
    });
  }, []);

  const applyPreset = useCallback(
    (preset: 'COMPETITIVE' | 'COMFORT') => {
      if (preset === 'COMPETITIVE') {
        setHapticsEnabled(true);
        setReduceMotion(false);
        setPerformanceMode(false);
        pushToast('success', 'Preset competitivo aplicado', 'Maior fidelidade visual e feedback háptico ativado.');
        return;
      }

      setHapticsEnabled(false);
      setReduceMotion(true);
      setPerformanceMode(true);
      pushToast('success', 'Preset conforto aplicado', 'Movimento reduzido e modo performance ativados.');
    },
    [pushToast, setHapticsEnabled, setPerformanceMode, setReduceMotion],
  );

  const startMatch = useCallback(() => {
    dispatch({ type: 'START_MATCH', difficulty: selectedDifficulty, startedAt: Date.now() });
    setCameraError(null);
    setIsHelpOpen(false);
  }, [selectedDifficulty]);

  const returnToMenu = useCallback(() => {
    dispatch({ type: 'RETURN_MENU', difficulty: selectedDifficulty });
    setIsCalibrationOpen(false);
    setIsCinematicOpen(false);
    setIsHelpOpen(false);
    setHandState(DEFAULT_HAND_STATE);
  }, [selectedDifficulty]);

  const pauseMatch = useCallback(() => dispatch({ type: 'PAUSE_MATCH' }), []);
  const resumeMatch = useCallback(() => dispatch({ type: 'RESUME_MATCH' }), []);

  const handleReload = useCallback(() => {
    if (reloadTimeoutRef.current) return;
    dispatch({ type: 'RELOAD_START' });
    triggerHaptic(HAPTIC_PATTERNS.RELOAD);
    reloadTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: 'RELOAD_COMPLETE' });
      reloadTimeoutRef.current = null;
    }, 1400);
  }, [triggerHaptic]);

  const handleShoot = useCallback(
    (didHit: boolean) => {
      dispatch({ type: 'REGISTER_SHOT', didHit });
      triggerHaptic(HAPTIC_PATTERNS.FIRE);
    },
    [triggerHaptic],
  );

  const handleEnemyDefeated = useCallback((points: number) => {
    dispatch({ type: 'ENEMY_DEFEATED', points });
  }, []);

  const handleWaveChange = useCallback((wave: number) => {
    dispatch({ type: 'SET_WAVE', wave, at: Date.now() });
  }, []);

  const handleTakeDamage = useCallback(
    (amount: number) => {
      dispatch({ type: 'TAKE_DAMAGE', amount, at: Date.now() });
      triggerHaptic(HAPTIC_PATTERNS.DAMAGE);
    },
    [triggerHaptic],
  );

  useEffect(() => {
    if (gameState.status !== GameStatus.PLAYING) return;
    if (handState.combat !== CombatGesture.RELOAD) return;
    handleReload();
  }, [gameState.status, handState.combat, handleReload]);

  useEffect(() => {
    if (gameState.status !== GameStatus.PLAYING || handState.movement === MovementGesture.STOP || isCinematicOpen) return;
    const interval = window.setInterval(() => {
      stepCycleRef.current += 1;
      const onHardSurface = stepCycleRef.current % 12 > 8;
      triggerHaptic(onHardSurface ? HAPTIC_PATTERNS.WALK_HARD : HAPTIC_PATTERNS.WALK_SOFT);
    }, 420);
    return () => window.clearInterval(interval);
  }, [gameState.status, handState.movement, triggerHaptic, isCinematicOpen]);

  useEffect(() => {
    if (gameState.status !== GameStatus.PLAYING && gameState.status !== GameStatus.PAUSED) return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [gameState.status]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingContext =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (isTypingContext) return;

      if (event.key.toLowerCase() === 'p') {
        if (gameState.status === GameStatus.PLAYING) pauseMatch();
        else if (gameState.status === GameStatus.PAUSED) resumeMatch();
      }

      if (event.key.toLowerCase() === 'c' && gameState.status === GameStatus.PLAYING) {
        setIsCalibrationOpen((previous) => !previous);
      }

      if (event.key.toLowerCase() === 'v' && gameState.status === GameStatus.PLAYING) {
        setIsCinematicOpen(true);
      }

      if (event.key.toLowerCase() === 'h' || event.key === '?') {
        setIsHelpOpen((previous) => !previous);
      }

      if (event.key === 'Escape') {
        setIsCinematicOpen(false);
        setIsCalibrationOpen(false);
        setIsHelpOpen(false);
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [gameState.status, pauseMatch, resumeMatch]);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    pushToast(
      'info',
      'Preferências atualizadas',
      `${hapticsEnabled ? 'Haptics on' : 'Haptics off'} • ${reduceMotion ? 'Motion reduzido' : 'Motion padrão'} • ${
        performanceMode ? 'Modo performance' : 'Modo visual completo'
      }`,
    );
  }, [hapticsEnabled, performanceMode, reduceMotion, pushToast]);

  useEffect(() => {
    if (!uxToast) return;
    const timeout = window.setTimeout(() => setUxToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [uxToast]);

  useEffect(
    () => () => {
      if (reloadTimeoutRef.current) {
        window.clearTimeout(reloadTimeoutRef.current);
      }
    },
    [],
  );

  const sessionDurationMs = useMemo(() => {
    const start = gameState.stats.sessionStartedAt;
    if (!start) return 0;
    const end = gameState.stats.sessionEndedAt ?? clockNow;
    return Math.max(0, end - start);
  }, [gameState.stats.sessionEndedAt, gameState.stats.sessionStartedAt, clockNow]);

  const matchAccuracy = useMemo(() => {
    if (gameState.stats.shotsFired === 0) return 0;
    return (gameState.stats.shotsHit / gameState.stats.shotsFired) * 100;
  }, [gameState.stats.shotsFired, gameState.stats.shotsHit]);
  const selectedProfile = DIFFICULTY_PROFILES[selectedDifficulty];

  const isMenu = gameState.status === GameStatus.MENU;
  const isPlaying = gameState.status === GameStatus.PLAYING;
  const isPaused = gameState.status === GameStatus.PAUSED;
  const isGameOver = gameState.status === GameStatus.GAMEOVER;

  useEffect(() => {
    if (!isPlaying || gameState.lastDamageTime === 0) return;
    setIsDamageFlashVisible(true);
    const timeout = window.setTimeout(() => setIsDamageFlashVisible(false), 260);
    return () => window.clearTimeout(timeout);
  }, [gameState.lastDamageTime, isPlaying]);

  const accessibilityStatus = useMemo(() => {
    if (cameraError) return `Erro de câmera: ${cameraError}`;
    if (isMenu) return `Menu inicial ativo. Dificuldade selecionada: ${DIFFICULTY_PROFILES[selectedDifficulty].label}.`;
    if (isPaused) return 'Partida pausada.';
    if (isGameOver) return `Fim de partida. Pontuação ${gameState.score}.`;
    if (isPlaying) {
      return `Jogando. Onda ${gameState.wave}. Vida ${gameState.health} por cento. Munição ${gameState.ammo}.`;
    }
    return 'Aplicação em execução.';
  }, [cameraError, gameState.ammo, gameState.health, gameState.score, gameState.wave, isGameOver, isMenu, isPaused, isPlaying, selectedDifficulty]);

  return (
    <main className="app-shell">
      <a href="#mission-controls" className="skip-link">
        Ir para controles da missão
      </a>
      <p className="sr-only" aria-live="polite">
        {accessibilityStatus}
      </p>

      <Suspense fallback={<div className="canvas-fallback" />}>
        <GameContainer
          handState={handState}
          gameState={gameState}
          isMotionReduced={reduceMotion}
          isPerformanceMode={performanceMode}
          onShoot={handleShoot}
          onEnemyDefeated={handleEnemyDefeated}
          onTakeDamage={handleTakeDamage}
          onWaveChange={handleWaveChange}
        />
      </Suspense>

      {isPlaying || isPaused ? (
        <nav className="command-bar" id="mission-controls" aria-label="Comandos da missão">
          <p>Comandos da Missão</p>
          <div className="control-strip">
            <button
              type="button"
              className="pill-btn with-kbd"
              onClick={() => setIsCalibrationOpen((previous) => !previous)}
              aria-pressed={isCalibrationOpen}
            >
              <span>Calibração</span>
              <kbd>C</kbd>
            </button>
            <button type="button" className="pill-btn with-kbd" onClick={() => setIsCinematicOpen(true)}>
              <span>Cinemática</span>
              <kbd>V</kbd>
            </button>
            <button
              type="button"
              className="pill-btn with-kbd"
              onClick={() => setIsHelpOpen((previous) => !previous)}
              aria-pressed={isHelpOpen}
            >
              <span>Ajuda</span>
              <kbd>H</kbd>
            </button>
            <button type="button" className="pill-btn with-kbd" onClick={isPaused ? resumeMatch : pauseMatch}>
              <span>{isPaused ? 'Retomar' : 'Pausar'}</span>
              <kbd>P</kbd>
            </button>
          </div>
        </nav>
      ) : null}

      <aside className="tracker-dock" aria-label="Pré-visualização do rastreamento das mãos">
        <HandTracker
          onUpdate={setHandState}
          onError={setCameraError}
          calibration={trackerCalibration}
          isPaused={!isPlaying}
        />
      </aside>

      {isPlaying ? (
        <HUD gameState={gameState} handState={handState} sessionDurationMs={sessionDurationMs} />
      ) : null}

      {isPlaying && isDamageFlashVisible ? <div className="damage-flash" /> : null}

      {isCalibrationOpen ? (
        <CalibrationPanel
          calibration={trackerCalibration}
          onChange={setTrackerCalibration}
          onReset={() => setTrackerCalibration(DEFAULT_TRACKER_CALIBRATION)}
          onClose={() => setIsCalibrationOpen(false)}
        />
      ) : null}

      {isHelpOpen ? <HelpPanel onClose={() => setIsHelpOpen(false)} /> : null}

      {isCinematicOpen ? (
        <Suspense
          fallback={
            <section className="overlay-root">
              <div className="overlay-card compact">
                <p>Carregando módulo</p>
                <h2>Preparando engine cinematográfica...</h2>
              </div>
            </section>
          }
        >
          <CinematicGenerator onClose={() => setIsCinematicOpen(false)} />
        </Suspense>
      ) : null}

      {cameraError ? (
        <section className="overlay-root" role="alertdialog" aria-modal="true" aria-labelledby="camera-error-title">
          <div className="overlay-card compact">
            <p>Falha de câmera</p>
            <h2 id="camera-error-title">Não foi possível iniciar o rastreamento.</h2>
            <p>{cameraError}</p>
            <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
              Recarregar aplicação
            </button>
          </div>
        </section>
      ) : null}

      {isMenu ? (
        <section className="overlay-root" role="dialog" aria-modal="true" aria-labelledby="menu-title">
          <div className="overlay-card menu-card">
            <div className="menu-layout">
              <div className="menu-intro">
                <p>GestureStrike Neural Arena</p>
                <h1 id="menu-title">Controle FPS por Gestos</h1>
                <p>
                  Mão esquerda para deslocamento, mão direita para combate. Configure o perfil e entre na missão com
                  rastreamento calibrado.
                </p>

                <div className="menu-highlights">
                  <article>
                    <small>Tempo de setup</small>
                    <strong>~2 minutos</strong>
                  </article>
                  <article>
                    <small>Confiabilidade ideal</small>
                    <strong>Ambiente bem iluminado</strong>
                  </article>
                  <article>
                    <small>Modelo atual</small>
                    <strong>MediaPipe Hands</strong>
                  </article>
                </div>

                <ol className="onboarding-list">
                  <li>Posicione a câmera na altura do rosto.</li>
                  <li>Deixe as duas mãos visíveis por 3 segundos.</li>
                  <li>Escolha dificuldade e preset de experiência.</li>
                  <li>Inicie a missão e ajuste calibração durante o jogo.</li>
                </ol>
              </div>

              <div className="menu-config">
                <div className="difficulty-grid">
                  {Object.values(DIFFICULTY_PROFILES).map((profile) => (
                    <button
                      key={profile.level}
                      type="button"
                      className={selectedDifficulty === profile.level ? 'difficulty-card selected' : 'difficulty-card'}
                      onClick={() => setSelectedDifficulty(profile.level)}
                    >
                      <strong>{profile.label}</strong>
                      <span>{profile.description}</span>
                      <small>
                        Spawn {Math.round(60000 / profile.spawnIntervalMs)}/min • dano {profile.enemyDamage}
                      </small>
                    </button>
                  ))}
                </div>

                <aside className="difficulty-insight" aria-live="polite">
                  <small>Dificuldade selecionada</small>
                  <h3>{selectedProfile.label}</h3>
                  <p>{selectedProfile.description}</p>
                  <div className="insight-metrics">
                    <span>Score x{selectedProfile.scoreMultiplier.toFixed(1)}</span>
                    <span>Máx. inimigos {selectedProfile.maxEnemies}</span>
                    <span>Cooldown IA {selectedProfile.enemyAttackCooldownMs}ms</span>
                  </div>
                </aside>
              </div>
            </div>

            <fieldset className="settings-row">
              <legend>Preferências da sessão</legend>
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={hapticsEnabled}
                  onChange={(event) => setHapticsEnabled(event.target.checked)}
                  aria-label="Ativar feedback háptico"
                />
                Haptics habilitado
              </label>
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(event) => setReduceMotion(event.target.checked)}
                  aria-label="Reduzir animações"
                />
                Reduzir animações
              </label>
              <label className="toggle-item">
                <input
                  type="checkbox"
                  checked={performanceMode}
                  onChange={(event) => setPerformanceMode(event.target.checked)}
                  aria-label="Ativar modo performance"
                />
                Modo performance
              </label>
            </fieldset>

            <div className="preset-row" aria-label="Presets de experiência">
              <button type="button" className="secondary-btn" onClick={() => applyPreset('COMPETITIVE')}>
                Preset competitivo
              </button>
              <button type="button" className="secondary-btn" onClick={() => applyPreset('COMFORT')}>
                Preset conforto
              </button>
            </div>

            <button type="button" className="primary-btn" onClick={startMatch}>
              Iniciar missão
            </button>
          </div>
        </section>
      ) : null}

      {isPaused ? (
        <section className="overlay-root" role="dialog" aria-modal="true" aria-labelledby="paused-title">
          <div className="overlay-card compact">
            <p>Sessão pausada</p>
            <h2 id="paused-title">Telemetria congelada</h2>
            <p>Tempo {formatDuration(sessionDurationMs)} • Precisão {matchAccuracy.toFixed(1)}%</p>
            <div className="button-row">
              <button type="button" className="primary-btn" onClick={resumeMatch}>
                Retomar
              </button>
              <button type="button" className="secondary-btn" onClick={returnToMenu}>
                Encerrar sessão
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {isGameOver ? (
        <section className="overlay-root" role="dialog" aria-modal="true" aria-labelledby="results-title">
          <div className="overlay-card compact results-card">
            <p>Fim de partida</p>
            <h2 id="results-title">Operador neutralizado</h2>
            <div className="result-grid">
              <div>
                <span>Pontuação</span>
                <strong>{gameState.score.toLocaleString('pt-BR')}</strong>
              </div>
              <div>
                <span>Precisão</span>
                <strong>{matchAccuracy.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Abates</span>
                <strong>{gameState.stats.enemiesDefeated}</strong>
              </div>
              <div>
                <span>Maior onda</span>
                <strong>{gameState.stats.highestWave}</strong>
              </div>
              <div>
                <span>Melhor sequência</span>
                <strong>{gameState.stats.bestStreak}</strong>
              </div>
              <div>
                <span>Duração</span>
                <strong>{formatDuration(sessionDurationMs)}</strong>
              </div>
            </div>
            <div className="button-row">
              <button type="button" className="primary-btn" onClick={startMatch}>
                Jogar novamente
              </button>
              <button type="button" className="secondary-btn" onClick={returnToMenu}>
                Voltar ao menu
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {uxToast ? (
        <aside className={uxToast.tone === 'success' ? 'ux-toast success' : 'ux-toast'} role="status" aria-live="polite">
          <strong>{uxToast.title}</strong>
          <p>{uxToast.description}</p>
        </aside>
      ) : null}

      <footer className="credit-badge">Matheus Siqueira • GestureStrike v2.0</footer>
    </main>
  );
};

export default App;
