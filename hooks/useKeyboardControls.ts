import { useEffect, useRef, useState } from 'react';
import { GAME_KEYS, KeyboardIntent, MOUSE_PRIMARY, resolveKeyboardIntent } from '../domain/keyboard-input';

const IDLE_INTENT = resolveKeyboardIntent(new Set());

const intentsEqual = (a: KeyboardIntent, b: KeyboardIntent) =>
  a.turn === b.turn &&
  a.handState.movement === b.handState.movement &&
  a.handState.combat === b.handState.combat;

// Cliques em controles da interface (botões, campos, modais) não devem disparar a arma.
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, label, [role="dialog"], [role="alertdialog"]';

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.tagName === 'SELECT' ||
        element.isContentEditable),
  );
};

/**
 * Captura teclado e mouse e expõe a intenção do jogador no mesmo formato do rastreamento de mãos.
 * Só re-renderiza quando a intenção muda (não a cada keydown repetido pelo sistema operacional).
 */
export const useKeyboardControls = (enabled: boolean): KeyboardIntent => {
  const [intent, setIntent] = useState<KeyboardIntent>(IDLE_INTENT);
  const pressedRef = useRef(new Set<string>());

  useEffect(() => {
    const pressed = pressedRef.current;
    const publish = () => {
      const next = resolveKeyboardIntent(pressed);
      setIntent((previous) => (intentsEqual(previous, next) ? previous : next));
    };
    const releaseAll = () => {
      pressed.clear();
      publish();
    };

    if (!enabled) {
      releaseAll();
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!GAME_KEYS.has(event.code) || isTypingTarget(event.target)) return;
      event.preventDefault();
      pressed.add(event.code);
      publish();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!pressed.delete(event.code)) return;
      publish();
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if ((event.target as Element | null)?.closest(INTERACTIVE_SELECTOR)) return;
      pressed.add(MOUSE_PRIMARY);
      publish();
    };
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 0 || !pressed.delete(MOUSE_PRIMARY)) return;
      publish();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    // Sem isso, uma tecla segurada ao trocar de aba ficaria "presa" ao voltar.
    window.addEventListener('blur', releaseAll);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [enabled]);

  return intent;
};
