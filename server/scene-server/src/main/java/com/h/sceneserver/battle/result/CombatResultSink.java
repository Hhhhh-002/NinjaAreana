package com.h.sceneserver.battle.result;

import com.h.sceneserver.battle.state.BattleState;
import com.h.gameprotocol.proto.*;

/** 构建不可变 Protobuf 快照。这里只读取状态，不再执行战斗操作。 */
public final class CombatResultSink {
    private CombatResultSink() {}
    public static BattleStateSnapshot snapshot(BattleState b,boolean started) {
        var result=BattleStateSnapshot.newBuilder().setBattleId(b.battleId).setServerTick(b.tick).setStarted(started)
                .setTickRate(b.rules.tickRate()).setWidth(b.rules.width()).setGroundY(b.rules.groundY());
        for(var c:b.combatants.values()) {
            var entity=CombatantSnapshot.newBuilder().setUserId(c.playerId).setEntityId(c.entityId).setHeroId(c.definition.heroId())
                    .setHp(c.hp).setMana(c.mana).setGuard(c.guard).setCenterX(c.transform.centerX).setFeetY(c.transform.feetY)
                    .setAlive(c.alive).setFacing(c.facing.sign).setCurrentCastId(c.currentCastId==null?"":Long.toUnsignedString(c.currentCastId))
                    .setBlocking(c.input.blocking).setGrounded(c.movement.grounded).setVelocityY(c.movement.velocityY);
            for(var s:c.statuses.byEffectId.values())if(s.active(b.tick))entity.addStatuses(StatusSnapshot.newBuilder()
                    .setInstanceId(s.instanceId).setEffectId(s.definition.effectId()).setEndTick(s.endTick).setRemainingShield(s.remainingShield));
            result.addCombatants(entity);
        }
        for(var c:b.casts.values())result.addCasts(CastSnapshot.newBuilder().setCastId(c.castId).setCasterEntityId(c.casterEntityId)
                .setSkillId(c.definition.skillId()).setPhase(c.phase.name()).setEndTick(c.endTick));
        for(var p:b.projectiles.values())result.addProjectiles(ProjectileSnapshot.newBuilder().setInstanceId(p.instanceId)
                .setSourceCastId(p.sourceCastId).setOwnerEntityId(p.ownerEntityId).setSkillId(p.skill.skillId()).setX(p.x).setY(p.y).setFacing(p.facing.sign));
        for(var e:b.combatResults) {
            var source=b.combatants.get(e.sourceEntityId());var target=b.combatants.get(e.targetEntityId());
            result.addResults(CombatEvent.newBuilder().setServerTick(e.tick()).setType(e.type())
                    .setSourceUserId(source==null?"":source.playerId).setTargetUserId(target==null?"":target.playerId)
                    .setSkillId(e.skillId()).setCastId(Long.toUnsignedString(e.castId())).setValue(e.value()).setHp(e.hp()).setGuard(e.guard()));
        }
        return result.build();
    }
}
