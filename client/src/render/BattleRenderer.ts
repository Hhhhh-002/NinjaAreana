import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { effects, heroById } from '../catalog';
import type { BattleSnapshot, CombatEvent } from '../model';
import { type AvatarFactory, type AvatarView, type AvatarAction } from './AvatarView';
import { loadSpineResources } from './SpineAssets';
import { SpineAvatar } from './SpineAvatar';
import { SkillVfx } from './SkillVfx';

export class BattleRenderer {
  private readonly app = new Application();
  private readonly world = new Container();
  private readonly actors = new Container();
  private readonly projectiles = new Container();
  private readonly debug = new Graphics();
  private readonly vfx = new SkillVfx();
  private readonly background = new Sprite();
  private readonly avatars = new Map<string, { view: AvatarView; lastX: number; heroId: number }>();
  private readonly flying = new Map<string, Graphics>();
  private readonly labels: { label: Text; age: number; x: number; y: number }[] = [];
  private readonly pendingEffects: { event: CombatEvent; frame: BattleSnapshot }[] = [];
  private resize?: ResizeObserver;
  private ready = false;
  private assetGeneration = 0;
  private showBoxes = false;
  private width = 1440;
  private groundY = 400;
  constructor(private readonly host: HTMLElement,
    private readonly avatarFactory: AvatarFactory = hero => new SpineAvatar(hero)) {}
  async init(): Promise<void> {
    await this.app.init({ width: 1440, height: 480, autoStart: false, antialias: true,
      background: 0x182830, preference: 'webgl', autoDensity: true, resolution: Math.min(devicePixelRatio, 2) });
    this.app.canvas.setAttribute('aria-label', '影斗战斗场景');
    this.host.prepend(this.app.canvas);
    this.world.addChild(this.actors, this.projectiles, this.vfx.root, this.debug);
    this.app.stage.addChild(this.background, this.world);
    await loadSpineResources();
    this.ready = true;
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(this.host);
    this.layout();
    await this.setBackground('sakura');
  }
  async setBackground(name: string): Promise<void> {
    const generation = ++this.assetGeneration;
    const texture = await Assets.load(`/assets/backgrounds/${name === 'inferno' ? 'inferno' : 'sakura'}.png`);
    if (generation !== this.assetGeneration) return;
    this.background.texture = texture;
    this.layout();
  }
  private layout(): void {
    if (!this.ready) return;
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.app.renderer.resize(width, height);
    // The backdrop fills the viewport. Combat coordinates retain one uniform scale,
    // keeping the whole arena width visible without stretching characters or hitboxes.
    this.background.width = width;
    this.background.height = height;
    const scale = Math.min(width / this.width, height / (this.width / 3));
    this.world.scale.set(scale);
    this.world.position.set((width - this.width * scale) / 2, height * (400 / 480) - this.groundY * scale);
  }
  setDebug(value: boolean): void { this.showBoxes = value; }
  enqueueResults(frame: BattleSnapshot): void {
    for (const event of frame.results) this.pendingEffects.push({ event, frame });
    if (this.pendingEffects.length > 240) this.pendingEffects.splice(0, this.pendingEffects.length - 240);
  }
  reset(): void {
    this.vfx.reset();
    this.pendingEffects.length = 0;
    for (const entry of this.labels) entry.label.destroy();
    this.labels.length = 0;
    for (const entry of this.avatars.values()) entry.view.destroy();
    this.avatars.clear();
    for (const graphic of this.flying.values()) graphic.destroy();
    this.flying.clear();
  }
  render(frame: BattleSnapshot, elapsedSeconds: number): void {
    if (!this.ready) return;
    if (frame.width !== this.width || frame.groundY !== this.groundY) {
      this.width = frame.width; this.groundY = frame.groundY;
      this.layout();
    }
    const delta = Math.min(elapsedSeconds, 0.1);
    const ids = new Set(frame.combatants.map(c => c.entityId));
    this.debug.clear();
    for (const [id, entry] of this.avatars) if (!ids.has(id)) { entry.view.destroy(); this.avatars.delete(id); }
    for (const c of frame.combatants) {
      let entry = this.avatars.get(c.entityId);
      if (entry && entry.heroId !== c.heroId) { entry.view.destroy(); this.avatars.delete(c.entityId); entry = undefined; }
      if (!entry) {
        entry = { view: this.avatarFactory(heroById(c.heroId)), lastX: c.centerX, heroId: c.heroId };
        this.actors.addChild(entry.view.root); this.avatars.set(c.entityId, entry);
      }
      const cast = frame.casts.find(s => s.castId === c.currentCastId);
      const action: AvatarAction = !c.alive ? 'dead' : cast ? cast.phase.toLowerCase() as AvatarAction
        : c.feetY < frame.groundY - 1 ? 'jump' : Math.abs(c.centerX - entry.lastX) > 0.02 ? 'move' : 'idle';
      entry.view.present(c, action, delta, cast, { tick: frame.presentationTick ?? Number(frame.serverTick),
        tickRate: frame.tickRate || 30, groundY: frame.groundY }); entry.lastX = c.centerX;
      const shield = c.statuses.some(s => effects.get(s.effectId)?.type === 'SHIELD');
      if (shield) this.debug.ellipse(c.centerX, c.feetY - 60, 36, 68).stroke({ color: 0xe8c980, width: 2, alpha: 0.7 });
      if (this.showBoxes) {
        const hero = heroById(c.heroId);
        this.debug.rect(c.centerX - hero.width / 2, c.feetY - hero.height, hero.width, hero.height)
          .stroke({ color: hero.color, width: 1, alpha: 0.85 });
      }
    }
    const projectileIds = new Set(frame.projectiles.map(p => p.instanceId));
    for (const [id, g] of this.flying) if (!projectileIds.has(id)) { g.destroy(); this.flying.delete(id); }
    for (const p of frame.projectiles) {
      let graphic = this.flying.get(p.instanceId);
      if (!graphic) {
        graphic = new Graphics().star(0, 0, 4, 13, 4).fill(0xdde7de).stroke({ color: 0x476c6f, width: 1 });
        this.projectiles.addChild(graphic); this.flying.set(p.instanceId, graphic);
      }
      graphic.position.set(p.x, p.y); graphic.rotation += delta * 16;
    }
    const shownTick = Number(frame.serverTick);
    for (let i = this.pendingEffects.length - 1; i >= 0; i--) {
      const pending = this.pendingEffects[i];
      if (Number(pending.event.serverTick) > shownTick) continue;
      this.pendingEffects.splice(i, 1);
      if (shownTick - Number(pending.event.serverTick) <= 8) {
        const target = pending.frame.combatants.find(c => c.userId === pending.event.targetUserId);
        this.avatars.get(target?.entityId ?? '')?.view.react?.(pending.event);
        this.addResult(pending.event, pending.frame);
        this.vfx.result(pending.event, pending.frame);
      }
    }
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const label = this.labels[i]; label.age += delta;
      if (label.age > 0.85) { label.label.destroy(); this.labels.splice(i, 1); continue; }
      label.label.position.set(label.x, label.y - label.age * 30);
      label.label.alpha = Math.min(1, (0.85 - label.age) * 4);
    }
    this.vfx.update(frame, delta);
    if (this.showBoxes) this.debug.moveTo(0, frame.groundY).lineTo(this.width, frame.groundY).stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
    this.app.render();
  }
  private addResult(event: CombatEvent, frame: BattleSnapshot): void {
    const c = frame.combatants.find(c => c.userId === event.targetUserId);
    if (!c || !['DAMAGE', 'CRITICAL_DAMAGE', 'HEAL', 'BLOCKED', 'EVADED', 'PASSIVE_TRIGGERED'].includes(event.type)) return;
    const text = event.type === 'BLOCKED' ? '格挡' : event.type === 'EVADED' ? '闪避'
      : event.type === 'PASSIVE_TRIGGERED' ? '被动触发' : `${event.type === 'HEAL' ? '+' : '−'}${event.value}`;
    const label = new Text({ text, style: { fontFamily: 'sans-serif', fontSize: 21, fontWeight: 'bold',
      fill: event.type === 'HEAL' ? 0x9ce3bd : event.type === 'CRITICAL_DAMAGE' ? 0xffc96c : 0xffffff,
      stroke: { color: 0x14232b, width: 3 } } });
    label.anchor.set(0.5); this.actors.addChild(label);
    this.labels.push({ label, age: 0, x: c.centerX, y: c.feetY - 135 });
    if (this.labels.length > 64) this.labels.shift()!.label.destroy();
  }
  destroy(): void { this.resize?.disconnect(); this.reset(); this.app.destroy(true, { children: true }); }
}
