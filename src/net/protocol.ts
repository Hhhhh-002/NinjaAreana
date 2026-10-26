import protobuf from 'protobufjs/light';
import Long from 'long';
import descriptor from '../generated/protocol.json';
import { CMD } from '../generated/commands';

protobuf.util.Long = Long;
protobuf.configure();
const root = protobuf.Root.fromJSON(descriptor);
export const type = (name: string) => root.lookupType(`ballsgame.${name}`);
const options = { longs: String, enums: Number, defaults: true, arrays: true, objects: true };
export function encode(name: string, data: Record<string, unknown>): Uint8Array {
  const t = type(name);
  const value = t.fromObject(data);
  const error = t.verify(value);
  if (error) throw new Error(`协议字段错误：${error}`);
  return t.encode(value).finish();
}
export function decode<T = Record<string, unknown>>(name: string, bytes: Uint8Array): T {
  const t = type(name);
  return t.toObject(t.decode(bytes), options) as T;
}
export interface Envelope { cmd: number; requestId: string; code: number; message: string; body: Uint8Array }
export const requestBodies = new Map<number, string>([
  [CMD.LOGIN, 'LoginRequest'], [CMD.REGISTER, 'RegisterRequest'], [CMD.MATCH_HISTORY, 'MatchHistoryRequest'],
  [CMD.HEARTBEAT, 'HeartbeatRequest'], [CMD.START_GAME, 'StartGameRequest'], [CMD.LEAVE, 'LeaveRequest'],
  [CMD.SHIFT, 'ShiftRequest'], [CMD.JUMP, 'JumpRequest'], [CMD.BLOCK, 'BlockRequest'], [CMD.CAST_SKILL, 'CastSkillRequest'],
]);
export const responseBodies = new Map<number, string>([
  [CMD.LOGIN, 'LoginResponse'], [CMD.REGISTER, 'RegisterResponse'], [CMD.MATCH_HISTORY, 'MatchHistoryResponse'],
  [CMD.HEARTBEAT, 'HeartbeatResponse'], [CMD.START_GAME, 'StartGameResponse'], [CMD.CAST_SKILL, 'CastSkillResponse'],
  [CMD.BATTLE_SNAPSHOT, 'BattleStateSnapshot'], [CMD.MATCH_ENDED, 'MatchRanking'], [CMD.PLAYER_LEFT, 'PlayerLeftEvent'],
]);
