// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { InputController } from '../src/input/InputController';

describe('held input ownership', () => {
  it('keeps movement held until both physical aliases release, and releases on focus loss', () => {
    const actions = { move: vi.fn(), block: vi.fn(), jump: vi.fn(), skill: vi.fn() };
    const input = new InputController(actions);
    input.setEnabled(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    expect(actions.move.mock.calls).toEqual([[-1]]);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
    expect(actions.move).toHaveBeenLastCalledWith(0);
    input.press('right', 'pointer:1');
    input.press('block', 'pointer:2');
    window.dispatchEvent(new Event('blur'));
    expect(actions.move).toHaveBeenLastCalledWith(0);
    expect(actions.block).toHaveBeenLastCalledWith(false);
    input.setEnabled(false);
    input.press('jump');
    expect(actions.jump).not.toHaveBeenCalled();
  });
});
