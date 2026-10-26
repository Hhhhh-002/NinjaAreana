import './ui/interface.css';
import { heroes, heroById, skills, skillById, effects } from './catalog';
import { CMD } from './generated/commands';
import { GameConnection, RequestError } from './net/GameConnection';
import { FixedStepLoop } from './loop/FixedStepLoop';
import { SnapshotBuffer } from './loop/SnapshotBuffer';
import { InputController } from './input/InputController';
import { BattleRenderer } from './render/BattleRenderer';
import type { BattleSnapshot, Combatant, HistoryItem, MatchRanking } from './model';

import { shell, icon } from './ui/shell';
import { heroPresentation, heroDetails } from './ui/heroDetails';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = shell();

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const dialog = (id: string) => element<HTMLDialogElement>(id);
const connection = new GameConnection();
const snapshots = new SnapshotBuffer();
const renderer = new BattleRenderer(element('stage'));
let selectedHero = 101;
let userId = '';
let sceneId = '';
let joining = false;
let inBattle = false;
let busyAuth = false;
let authMode: 'login' | 'register' = 'login';
let resultVisible = false;
let entering = false;
let leaving = false;
let gatewayUrl = localStorage.getItem('ninja.gateway') || import.meta.env.VITE_GATEWAY_URL || 'ws://127.0.0.1:9001/ws';
let frame: BattleSnapshot | undefined;
let preview = createPreview();
let latestResultTick = -1;
let uiElapsed = 0;
let toastTimer: ReturnType<typeof setTimeout>;
let historyCursor = '';
let historyRows: HistoryItem[] = [];
let historyLoading = false;
let battleGeneration = 0;
const cooldownEnds = new Map<number, number>();
const casting = new Set<number>();

