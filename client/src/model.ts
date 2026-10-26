/** All 64-bit protocol identifiers stay decimal strings; never convert battle/cast/entity IDs to JS number. */
export interface Status { instanceId: string; effectId: number; endTick: string; remainingShield: number }
export interface Combatant {
  userId: string; entityId: string; heroId: number; hp: number; mana: number; guard: number;
  centerX: number; feetY: number; alive: boolean; currentCastId: string; facing: number; statuses: Status[];
  blocking?: boolean; grounded?: boolean; velocityY?: number;
}
export interface Cast { castId: string; casterEntityId: string; skillId: number; phase: string; endTick: string }
export interface Projectile { instanceId: string; sourceCastId: string; ownerEntityId: string; skillId: number; x: number; y: number; facing: number }
export interface CombatEvent {
  serverTick: string; type: string; sourceUserId: string; targetUserId: string;
  skillId: number; value: number; hp: number; guard: number; castId: string;
}
export interface BattleSnapshot {
  battleId: string; serverTick: string; combatants: Combatant[]; casts: Cast[]; projectiles: Projectile[];
  results: CombatEvent[]; started: boolean; tickRate: number; width: number; groundY: number;
  /** Fractional presentation time; never serialized back to the server. */
  presentationTick?: number;
}
export interface RankingPlayer { userId: string; nickname: string; rank: number; hp: number; heroId: number }
export interface MatchRanking { sceneId: string; frozen: boolean; endReason: number; players: RankingPlayer[] }
export interface HistoryItem {
  matchId: string; nickname: string; rank: number; playerCount: number; startTime: string; endTime: string; hp: number; heroId: number;
}
