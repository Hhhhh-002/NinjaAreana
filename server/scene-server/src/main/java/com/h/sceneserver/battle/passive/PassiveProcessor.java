package com.h.sceneserver.battle.passive;
import com.h.ninja.config.*;
import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.battle.status.StatusProcessor;
import com.h.sceneserver.battle.skill.SkillCastInstance;
import static com.h.ninja.config.CombatTypes.Trigger.*;

/** 伤害/格挡时直接调用；不产生待执行事件。 */
public final class PassiveProcessor {
    private final StatusProcessor statuses;
    public PassiveProcessor(StatusProcessor statuses) {this.statuses=statuses;}
    public void afterHpDamage(BattleState b,CombatantState owner,int oldHp) {
        if(!owner.alive || oldHp==owner.hp)return;
        for(var entry:owner.passives.progressBySkillId.entrySet())for(var e:b.configs.skills().get(entry.getKey()).effects()) {
            if(e.trigger()!=ON_HP_CROSS_BELOW)continue;
            var p=entry.getValue();double threshold=owner.definition.maxHp()*e.triggerValue();
            if(oldHp>=threshold && owner.hp<threshold && eligible(b,e,p))trigger(b,owner,e,p);
        }
    }
    public void basicHit(BattleState b,CombatantState owner,SkillCastInstance cast) {
        if(!owner.alive || !cast.basic || cast.basicHitCounted)return;cast.basicHitCounted=true;
        for(var entry:owner.passives.progressBySkillId.entrySet())for(var e:b.configs.skills().get(entry.getKey()).effects()) {
            if(e.trigger()!=ON_BASIC_HIT_COUNT)continue;var p=entry.getValue();
            if(!eligible(b,e,p)){p.hitTicks.clear();continue;}
            while(!p.hitTicks.isEmpty() && b.tick-p.hitTicks.peekFirst()>=e.triggerWindowTicks())p.hitTicks.removeFirst();
            p.hitTicks.addLast(b.tick);if(p.hitTicks.size()>=e.triggerCount())trigger(b,owner,e,p);
        }
    }
    public void basicBlocked(CombatantState owner) {owner.passives.progressBySkillId.values().forEach(p->p.hitTicks.clear());}
    private boolean eligible(BattleState b,EffectDefinition e,PassiveProgress p) {
        return b.tick>=p.cooldownEndTick && (e.maxTriggersPerBattle()==0 || p.triggerCount<e.maxTriggersPerBattle());
    }
    private void trigger(BattleState b,CombatantState c,EffectDefinition e,PassiveProgress p) {
        p.triggerCount++;p.cooldownEndTick=b.tick+e.internalCooldownTicks();p.hitTicks.clear();
        statuses.apply(b,c,e,c.entityId,0);b.result("PASSIVE_TRIGGERED",c.entityId,c.entityId,e.skillId(),0,0);
    }
}
