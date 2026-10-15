import { describe, expect, it } from 'vitest';
import { CombatGesture, MovementGesture } from '../types';
import { MOUSE_PRIMARY, resolveKeyboardIntent } from './keyboard-input';

const resolve = (...keys: string[]) => resolveKeyboardIntent(new Set(keys));

describe('resolveKeyboardIntent', () => {
  it('fica parado e mirando sem teclas pressionadas', () => {
    expect(resolve()).toEqual({
      handState: {
        movement: MovementGesture.STOP,
        combat: CombatGesture.AIM,
        leftHandPresent: true,
        rightHandPresent: true,
      },
      turn: 0,
    });
  });

  it('mapeia WASD e setas para movimento', () => {
    expect(resolve('KeyW').handState.movement).toBe(MovementGesture.FORWARD);
    expect(resolve('ArrowDown').handState.movement).toBe(MovementGesture.BACKWARD);
    expect(resolve('KeyA').handState.movement).toBe(MovementGesture.LEFT);
    expect(resolve('KeyD').handState.movement).toBe(MovementGesture.RIGHT);
  });

  it('anula teclas opostas e prioriza avanço/recuo sobre strafe', () => {
    expect(resolve('KeyW', 'KeyS').handState.movement).toBe(MovementGesture.STOP);
    expect(resolve('KeyW', 'KeyS', 'KeyA').handState.movement).toBe(MovementGesture.LEFT);
    expect(resolve('KeyW', 'KeyA').handState.movement).toBe(MovementGesture.FORWARD);
  });

  it('prioriza recarga sobre disparo e disparo sobre mira', () => {
    expect(resolve('Space', 'KeyR', 'ShiftLeft').handState.combat).toBe(CombatGesture.RELOAD);
    expect(resolve('Space', 'ShiftLeft').handState.combat).toBe(CombatGesture.FIRE);
    expect(resolve(MOUSE_PRIMARY).handState.combat).toBe(CombatGesture.FIRE);
    expect(resolve('ShiftRight').handState.combat).toBe(CombatGesture.IRON_SIGHT);
  });

  it('calcula o eixo de giro e anula direções opostas', () => {
    expect(resolve('KeyQ').turn).toBe(-1);
    expect(resolve('ArrowRight').turn).toBe(1);
    expect(resolve('KeyQ', 'KeyE').turn).toBe(0);
  });
});
