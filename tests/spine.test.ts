import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import spine from '../src/vendor/spine38';
import { animations, createSkeleton, parseSpine, validateSkeleton } from '../src/render/SpineAssets';
import { AnimationDirector } from '../src/render/AnimationDirector';
import type { Cast, Combatant, CombatEvent } from '../src/model';
import { SpineAvatar } from '../src/render/SpineAvatar';
import { heroById } from '../src/catalog';

const state = (changes: Partial<Combatant> = {}): Combatant => ({
  userId: 'a', entityId: '1', heroId: 101, hp: 1000, mana: 100, guard: 100,
  centerX: 300, feetY: 400, alive: true, currentCastId: '', facing: 1, statuses: [], grounded: true, ...changes,
});
const context = (tick: number) => ({ tick, tickRate: 30, groundY: 400 });

describe('supplied Spine 3.8 cutout assets', () => {
  for (const hero of animations.heroes) it(`parses hero ${hero.id}, evaluates every animation and produces finite textured quads`, () => {
    const base = new URL(`../public/assets/spine/${hero.key}/${hero.key}`, import.meta.url);
    const data = parseSpine(JSON.parse(readFileSync(fileURLToPath(`${base.href}.json`), 'utf8')),
      readFileSync(fileURLToPath(`${base.href}.atlas`), 'utf8'), 1024, 1024);
    const skeleton = createSkeleton(data);
    validateSkeleton(skeleton);
    expect(data.animations.length).toBe(Object.keys(hero.animations).length);
    const vertices = new Float32Array(8);
    for (const animation of data.animations) {
      for (let step = 0; step <= Math.ceil(animation.duration * 30); step++) {
        skeleton.setToSetupPose();
        animation.apply(skeleton, 0, Math.min(animation.duration, step / 30), false, null, 1,
          spine.MixBlend.replace, spine.MixDirection.mixIn);
        skeleton.updateWorldTransform();
        for (const slot of skeleton.drawOrder) {
          const attachment = slot.getAttachment()!;
          attachment.computeWorldVertices(slot.bone, vertices, 0, 2);
          expect([...vertices].every(Number.isFinite)).toBe(true);
          expect(Array.from(attachment.uvs).every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
        }
        const root = skeleton.bones.find(b => b.data.name === 'root')!;
        expect(root.worldX).toBe(0); expect(root.worldY).toBe(0);
      }
    }
    const run = data.findAnimation('run')!;
    for (let step = 0; step <= 24; step++) {
      skeleton.setToSetupPose();
      run.apply(skeleton, 0, step / 30, true, null, 1, spine.MixBlend.replace, spine.MixDirection.mixIn);
      skeleton.updateWorldTransform();
      for (const side of ['front', 'back']) {
        const foot = skeleton.bones.find(b => b.data.name === `foot_${side}`)!;
        const soleTilt = Math.atan2(foot.c, foot.a) * 180 / Math.PI + 90;
        expect(Math.abs(soleTilt)).toBeLessThan(10);
      }
    }
    // Exercise the actual Pixi mesh adapter without needing a GPU/browser context.
    const avatar = new SpineAvatar(heroById(hero.id), { data, texture: Texture.WHITE, scale: 0.5 });
    avatar.present(state({ heroId: hero.id, facing: -1 }), 'move', 1 / 60);
    expect(avatar.root.x).toBe(300); expect(avatar.root.y).toBe(400);
    expect(avatar.root.children[1].children).toHaveLength(20);
    avatar.present(state({ heroId: hero.id, alive: false }), 'dead', 1 / 60);
    avatar.destroy();
    expect(avatar.root.destroyed).toBe(true);
  });
});

describe('authoritative animation selection', () => {
  const cast: Cast = { castId: '90071992547409999', casterEntityId: '1', skillId: 1001, phase: 'STARTUP', endTick: '118' };
  it('plays the configured basic attack for both heroes', () => {
    for (const [hero, skill] of [[101, 1101], [102, 2101]]) {
      const director = new AnimationDirector(hero);
      const attack = director.layers(state({ heroId: hero }), 'active', 0,
        { ...cast, skillId: skill, phase: 'ACTIVE', endTick: '115' }, context(105));
      expect(attack[0].name).toBe('attack_light_1');
      expect(attack[0].seconds).toBeCloseTo(5 / 30);
    }
  });
  it('layers moving startup, then seeks the full skill without restarting on phase change', () => {
    const director = new AnimationDirector(101); director.moving = true;
    const first = director.layers(state(), 'startup', 1 / 60, cast, context(102.5));
    expect(first.map(l => l.name)).toEqual(['run', 'skill_wind_dash_startup_upper']);
    expect(first[1].seconds).toBeCloseTo(2.5 / 30);
    const active = director.layers(state(), 'active', 1 / 60, { ...cast, phase: 'ACTIVE' }, context(105.5));
    expect(active).toHaveLength(1); expect(active[0].name).toBe('skill_wind_dash');
    expect(active[0].seconds).toBeCloseTo(5.5 / 30);
    expect(director.layers(state(), 'active', 1 / 60, { ...cast, phase: 'ACTIVE' }, context(105.5))[0].seconds).toBe(active[0].seconds);
    const next = director.layers(state(), 'startup', 1 / 60, { ...cast, castId: '100', endTick: '218' }, context(200));
    expect(next[1].seconds).toBe(0);
  });
  it('selects airborne shadow step, holds that variant, and lets death override an active skill', () => {
    const director = new AnimationDirector(101);
    const shadow = { ...cast, skillId: 1002, phase: 'RECOVERY', endTick: '113' };
    expect(director.layers(state({ grounded: false }), 'recovery', 0, shadow, context(102))[0].name).toBe('skill_shadow_step_air');
    expect(director.layers(state({ grounded: true }), 'recovery', 0, shadow, context(103))[0].name).toBe('skill_shadow_step_air');
    expect(director.layers(state({ alive: false }), 'dead', 0, shadow, context(104))[0].name).toBe('death');
  });
  it('uses authoritative blocking and velocity, and does not turn periodic damage into a forced hurt pose', () => {
    const director = new AnimationDirector(102);
    expect(director.layers(state({ blocking: true }), 'idle', 0)[0].name).toBe('guard_start');
    director.layers(state({ blocking: true }), 'idle', 0.25);
    expect(director.layers(state({ blocking: true }), 'idle', 0)[0].name).toBe('guard_loop');
    director.react({ type: 'BLOCKED' } as CombatEvent);
    expect(director.layers(state(), 'idle', 0)[0].name).toBe('guard_hit');
    const jumping = new AnimationDirector(101);
    jumping.layers(state({ grounded: false, velocityY: -10 }), 'jump', 0);
    jumping.layers(state({ grounded: false, velocityY: -10 }), 'jump', 0.25);
    expect(jumping.layers(state({ grounded: false, velocityY: 2 }), 'jump', 0)[0].name).toBe('jump_fall');
    const normal = new AnimationDirector(101); normal.react({ type: 'DAMAGE' } as CombatEvent);
    expect(normal.layers(state(), 'idle', 0)[0].name).toBe('idle');
  });
});