function notify(message: string): void {
  element('toast').textContent = message; element('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element('toast').hidden = true; }, 6000);
}
function report(error: unknown): void { notify(error instanceof Error ? error.message : '操作失败，请稍后重试'); }
function refreshScreen(): void {
  const screen = !userId ? 'auth' : inBattle || entering || resultVisible ? 'battle' : 'lobby';
  const previous = element('client-shell').dataset.screen;
  element('client-shell').dataset.screen = screen;
  document.documentElement.classList.toggle('battle-mode', screen === 'battle');
  element('auth-screen').hidden = screen !== 'auth';
  element('lobby-screen').hidden = screen !== 'lobby';
  element('battle-screen').hidden = screen !== 'battle';
  if (previous === 'battle' && screen !== 'battle' && document.fullscreenElement === document.documentElement) {
    void document.exitFullscreen().catch(() => {});
  }
}
function authFeedback(message = '', success = false): void {
  element('auth-feedback').textContent = message;
  element('auth-feedback').hidden = !message;
  element('auth-feedback').classList.toggle('success', success);
}
function setAuthMode(mode: 'login' | 'register'): void {
  if (busyAuth) return;
  authMode = mode;
  const registering = mode === 'register';
  element('register').setAttribute('aria-pressed', String(registering));
  element('auth-login-tab').setAttribute('aria-pressed', String(!registering));
  element('confirm-field').hidden = !registering;
  element<HTMLInputElement>('confirm-password').required = registering;
  element<HTMLInputElement>('confirm-password').value = '';
  element<HTMLInputElement>('confirm-password').setCustomValidity('');
  element<HTMLInputElement>('password').autocomplete = registering ? 'new-password' : 'current-password';
  element('password-note').hidden = !registering;
  element('auth-title').textContent = registering ? '书写你的忍道' : '踏入竞技场';
  element('auth-subtitle').textContent = registering ? '创建账号，迎接第一场交锋。' : '登录账号，开启你的下一场对决。';
  element('auth-note').textContent = registering ? '已有账号？选择「账号登录」即可返回。' : '初次来到影斗？选择「创建账号」后即可注册。';
  authFeedback();
  refreshAuth();
}
function refreshSelectedHero(): void {
  const hero = heroById(selectedHero);
  const presentation = heroPresentation(selectedHero);
  element('selected-name').textContent = hero.name;
  element('selection-label').textContent = `${hero.name}已就绪`;
  element('hero-class').textContent = presentation.role;
  element('selected-description').textContent = presentation.description;
  element('hero-overprint').textContent = presentation.glyph;
  element('hero-hp').textContent = String(hero.hp);
  element('hero-mana').textContent = String(hero.mana);
  element('hero-guard').textContent = String(hero.guard);
  element('equipped-skills').innerHTML = skills.filter(s => s.heroId === selectedHero && s.mode !== 'TRAINING').map(s =>
    `<span class="equipped-skill${s.passive ? ' passive' : ''}"><kbd>${s.passive ? '被动' : s.key}</kbd>${s.name}</span>`).join('');
  document.querySelectorAll<HTMLElement>('[data-hero]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.hero! === selectedHero)));
}
function openHeroDetails(id = selectedHero): void {
  document.querySelectorAll<HTMLElement>('[data-inspect-hero]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.inspectHero! === id)));
  element('hero-dialog-content').innerHTML = heroDetails(id);
  if (!dialog('hero-dialog').open) { input.release(); dialog('hero-dialog').showModal(); }
}
function createPreview(): BattleSnapshot {
  return { battleId: 'preview', serverTick: '0', started: false, tickRate: 30, width: 1440, groundY: 400,
    casts: [], projectiles: [], results: [], combatants: heroes.map((h, index) => ({
      userId: '', entityId: `preview-${h.id}`, heroId: h.id, hp: h.hp, mana: h.mana, guard: h.guard,
      centerX: index ? 1080 : 360, feetY: 400, alive: true, currentCastId: '', facing: index ? -1 : 1, statuses: [],
    })) };
}
function activeInput(): boolean {
  const own = frame?.combatants.find(c => c.userId === userId);
  return !!(inBattle && userId && frame?.started && own?.alive && connection.connected && !leaving);
}
function refreshControls(): void {
  const allowed = activeInput();
  input.setEnabled(allowed);
  document.querySelectorAll<HTMLButtonElement>('.movement-controls button').forEach(b => { b.disabled = !allowed; });
  element<HTMLButtonElement>('enter').disabled = !userId || entering || inBattle || leaving;
  element('enter').hidden = inBattle;
  element('leave').hidden = !inBattle;
  element<HTMLButtonElement>('leave').disabled = leaving;
  element<HTMLButtonElement>('logout').disabled = leaving;
  element('enter-text').textContent = entering ? '正在进入战场…' : '开始对战';
  document.querySelectorAll<HTMLButtonElement>('[data-hero]').forEach(b => { b.disabled = inBattle || entering; });
  element<HTMLInputElement>('nickname').disabled = inBattle || entering;
  const own = frame?.combatants.find(c => c.userId === userId);
  const tick = Number(frame?.serverTick ?? 0);
  document.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach(button => {
    const s = skillById(+button.dataset.skill!)!;
    const remaining = Math.max(0, (cooldownEnds.get(s.id) ?? 0) - tick);
    const hasCast = !!own?.currentCastId && own.currentCastId !== '0';
    button.disabled = !allowed || remaining > 0 || casting.has(s.id) || hasCast || (own?.mana ?? 0) < s.mana;
    button.querySelector('.cooldown')!.textContent = remaining > 0 ? `${(remaining / 30).toFixed(1)}s` : casting.has(s.id) ? '…' : '';
  });
  refreshScreen();
}
function refreshAuth(): void {
  element('auth-form').hidden = !!userId;
  element('signed-in').hidden = !userId;
  element('user-name').textContent = userId;
  element('account-chip').hidden = !userId;
  element('account-display').textContent = userId;
  element<HTMLButtonElement>('history-open').disabled = !userId;
  element<HTMLButtonElement>('login').disabled = busyAuth;
  element<HTMLButtonElement>('register').disabled = busyAuth;
  element<HTMLButtonElement>('auth-login-tab').disabled = busyAuth;
  element<HTMLInputElement>('account').disabled = busyAuth;
  element<HTMLInputElement>('password').disabled = busyAuth;
  element<HTMLInputElement>('confirm-password').disabled = busyAuth;
  element('auth-form').setAttribute('aria-busy', String(busyAuth));
  element('auth-submit-text').textContent = busyAuth ? authMode === 'register' ? '正在创建账号…' : '正在登录…' : authMode === 'register' ? '创建账号' : '登录竞技场';
  element('connection').classList.toggle('online', connection.connected);
  element('connection').textContent = userId ? '已登录' : connection.connected ? '已连接，待登录' : '尚未连接';
  refreshControls();
}
function refreshSkillButtons(): void {
  element('skill-controls').innerHTML = skills.filter(s => s.heroId === selectedHero && !s.passive).map(s => `
    <button class="skill control" data-input="${s.key}" data-skill="${s.id}" disabled>
    <kbd>${s.key}</kbd>${s.name}<span class="cooldown"></span><small>${s.mana} 蓝量 · ${s.cooldown / 30}秒冷却${s.mode === 'TRAINING' ? ' · 仅训练' : ''}</small></button>`).join('');
  element('skill-controls').querySelectorAll<HTMLElement>('[data-input]').forEach(button => input.bindButton(button, button.dataset.input!));
  refreshControls();
}
function clearBattle(): void {
  battleGeneration++;
  input.setEnabled(false);
  inBattle = false; joining = false; resultVisible = false; sceneId = ''; frame = undefined;
  latestResultTick = -1; cooldownEnds.clear(); casting.clear(); snapshots.clear(); renderer.reset(); preview = createPreview();
  refreshControls();
}
async function authenticate(register: boolean): Promise<void> {
  const form = element<HTMLFormElement>('auth-form');
  if (busyAuth || !form.reportValidity()) return;
  const account = element<HTMLInputElement>('account').value.trim();
  const password = element<HTMLInputElement>('password').value;
  if (register && password !== element<HTMLInputElement>('confirm-password').value) {
    authFeedback('两次输入的密码不一致，请重新确认。');
    element<HTMLInputElement>('confirm-password').focus(); return;
  }
  authFeedback();
  busyAuth = true; refreshAuth();
  try {
    await connection.connect(gatewayUrl);
    const result = await connection.request<{ userId: string }>(register ? CMD.REGISTER : CMD.LOGIN, { account, password }, register ? 15_000 : 95_000);
    if (register) {
      busyAuth = false; setAuthMode('login');
      element<HTMLInputElement>('password').value = '';
      element<HTMLInputElement>('password').focus();
      authFeedback('账号创建成功，请输入密码登录。', true);
    } else {
      userId = result.userId;
      element<HTMLInputElement>('password').value = '';
      element<HTMLInputElement>('confirm-password').value = '';
      refreshSelectedHero(); notify('登录成功，请选择出战忍者');
    }
  } catch (error) {
    // A timed-out login may already have created its Actor. Close the uncertain session.
    if (!register && error instanceof RequestError && error.uncertain) connection.close();
    authFeedback(error instanceof Error ? error.message : '操作失败，请稍后重试');
  } finally { busyAuth = false; refreshAuth(); }
}
const input = new InputController({
  move: axis => { if (inBattle && connection.connected) { try { connection.move(axis); } catch (error) { report(error); } } },
  block: blocking => { if (inBattle && connection.connected) void connection.request(CMD.BLOCK, { blocking }).catch(report); },
  jump: () => { if (activeInput()) void connection.request(CMD.JUMP).catch(report); },
  skill: key => void castKey(key),
});
async function castKey(key: string): Promise<void> {
  const s = skills.find(s => s.heroId === selectedHero && !s.passive && s.key === key);
  if (!s || !activeInput() || casting.has(s.id)) return;
  const button = document.querySelector<HTMLButtonElement>(`[data-skill="${s.id}"]`);
  if (button?.disabled) return;
  casting.add(s.id); refreshControls();
  const generation = battleGeneration;
  try {
    const result = await connection.request<{ skillId: number; serverTick: string }>(CMD.CAST_SKILL, { skillId: s.id });
    if (generation !== battleGeneration || !inBattle) return;
    cooldownEnds.set(result.skillId, Number(result.serverTick) + s.cooldown);
  } catch (error) { report(error); }
  finally { if (generation === battleGeneration) { casting.delete(s.id); refreshControls(); } }
}

connection.onPush = (cmd, data) => {
  if (cmd === CMD.BATTLE_SNAPSHOT) {
    const incoming = data as BattleSnapshot;
    if (!userId || (!inBattle && !joining) || (sceneId && incoming.battleId !== sceneId)) return;
    if (!snapshots.push(incoming)) return;
    frame = incoming;
    const own = frame.combatants.find(c => c.userId === userId);
    if (own) selectedHero = own.heroId;
    const tick = Number(frame.serverTick);
    if (tick > latestResultTick) {
      latestResultTick = tick;
      renderer.enqueueResults(frame);
      for (const event of frame.results) {
        if (event.type === 'CAST_STARTED' && event.sourceUserId === userId) {
          const skill = skillById(event.skillId);
          if (skill) cooldownEnds.set(skill.id, Number(event.serverTick) + skill.cooldown);
        }
      }
    }
    refreshControls();
  } else if (cmd === CMD.MATCH_ENDED) {
    const result = data as MatchRanking;
    if ((!inBattle && !joining) || (sceneId && result.sceneId !== sceneId)) return;
    input.setEnabled(false); inBattle = false; joining = false; resultVisible = true; battleGeneration++;
    const own = result.players.find(p => p.userId === userId);
    element('result-title').textContent = own?.rank === 1 ? '对决获胜' : '对决结束';
    dialog('result').dataset.outcome = own?.rank === 1 ? 'victory' : 'defeat';
    const content = element('result-content'); content.replaceChildren();
    for (const p of result.players) {
      const line = document.createElement('div'); line.className = `result-player${p.userId === userId ? ' own' : ''}`;
      line.innerHTML = '<span class="result-rank"></span><div class="result-player-info"><strong></strong><small></small></div><span class="result-hp"></span>';
      line.querySelector('.result-rank')!.textContent = String(p.rank);
      line.querySelector('strong')!.textContent = p.nickname || heroById(p.heroId).name;
      line.querySelector('small')!.textContent = `${heroById(p.heroId).name}${p.userId === userId ? ' · 你' : ''}`;
      line.querySelector('.result-hp')!.textContent = `剩余生命 ${p.hp}`;
      content.append(line);
    }
    const note = document.createElement('p'); note.className = 'footnote'; note.textContent = '本局战绩已保存。'; content.append(note);
    document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d => d.close());
    dialog('result').showModal(); element('session-hint').textContent = '本局结束，可以重新入场。'; refreshControls();
  } else if (cmd === CMD.KICKED_OFFLINE) {
    notify('账号已在其他位置登录，请重新登录'); connection.close();
  }
};
connection.onClose = reason => {
  userId = '';
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d => d.close());
  clearBattle(); refreshAuth(); if (reason) notify(reason);
};
connection.onError = notify;

element<HTMLFormElement>('auth-form').addEventListener('submit', event => { event.preventDefault(); void authenticate(authMode === 'register'); });
element('register').addEventListener('click', () => setAuthMode('register'));
element('auth-login-tab').addEventListener('click', () => setAuthMode('login'));
element('password-toggle').addEventListener('click', () => {
  const visible = element<HTMLInputElement>('password').type === 'password';
  element<HTMLInputElement>('password').type = visible ? 'text' : 'password';
  element('password-toggle').setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
  element('password-toggle').setAttribute('aria-pressed', String(visible));
});
for (const id of ['account', 'password', 'confirm-password']) element(id).addEventListener('input', () => authFeedback());
element('logout').addEventListener('click', () => connection.close());
document.querySelectorAll<HTMLButtonElement>('[data-hero]').forEach(button => button.addEventListener('click', () => {
  selectedHero = +button.dataset.hero!;
  refreshSelectedHero(); refreshSkillButtons();
}));
for (const id of ['heroes-open', 'hero-detail']) element(id).addEventListener('click', () => openHeroDetails());
document.querySelectorAll<HTMLButtonElement>('[data-inspect-hero]').forEach(button => button.addEventListener('click', () => openHeroDetails(+button.dataset.inspectHero!)));
for (const id of ['help-open', 'auth-help', 'lobby-guide']) element(id).addEventListener('click', () => { input.release(); dialog('help').showModal(); });
element('brand-home').addEventListener('click', event => {
  event.preventDefault();
  if (inBattle || entering) { notify('当前正在战场中，请先离开战场。'); return; }
  if (resultVisible) dialog('result').close();
  refreshScreen();
});
element('lobby-home').addEventListener('click', () => refreshScreen());
element('battle-fullscreen').addEventListener('click', async () => {
  input.release();
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else notify('当前浏览器不支持全屏，战斗画面已铺满窗口。');
  } catch { notify('无法进入全屏，战斗画面已铺满窗口。'); }
});
document.addEventListener('fullscreenchange', () => {
  const fullscreen = document.fullscreenElement === document.documentElement;
  element('fullscreen-label').textContent = fullscreen ? '退出全屏' : '全屏';
  element('battle-fullscreen').setAttribute('aria-label', fullscreen ? '退出全屏' : '进入全屏');
});
dialog('result').addEventListener('close', () => { resultVisible = false; clearBattle(); refreshControls(); });
document.querySelectorAll<HTMLElement>('.movement-controls [data-input]').forEach(button => input.bindButton(button, button.dataset.input!));
element('enter').addEventListener('click', async () => {
  if (!userId || entering || inBattle) return;
  clearBattle(); entering = true; joining = true; refreshControls();
  const generation = battleGeneration;
  try {
    const result = await connection.request<{ sceneId: string }>(CMD.START_GAME, {
      heroId: selectedHero, nickname: element<HTMLInputElement>('nickname').value,
    }, 30_000);
    if (generation !== battleGeneration || !userId) return;
    sceneId = result.sceneId; inBattle = true; joining = false;
    if (frame && frame.battleId !== sceneId) { snapshots.clear(); frame = undefined; }
    element('session-hint').textContent = '已进入战场，操作以服务器状态为准。';
    notify('已进入战场，对战模式需要两名玩家到齐');
  } catch (error) {
    clearBattle();
    if (error instanceof RequestError && error.uncertain) connection.close();
    report(error);
  } finally { entering = false; refreshControls(); }
});
element('leave').addEventListener('click', async () => {
  if (leaving) return;
  leaving = true; refreshControls();
  try { await connection.request(CMD.LEAVE, {}, 30_000); clearBattle(); notify('已离开战场'); }
  catch (error) { report(error); if (error instanceof RequestError && error.uncertain) connection.close(); }
  finally { leaving = false; refreshControls(); }
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-scene]')) button.addEventListener('click', async () => {
  try {
    await renderer.setBackground(button.dataset.scene!);
    document.querySelectorAll<HTMLElement>('[data-scene]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    element('scene-caption').textContent = button.textContent;
  } catch { notify('背景加载失败，请检查资源文件'); }
});
element('settings-open').addEventListener('click', () => { input.release(); element<HTMLInputElement>('gateway-url').value = gatewayUrl; dialog('settings').showModal(); });
element<HTMLInputElement>('debug-boxes').addEventListener('change', event => renderer.setDebug((event.target as HTMLInputElement).checked));
element<HTMLFormElement>('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const next = element<HTMLInputElement>('gateway-url').value.trim();
    const url = new URL(next);
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('请输入有效的 ws:// 或 wss:// 地址');
    if (next !== gatewayUrl) { connection.close(); gatewayUrl = next; localStorage.setItem('ninja.gateway', next); }
    dialog('settings').close(); notify('设置已保存');
  } catch (error) { report(error); }
});
document.querySelectorAll<HTMLElement>('[data-close]').forEach(button => button.addEventListener('click', () => dialog(button.dataset.close!).close()));
for (const id of ['history-open', 'lobby-history']) element(id).addEventListener('click', () => { input.release(); dialog('history').showModal(); void loadHistory(false); });
element('history-retry').addEventListener('click', () => void loadHistory(false));
element('history-next').addEventListener('click', () => void loadHistory(true));
async function loadHistory(more: boolean): Promise<void> {
  if (!userId || historyLoading) return;
  historyLoading = true;
  element<HTMLButtonElement>('history-next').disabled = true;
  element('history-retry').hidden = true;
  element('history-next').textContent = '正在加载…';
  if (!more) {
    historyRows = []; historyCursor = ''; element('history-next').hidden = true;
    element('history-content').innerHTML = '<div class="empty-state"><span class="loading-ring" aria-hidden="true"></span><strong>正在读取战绩</strong><p>请稍候…</p></div>';
  }
  try {
    const page = await connection.request<{ records: HistoryItem[]; nextCursor: string }>(CMD.MATCH_HISTORY, { limit: 20, cursor: historyCursor });
    historyRows.push(...page.records); historyCursor = page.nextCursor;
    const content = element('history-content'); content.replaceChildren();
    if (!historyRows.length) content.innerHTML = `<div class="empty-state">${icon('history')}<strong>第一场交锋，等你开启</strong><p>完成一局对决后，你的出战忍者和对战结果会记录在这里。</p></div>`;
    else {
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th scope="col">比赛时间</th><th scope="col">出战忍者</th><th scope="col">对战结果</th><th scope="col">剩余生命</th></tr></thead>';
      const body = document.createElement('tbody');
      for (const record of historyRows) {
        const row = document.createElement('tr');
        for (const [index, value] of [new Date(Number(record.endTime)).toLocaleString('zh-CN'), heroById(record.heroId).name, record.rank === 1 ? '获胜' : `第 ${record.rank} 名`, String(record.hp)].entries()) {
          const cell = document.createElement('td'); cell.textContent = value;
          if (index === 2) cell.className = record.rank === 1 ? 'victory' : 'defeat';
          row.append(cell);
        }
        body.append(row);
      }
      table.append(body); content.append(table);
    }
    element('history-next').hidden = !historyCursor;
  } catch (error) {
    if (!more) {
      element('history-content').innerHTML = `<div class="empty-state">${icon('history')}<strong>暂时无法读取战绩</strong><p>请检查连接，然后重新加载。</p></div>`;
      element('history-retry').hidden = false;
    }
    report(error);
  } finally {
    historyLoading = false; element<HTMLButtonElement>('history-next').disabled = false;
    element('history-next').textContent = '加载更多';
  }
}

