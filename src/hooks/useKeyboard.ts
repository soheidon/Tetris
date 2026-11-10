import { useEffect, useRef } from 'react';
import { tauriBridge } from '../services/tauriBridge';
import type { InputAction } from '../types/game';
import type { UserSettings } from '../types/settings';

export function useKeyboard(settings: UserSettings | null, isPlaying: boolean) {
  const activeKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!settings) return;

    const bindings = settings.key_bindings;

    const resolveAction = (key: string): InputAction | null => {
      const k = key.toLowerCase();
      if (k === bindings.move_left.toLowerCase()) return 'MoveLeft';
      if (k === bindings.move_right.toLowerCase()) return 'MoveRight';
      if (k === bindings.soft_drop.toLowerCase()) return 'SoftDrop';
      if (k === bindings.hard_drop.toLowerCase()) return 'HardDrop';
      if (k === bindings.rotate_cw.toLowerCase()) return 'RotateCW';
      if (k === bindings.rotate_ccw.toLowerCase()) return 'RotateCCW';
      if (k === bindings.hold.toLowerCase()) return 'Hold';
      if (k === bindings.pause.toLowerCase()) return 'Pause';
      if (k === bindings.restart.toLowerCase()) return 'Restart';
      return null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default scrolling for game controls
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.repeat) return;

      const action = resolveAction(e.key);
      if (action) {
        activeKeysRef.current.add(e.key.toLowerCase());
        tauriBridge.sendInput(action, true).catch(console.error);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const action = resolveAction(e.key);
      if (action) {
        activeKeysRef.current.delete(e.key.toLowerCase());
        tauriBridge.sendInput(action, false).catch(console.error);
      }
    };

    const handleBlur = () => {
      // Window lost focus: release all pressed keys and auto-pause if playing
      for (const key of activeKeysRef.current) {
        const action = resolveAction(key);
        if (action) {
          tauriBridge.sendInput(action, false).catch(console.error);
        }
      }
      activeKeysRef.current.clear();

      if (isPlaying) {
        tauriBridge.pauseGame().catch(console.error);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [settings, isPlaying]);
}
