package com.h.sceneserver.battle.result;
/** 已经发生的结果；客户端通知不会再次执行伤害或被动。 */
public record CombatResult(long tick,String type,long sourceEntityId,long targetEntityId,int skillId,
                           long castId,int value,int hp,int guard) {}
