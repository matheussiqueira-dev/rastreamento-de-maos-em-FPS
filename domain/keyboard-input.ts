import { CombatGesture, HandState, MovementGesture } from '../types';

/** Direção de giro da câmera: -1 = esquerda, 0 = parado, 1 = direita. */
export type TurnAxis = -1 | 0 | 1;

export interface KeyboardIntent {
  handState: HandState;
  turn: TurnAxis;
}

/** Botão primário do mouse, tratado como uma "tecla" para unificar o mapeamento. */
export const MOUSE_PRIMARY = 'MousePrimary';

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACKWARD_KEYS = ['KeyS', 'ArrowDown'];
const STRAFE_LEFT_KEYS = ['KeyA'];
const STRAFE_RIGHT_KEYS = ['KeyD'];
const TURN_LEFT_KEYS = ['KeyQ', 'ArrowLeft'];
const TURN_RIGHT_KEYS = ['KeyE', 'ArrowRight'];
const FIRE_KEYS = ['Space', 'KeyJ', MOUSE_PRIMARY];
const AIM_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyK'];
const RELOAD_KEYS = ['KeyR'];

/** Teclas consumidas pelo jogo (o navegador não deve rolar a página com elas durante a partida). */
export const GAME_KEYS: ReadonlySet<string> = new Set([
  ...FORWARD_KEYS,
  ...BACKWARD_KEYS,
  ...STRAFE_LEFT_KEYS,
  ...STRAFE_RIGHT_KEYS,
  ...TURN_LEFT_KEYS,
  ...TURN_RIGHT_KEYS,
  ...FIRE_KEYS,
  ...AIM_KEYS,
  ...RELOAD_KEYS,
]);

const anyPressed = (pressed: ReadonlySet<string>, keys: readonly string[]) => keys.some((key) => pressed.has(key));

/**
 * Converte o conjunto de teclas pressionadas no mesmo contrato produzido pelo rastreamento de mãos.
 * Isso mantém o motor do jogo agnóstico à fonte de entrada (gestos ou teclado).
 * Regras: teclas opostas se anulam; recarga tem prioridade sobre disparo, que tem prioridade sobre mira.
 */
export const resolveKeyboardIntent = (pressed: ReadonlySet<string>): KeyboardIntent => {
  const forward = anyPressed(pressed, FORWARD_KEYS);
  const backward = anyPressed(pressed, BACKWARD_KEYS);
  const strafeLeft = anyPressed(pressed, STRAFE_LEFT_KEYS);
  const strafeRight = anyPressed(pressed, STRAFE_RIGHT_KEYS);

  let movement = MovementGesture.STOP;
  if (forward !== backward) movement = forward ? MovementGesture.FORWARD : MovementGesture.BACKWARD;
  else if (strafeLeft !== strafeRight) movement = strafeLeft ? MovementGesture.LEFT : MovementGesture.RIGHT;

  let combat = CombatGesture.AIM;
  if (anyPressed(pressed, RELOAD_KEYS)) combat = CombatGesture.RELOAD;
  else if (anyPressed(pressed, FIRE_KEYS)) combat = CombatGesture.FIRE;
  else if (anyPressed(pressed, AIM_KEYS)) combat = CombatGesture.IRON_SIGHT;

  const turnLeft = anyPressed(pressed, TURN_LEFT_KEYS);
  const turnRight = anyPressed(pressed, TURN_RIGHT_KEYS);
  const turn: TurnAxis = turnLeft === turnRight ? 0 : turnLeft ? -1 : 1;

  return {
    handState: { movement, combat, leftHandPresent: true, rightHandPresent: true },
    turn,
  };
};
