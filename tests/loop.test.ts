import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../src/loop/FixedStepLoop';
import { SnapshotBuffer } from '../src/loop/SnapshotBuffer';
import type { BattleSnapshot } from '../src/model';

function frame(tick: number, x: number, hp = 1000, battleId = '18446744073709551610'): BattleSnapshot {
  return { battleId, serverTick: String(tick), width: 1440, groundY: 400, started: true, tickRate: 30,
    casts: [], results: [], projectiles: [], combatants: [{ userId: 'a', entityId: '18446744073709551600', heroId: 101,
      hp, mana: 100, guard: 100, centerX: x, feetY: 400, alive: true, currentCastId: '', facing: 1, statuses: [] }] };
}
describe('fixed step presentation clock', () => {
  it('executes no more than ten updates after a long stall and drops the rest', () => {
    const clock = new FixedStepClock(); let count = 0;
    clock.advance(0, () => count++);
    const result = clock.advance(1000, () => count++);
    expect(count).toBe(10); expect(result.steps).toBe(10); expect(result.dropped).toBe(20);
    expect(result.alpha).toBeCloseTo(0);
    expect(clock.advance(1010, () => count++).steps).toBe(0);
  });
  it('preserves the fractional remainder for interpolation at high display rates', () => {
    const clock = new FixedStepClock(); clock.advance(0, () => {});
    expect(clock.advance(50, () => {}).alpha).toBeCloseTo(0.5);
    clock.reset(); expect(clock.advance(5000, () => {}).steps).toBe(0);
  });
});
describe('authoritative snapshot interpolation', () => {
  it('interpolates coordinates, retains discrete HP and never mutates authoritative snapshots', () => {
    const buffer = new SnapshotBuffer(); const first = frame(10, 0), second = frame(12, 20, 850);
    buffer.push(first); buffer.push(second);
    for (let i = 0; i < 4; i++) buffer.step(1 / 30);
    const sampled = buffer.sample(0.5)!;
    expect(sampled.combatants[0].centerX).toBeCloseTo(15);
    expect(sampled.combatants[0].hp).toBe(1000);
    expect(first.combatants[0].centerX).toBe(0);
    expect(buffer.sample(1)!.combatants[0].hp).toBe(850);
  });
  it('rejects older ticks, resets between battles and rebases large gaps without extrapolating', () => {
    const buffer = new SnapshotBuffer(); buffer.push(frame(10, 40));
    expect(buffer.push(frame(9, 999))).toBe(false);
    buffer.push(frame(100, 100)); buffer.step(1 / 30);
    expect(buffer.sample(1)!.combatants[0].centerX).toBeLessThanOrEqual(100);
    buffer.push(frame(0, 7, 1000, 'new-battle'));
    expect(buffer.sample(1)!.combatants[0].centerX).toBe(7);
  });
  it('does not blend newly spawned projectiles or dead/alive values backwards in time', () => {
    const buffer = new SnapshotBuffer(); const a = frame(10, 0), b = frame(11, 10);
    b.projectiles.push({ instanceId: 'p', sourceCastId: 'c', ownerEntityId: 'a', skillId: 1003, x: 30, y: 350, facing: 1 });
    b.combatants[0].alive = false;
    buffer.push(a); buffer.push(b);
    for (let i = 0; i < 3; i++) buffer.step(1 / 30);
    expect(buffer.sample(0.5)!.projectiles).toHaveLength(0);
    expect(buffer.sample(0.5)!.combatants[0].alive).toBe(true);
    expect(buffer.sample(1)!.projectiles).toHaveLength(1);
  });
});
