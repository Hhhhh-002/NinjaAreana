import { Container, Graphics } from 'pixi.js';
import type { Cast, Combatant, CombatEvent } from '../model';
import type { Hero } from '../catalog';

export type AvatarAction = 'idle' | 'move' | 'jump' | 'startup' | 'active' | 'recovery' | 'dead';
export interface AvatarContext { tick: number; tickRate: number; groundY: number }
/** Spine integration seam: replace the factory, keep networking and render interpolation unchanged. */
export interface AvatarView {
  readonly root: Container;
  present(state: Combatant, action: AvatarAction, deltaSeconds: number, cast?: Cast, context?: AvatarContext): void;
  react?(event: CombatEvent): void;
  destroy(): void;
}
export type AvatarFactory = (hero: Hero) => AvatarView;

/** Temporary vector silhouette with feet at local (0,0). No pretend Spine asset or runtime dependency. */
export class PlaceholderAvatar implements AvatarView {
  readonly root = new Container();
  private body = new Container();
  constructor(hero: Hero) {
    const shade = new Graphics().ellipse(0, 0, 32, 7).fill({ color: 0x080e12, alpha: 0.45 });
    const silhouette = new Graphics()
      .poly([-16, -64, -23, -36, -9, -34, -12, -5, -25, -2, -25, 0, -3, 0, 3, -31, 12, -6, 10, 0, 29, 0, 29, -4, 20, -8, 17, -45, 22, -49, 18, -76, 9, -84, -8, -84])
      .fill(0x17272e).stroke({ color: hero.color, width: 1.5, alpha: 0.75 });
    silhouette.circle(0, -102, 16).fill(0x1d2d34).stroke({ color: hero.color, width: 1.5 });
    silhouette.roundRect(-15, -107, 30, 7, 2).fill(hero.color);
    silhouette.rect(2, -104, 8, 2).fill(0xeaf5e9);
    silhouette.poly([-15, -105, -35, -96, -20, -93, -13, -100]).fill(hero.color);
    silhouette.poly([-16, -57, 19, -57, 20, -50, -16, -50]).fill(hero.color);
    silhouette.moveTo(13, -78).lineTo(34, -27).stroke({ color: 0xcbd6ce, width: 3 });
    silhouette.moveTo(9, -85).lineTo(15, -73).stroke({ color: 0xdec48a, width: 4 });
    this.body.addChild(silhouette);
    this.root.addChild(shade, this.body);
  }
  present(state: Combatant, action: AvatarAction): void {
    this.root.position.set(state.centerX, state.feetY);
    this.body.scale.set(state.facing < 0 ? -1 : 1, 1);
    this.body.rotation = action === 'dead' ? -1.2 * (state.facing < 0 ? -1 : 1) : 0;
    this.root.alpha = state.alive ? 1 : 0.48;
  }
  destroy(): void { this.root.destroy({ children: true }); }
}
