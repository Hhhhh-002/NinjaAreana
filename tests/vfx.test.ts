import { describe, expect, it } from 'vitest';
import { SkillVfx } from '../src/render/SkillVfx';
import type { BattleSnapshot } from '../src/model';

describe('authoritative skill presentation', () => {
  it('waits for active time, plays once, removes expired auras and resets between matches', () => {
    const vfx = new SkillVfx();
    const frame: BattleSnapshot = { battleId: '1', serverTick: '104', started: true, tickRate: 30,
      width: 1440, groundY: 400, results: [], projectiles: [],
      casts: [{ castId: '7', casterEntityId: '1', skillId: 1001, phase: 'STARTUP', endTick: '118' }],
      combatants: [{ entityId: '1', userId: 'a', heroId: 101, hp: 1000, mana: 75, guard: 100,
        centerX: 300, feetY: 400, alive: true, currentCastId: '7', facing: 1, statuses: [] }] };
    vfx.update(frame, 0);expect(vfx.root.children).toHaveLength(0);
    frame.serverTick = '105';vfx.update(frame, 0);expect(vfx.root.children).toHaveLength(1);
    vfx.update(frame, 0);expect(vfx.root.children).toHaveLength(1);
    vfx.update(frame, 0.3);expect(vfx.root.children).toHaveLength(0);
    frame.combatants[0].statuses.push({ instanceId: '8', effectId: 13, endTick: '200', remainingShield: 200 });
    vfx.update(frame, 0);expect(vfx.root.children).toHaveLength(1);
    frame.combatants[0].statuses = [];vfx.update(frame, 0);expect(vfx.root.children).toHaveLength(0);
    vfx.reset();vfx.update(frame, 0);expect(vfx.root.children).toHaveLength(1);
    vfx.reset();expect(vfx.root.children).toHaveLength(0);
  });
});
