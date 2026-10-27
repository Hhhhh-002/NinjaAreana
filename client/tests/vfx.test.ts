import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { SkillVfx, isDirectHit } from '../src/render/SkillVfx';
import type { BattleSnapshot, CombatEvent } from '../src/model';

const frameAt = (tick: number): BattleSnapshot => ({ battleId: '1', serverTick: String(tick), started: true, tickRate: 30,
  width: 1440, groundY: 400, results: [], projectiles: [],
  casts: [{ castId: '7', casterEntityId: '1', skillId: 1001, phase: tick < 105 ? 'STARTUP' : 'ACTIVE', endTick: '118' }],
  combatants: [{ entityId: '1', userId: 'a', heroId: 101, hp: 1000, mana: 75, guard: 100,
    centerX: 300, feetY: 400, alive: true, currentCastId: '7', facing: 1, statuses: [] }] });
const harness = () => {
  const views: { name: string; root: Container; samples: number[]; destroyed: boolean }[] = [];
  const vfx = new SkillVfx(name => {
    const view = { name, root: new Container(), samples: [] as number[], destroyed: false };
    views.push(view);
    return { root: view.root, present: (_name, seconds) => { view.samples.push(seconds); },
      destroy: () => { view.destroyed = true;view.root.destroy(); } };
  }, () => 0.5);
  return { vfx, views };
};
describe('native Spine effects follow authoritative presentation time', () => {
  it('plays charge before the swing, seeks late frames, never duplicates or advances a frozen snapshot', () => {
    const { vfx, views } = harness();const frame = frameAt(104);
    vfx.update(frame, 1/60);expect(views[0].name).toBe('fx_wind_charge');
    expect(views[0].samples.at(-1)).toBeCloseTo(4/30);
    frame.serverTick='107';vfx.update(frame, 1/60);
    expect(views[0].destroyed).toBe(true);expect(views[1].name).toBe('fx_wind_slash');
    expect(views[1].samples.at(-1)).toBeCloseTo(2/30);
    vfx.update(frame, 1);expect(views).toHaveLength(2);expect(views[1].samples.at(-1)).toBeCloseTo(2/30);
    frame.serverTick='114';vfx.update(frame);expect(vfx.root.children).toHaveLength(0);
  });
  it('removes cancelled cast effects immediately and does not create cues skipped by a rebase', () => {
    const { vfx, views }=harness();const frame=frameAt(105);vfx.update(frame);
    frame.casts=[];frame.serverTick='106';vfx.update(frame);expect(views[0].destroyed).toBe(true);
    vfx.reset();vfx.update(frameAt(140));expect(vfx.root.children).toHaveLength(0);
  });
  it('keeps statuses after the cast ends, seeks a refresh and removes a depleted shield', () => {
    const { vfx, views }=harness();const frame=frameAt(120);frame.casts=[];
    frame.combatants[0].statuses=[{instanceId:'8',effectId:13,endTick:'200',remainingShield:200}];
    vfx.update(frame);expect(views[0].name).toBe('fx_rock_shield');
    expect(views[0].samples.at(-1)).toBeCloseTo(10/30);
    frame.combatants[0].statuses[0].endTick='210';vfx.update(frame);
    expect(views[0].samples.at(-1)).toBe(0);
    frame.combatants[0].statuses=[];vfx.update(frame);expect(views[0].destroyed).toBe(true);
    vfx.reset();expect(vfx.root.children).toHaveLength(0);
  });
  it('uses projectile snapshots for native shuriken position and removal, independently of casts', () => {
    const { vfx, views }=harness();const frame=frameAt(120);frame.casts=[];
    frame.projectiles=[{instanceId:'9',sourceCastId:'7',ownerEntityId:'1',skillId:1003,x:500,y:340,facing:-1}];
    vfx.update(frame);expect(views[0].name).toBe('fx_shuriken');expect(views[0].root.x).toBe(500);
    expect(views[0].root.y).toBe(405);expect(views[0].root.scale.x).toBe(-0.5);
    frame.projectiles=[];vfx.update(frame);expect(views[0].destroyed).toBe(true);
  });
  it('plays heal pulses only for actual heal results and never treats periodic damage as a new impact', () => {
    const { vfx, views }=harness();const frame=frameAt(135);frame.casts=[];
    const event={serverTick:'135',type:'DAMAGE',skillId:1001,castId:'7',targetUserId:'a',sourceUserId:'b',value:8} as CombatEvent;
    expect(isDirectHit(event,frame)).toBe(false);vfx.result(event,frame);expect(views).toHaveLength(0);
    vfx.result({...event,type:'HEAL',value:10},frame);vfx.update(frame);
    expect(views[0].name).toBe('fx_regen_pulse');
    frame.serverTick='145';vfx.update(frame);expect(views[0].destroyed).toBe(true);
  });
});
