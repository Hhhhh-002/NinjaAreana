import { describe, expect, it } from 'vitest';
import { decode, encode } from '../src/net/protocol';
import { CMD } from '../src/generated/commands';
import type { BattleSnapshot } from '../src/model';

describe('shared Protobuf schema', () => {
  it('round-trips uint64 identifiers above JavaScript safe integer range exactly', () => {
    const id = '18446744073709551610';
    const binary = encode('BattleStateSnapshot', { battleId: id, serverTick: '105', width: 1440,
      groundY: 400, tickRate: 30, combatants: [{ entityId: id, userId: 'a', heroId: 101 }] });
    const decoded = decode<BattleSnapshot>('BattleStateSnapshot', binary);
    expect(decoded.battleId).toBe(id); expect(decoded.combatants[0].entityId).toBe(id);
    expect(decoded.projectiles).toEqual([]);
  });
  it('matches the Java wire format for cast skill 1001 and retains string request IDs', () => {
    const body = encode('CastSkillRequest', { skillId: 1001 });
    expect([...body]).toEqual([8, 233, 7]);
    const packet = encode('ClientEnvelope', { cmd: CMD.CAST_SKILL, requestId: '1782400000000000001', body, clientSequence: '5' });
    const decoded = decode<any>('ClientEnvelope', packet);
    expect(decoded.cmd).toBe(2012); expect(decoded.requestId).toBe('1782400000000000001');
    expect(decode<any>('CastSkillRequest', decoded.body).skillId).toBe(1001);
  });
});
