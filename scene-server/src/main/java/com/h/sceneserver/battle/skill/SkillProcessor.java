package com.h.sceneserver.battle.skill;
import com.h.ninja.config.*;
import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.battle.collision.HitboxInstance;
import com.h.sceneserver.battle.effect.EffectExecutor;
import static com.h.ninja.config.CombatTypes.*;
import static com.h.sceneserver.battle.skill.SkillCastInstance.Phase.*;

/** 校验、施法阶段和动作占用；不管理网络消息。 */
public final class SkillProcessor {
    public SkillCastInstance cast(BattleState b,CombatantState c,int skillId,long requestId) {
        SkillDefinition s=b.configs.skills().get(skillId);
        if(s==null || s.type()!=SkillType.ACTIVE || !c.loadout.allowedSkillIds.contains(skillId)
                || !s.enabled(b.rules.mode()) || s.heroId()!=c.definition.heroId())
            throw new IllegalArgumentException("技能不属于当前角色或模式");
        if(!c.alive || c.currentCastId!=null || c.input.blocking)throw new IllegalArgumentException("当前动作不能释放技能");
        if(s.castCondition()==CastCondition.GROUND_ONLY && !c.movement.grounded)
            throw new IllegalArgumentException("该技能只能在地面释放");
        if(c.mana<s.manaCost() || !c.cooldowns.ready(skillId,b.tick))throw new IllegalArgumentException("蓝量不足或技能冷却中");
        var cast=new SkillCastInstance(b.nextId(),c.entityId,requestId,s,c.facing,b.tick,b.rules.basicAttackSkillIds().contains(skillId));
        c.mana-=s.manaCost();c.cooldowns.readyTickBySkillId.put(skillId,b.tick+s.cooldownTicks());
        c.currentCastId=cast.castId;b.casts.put(cast.castId,cast);
        b.result("CAST_STARTED",c.entityId,c.entityId,skillId,cast.castId,0);return cast;
    }
    public void finishExpiredAtTick(BattleState b) {
        for(var cast:b.casts.values())if(!cast.finished && b.tick>=cast.endTick)finish(b,cast,false);
    }
    public void update(BattleState b,EffectExecutor effects) {
        for(var cast:b.casts.values().toArray(SkillCastInstance[]::new)) {
            if(cast.finished)continue;
            CombatantState c=b.combatants.get(cast.casterEntityId);
            if(c==null || !c.alive){finish(b,cast,true);continue;}
            if(b.tick<cast.activeStartTick){cast.phase=STARTUP;continue;}
            if(b.tick>=cast.recoveryStartTick){cast.phase=RECOVERY;cast.hitboxes.clear();continue;}
            cast.phase=ACTIVE;
            if(!cast.activeEntered) {
                cast.activeEntered=true;
                effects.execute(b,cast.definition,Trigger.ON_CAST,c,c,cast.castId,cast.facing,false);
                if(cast.definition.hitbox()!=null)cast.hitboxes.add(new HitboxInstance(b.nextId(),cast.castId,cast.definition.hitbox()));
            }
        }
    }
    public void finish(BattleState b,SkillCastInstance cast,boolean cancelled) {
        if(cast.finished)return;
        cast.finished=true;cast.phase=FINISHED;cast.hitboxes.clear();
        CombatantState c=b.combatants.get(cast.casterEntityId);
        if(c!=null) {
            if(c.currentCastId!=null && c.currentCastId==cast.castId)c.currentCastId=null;
            if(cancelled && c.movement.forcedMotion!=null && c.movement.forcedMotion.sourceCastId==cast.castId)c.movement.forcedMotion=null;
        }
        b.result(cancelled?"CAST_CANCELLED":"CAST_FINISHED",cast.casterEntityId,cast.casterEntityId,cast.definition.skillId(),cast.castId,0);
    }
    /** 仅在实际控制规则触发时调用，不给普通伤害自动添加硬直。 */
    public void interrupt(BattleState b,CombatantState c,boolean forcedControl) {
        SkillCastInstance cast=c.currentCastId==null?null:b.casts.get(c.currentCastId);
        if(cast!=null && (forcedControl || cast.phase!=STARTUP || cast.definition.canInterrupt()))finish(b,cast,true);
    }
}