function updateFighter(id: string, c: Combatant | undefined): void {
  const container = element(id);
  container.style.opacity = c ? '1' : '.5';
  container.querySelector('[data-name]')!.textContent = c ? heroById(c.heroId).name : '等待对手';
  container.querySelector('[data-role]')!.textContent = !frame ? '场景预览' : c?.userId === userId ? '你' : c ? '对手' : '';
  const hero = heroById(c?.heroId ?? 101);
  const percent = (value: number, max: number) => `${Math.max(0, Math.min(100, value / max * 100))}%`;
  (container.querySelector('[data-hp]') as HTMLElement).style.width = percent(c?.hp ?? 0, hero.hp);
  (container.querySelector('[data-mana]') as HTMLElement).style.width = percent(c?.mana ?? 0, hero.mana);
  (container.querySelector('[data-guard]') as HTMLElement).style.width = percent(c?.guard ?? 0, hero.guard);
  container.querySelector('[data-values]')!.textContent = c ? `${c.hp} / ${hero.hp}　蓝 ${c.mana}　防 ${c.guard}` : '—';
  const active = c?.statuses.map(s => effects.get(s.effectId)?.name).filter(Boolean) ?? [];
  container.querySelector('[data-status]')!.textContent = active.join(' / ') || (c ? skills.find(s => s.heroId === c.heroId && s.passive)?.name ?? '' : '');
}
function refreshHud(): void {
  const shown = frame ?? preview;
  const own = shown.combatants.find(c => c.userId === userId && userId);
  const left = own ?? shown.combatants[0];
  updateFighter('fighter-left', left);
  updateFighter('fighter-right', shown.combatants.find(c => c.entityId !== left?.entityId));
  const ticks = Number(shown.serverTick);
  element('match-time').textContent = shown.started ? `${String(Math.floor(ticks / 1800)).padStart(2, '0')}:${String(Math.floor(ticks / 30) % 60).padStart(2, '0')}` : '对决';
  element('match-label').textContent = inBattle ? shown.started ? '对决进行中' : '等待对手' : entering ? '正在入场' : '等待入场';
  const banner = element('stage-banner');
  banner.hidden = !!(inBattle && shown.started);
  banner.textContent = inBattle ? '已入场，等待另一名忍者' : entering ? '正在进入战场…' : userId ? '选择忍者，进入对决' : '登录后选择忍者，进入对决';
  if (!inBattle && frame?.started) banner.textContent = '本局对决已结束';
  element('stats').textContent = `${Math.round(loop.fps)} FPS · ${connection.connected ? `${connection.rtt} ms` : '离线预览'} · 帧 ${frame?.serverTick ?? '—'} · 补帧 ${loop.lastSteps}/10`;
  refreshControls();
}
const loop = new FixedStepLoop(seconds => snapshots.step(seconds), (alpha, seconds, dropped) => {
  if (dropped) snapshots.rebase();
  if (element('client-shell').dataset.screen === 'battle') renderer.render(snapshots.sample(alpha) ?? preview, seconds);
  uiElapsed += seconds;
  if (uiElapsed > 0.1) { uiElapsed = 0; refreshHud(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else { snapshots.rebase(); loop.start(); }
});
window.addEventListener('beforeunload', () => { input.release(); connection.close(); });
refreshSelectedHero(); refreshSkillButtons(); refreshAuth();
try { await renderer.init(); loop.start(); }
catch { element('stage-banner').textContent = '画面初始化失败，请检查浏览器 WebGL 支持并刷新'; notify('场景加载失败，请检查资源或浏览器设置'); }
