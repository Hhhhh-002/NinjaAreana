// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CMD } from '../src/generated/commands';

const harness = vi.hoisted(() => ({ connection: null as any, renderer: null as any, loop: null as any }));
vi.mock('../src/net/GameConnection', () => {
  class RequestError extends Error {}
  class GameConnection {
    connected = false; rtt = 12; onPush = (_cmd: number, _data: any) => {}; onClose = () => {}; onError = () => {};
    constructor() { harness.connection = this; }
    connect = vi.fn(async () => { this.connected = true; });
    request = vi.fn(async (cmd: number) => {
      if (cmd === 1001) return { userId: 'tester@example.com' };
      if (cmd === 2006) return { sceneId: '90071992547409999' };
      if (cmd === 1003) return { records: [], nextCursor: '' };
      return {};
    });
    move = vi.fn(); close = vi.fn(() => { this.connected = false; this.onClose(); });
  }
  return { GameConnection, RequestError };
});
vi.mock('../src/render/BattleRenderer', () => ({
  BattleRenderer: class {
    constructor() { harness.renderer = this; }
    init = vi.fn(async () => {}); setBackground = vi.fn(async () => {}); setDebug = vi.fn();
    enqueueResults = vi.fn(); reset = vi.fn(); render = vi.fn();
  },
}));
vi.mock('../src/loop/FixedStepLoop', () => ({
  FixedStepLoop: class {
    fps = 60; lastSteps = 0;
    constructor(public update: (s: number) => void, public render: (a: number, s: number, d: number) => void) { harness.loop = this; }
    start = vi.fn(); stop = vi.fn();
  },
}));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('client entry flow with simulated network, without WebGL', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it('starts offline, selects hero, logs in, joins, enables live inputs and exits on disconnect', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    document.visibilityState;
    await import('../src/main');
    const enter = document.querySelector<HTMLButtonElement>('#enter')!;
    expect(enter.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>('#client-shell')!.dataset.screen).toBe('auth');
    expect(document.querySelector<HTMLElement>('#lobby-screen')!.hidden).toBe(true);
    expect(document.querySelectorAll('[data-hero]')).toHaveLength(2);
    document.querySelector<HTMLButtonElement>('[data-hero="102"]')!.click();
    expect(document.querySelector('[data-skill="2001"]')).not.toBeNull();
    (document.querySelector('#account') as HTMLInputElement).value = 'tester@example.com';
    (document.querySelector('#password') as HTMLInputElement).value = 'Test12345!';
    document.querySelector<HTMLButtonElement>('#register')!.click();
    expect(harness.connection.request).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLElement>('#confirm-field')!.hidden).toBe(false);
    (document.querySelector('#confirm-password') as HTMLInputElement).value = 'Wrong123!';
    document.querySelector('#auth-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(harness.connection.request).not.toHaveBeenCalled();
    expect(document.querySelector('#auth-feedback')!.textContent).toContain('不一致');
    (document.querySelector('#confirm-password') as HTMLInputElement).value = 'Test12345!';
    document.querySelector('#auth-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(harness.connection.request).toHaveBeenCalledWith(CMD.REGISTER, { account: 'tester@example.com', password: 'Test12345!' }, 15000);
    expect(document.querySelector<HTMLElement>('#confirm-field')!.hidden).toBe(true);
    expect(document.querySelector('#auth-feedback')!.textContent).toContain('创建成功');
    (document.querySelector('#password') as HTMLInputElement).value = 'Test12345!';
    document.querySelector<HTMLButtonElement>('#password-toggle')!.click();
    expect(document.querySelector<HTMLInputElement>('#password')!.type).toBe('text');
    document.querySelector<HTMLButtonElement>('#password-toggle')!.click();
    expect(document.querySelector<HTMLInputElement>('#password')!.type).toBe('password');
    document.querySelector('#auth-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(enter.disabled).toBe(false);
    expect(document.querySelector<HTMLElement>('#client-shell')!.dataset.screen).toBe('lobby');
    expect(document.querySelector('#selected-name')!.textContent).toBe('岩牙');
    expect((document.querySelector('#password') as HTMLInputElement).value).toBe('');
    enter.click(); await flush();
    expect(document.querySelector<HTMLElement>('#client-shell')!.dataset.screen).toBe('battle');
    expect(document.documentElement.classList.contains('battle-mode')).toBe(true);
    expect(harness.connection.request).toHaveBeenCalledWith(CMD.START_GAME, { heroId: 102, nickname: '' }, 30000);
    expect(document.querySelector<HTMLButtonElement>('[data-input="left"]')!.disabled).toBe(true);
    harness.connection.onPush(CMD.BATTLE_SNAPSHOT, {
      battleId: '90071992547409999', serverTick: '1', width: 1440, groundY: 400, started: true, tickRate: 30,
      casts: [], projectiles: [], results: [], combatants: [{ entityId: '2', userId: 'tester@example.com', heroId: 102,
        hp: 1300, mana: 80, guard: 100, centerX: 1080, feetY: 400, alive: true, facing: -1, currentCastId: '0', statuses: [] }],
    });
    harness.loop.render(0.5, 0.2, 0);
    expect(document.querySelector<HTMLButtonElement>('[data-input="left"]')!.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('[data-skill="2001"]')!.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('[data-skill="2101"]')!.textContent).toContain('普攻');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));
    await flush();
    expect(harness.connection.request).toHaveBeenCalledWith(CMD.CAST_SKILL, { skillId: 2101 });
    const keyTarget = document.querySelector<HTMLButtonElement>('[data-input="left"]')!;
    keyTarget.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    expect(harness.connection.move).toHaveBeenLastCalledWith(-1);
    window.dispatchEvent(new Event('blur'));
    expect(harness.connection.move).toHaveBeenLastCalledWith(0);
    // The post-match panel keeps the battle visible until dismissed, then clears the old battle.
    HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) { this.setAttribute('open', ''); });
    HTMLDialogElement.prototype.close = vi.fn(function(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); });
    harness.connection.onPush(CMD.MATCH_ENDED, {
      sceneId: '90071992547409999', players: [{ userId: 'tester@example.com', nickname: '<script>unsafe</script>', rank: 1, hp: 100, heroId: 102 }],
    });
    expect(document.querySelector<HTMLElement>('#client-shell')!.dataset.screen).toBe('battle');
    expect(document.querySelector('#result-content script')).toBeNull();
    document.querySelector<HTMLButtonElement>('[data-close="result"]')!.click();
    expect(document.querySelector<HTMLElement>('#client-shell')!.dataset.screen).toBe('lobby');
    expect(document.documentElement.classList.contains('battle-mode')).toBe(false);
    expect(enter.disabled).toBe(false);
    harness.connection.close(); await flush();
    expect(document.querySelector<HTMLElement>('#client-shell')!.dataset.screen).toBe('auth');
    expect(enter.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-input="left"]')!.disabled).toBe(true);
    expect(harness.renderer.reset).toHaveBeenCalled();
  });
});
