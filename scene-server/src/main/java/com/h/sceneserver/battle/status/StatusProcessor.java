package com.h.sceneserver.battle.status;
import com.h.ninja.config.*;
import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.battle.damage.DamageResolver;
import java.util.*;
import static com.h.ninja.config.CombatTypes.*;

public final class StatusProcessor {
    public void apply(BattleState b,CombatantState target,EffectDefinition e,long source,long cast) {
        if(!target.alive || e.durationTicks()<=0)return;
        StatusInstance old=target.statuses.byEffectId.get(e.effectId());if(old!=null)old.removed=true;
        var status=new StatusInstance(b.nextId(),e,source,cast,target.entityId,b.tick);
        target.statuses.byEffectId.put(e.effectId(),status);
        b.result("STATUS_APPLIED_"+e.type(),source,target.entityId,e.skillId(),cast,(int)e.value());
    }
    public void update(BattleState b,DamageResolver damage) {
        List<StatusInstance> snapshot=new ArrayList<>();
        for(var c:b.combatants.values())snapshot.addAll(c.statuses.byEffectId.values());
        snapshot.sort(Comparator.comparingLong(s->s.instanceId));
        for(var s:snapshot) {
            var target=b.combatants.get(s.targetEntityId);
            if(target==null || !target.alive || s.removed || target.statuses.byEffectId.get(s.definition.effectId())!=s)continue;
            EffectDefinition e=s.definition;
            while(e.periodic() && s.nextTriggerTick<=b.tick && s.nextTriggerTick<=s.endTick && !s.removed && target.alive) {
                s.nextTriggerTick+=e.intervalTicks();
                if(e.type()==EffectType.REGEN) {
                    int before=target.hp;target.hp=Math.min(target.definition.maxHp(),target.hp+(int)e.value());
                    b.result("HEAL",s.sourceEntityId,target.entityId,e.skillId(),s.sourceCastId,target.hp-before);
                } else damage.damage(b,s.sourceEntityId,target,e.skillId(),s.sourceCastId,e.value(),false);
            }
            if(b.tick>=s.endTick && !s.removed && target.statuses.byEffectId.get(e.effectId())==s) {
                s.removed=true;target.statuses.byEffectId.remove(e.effectId());
                b.result("STATUS_EXPIRED_"+e.type(),s.sourceEntityId,target.entityId,e.skillId(),s.sourceCastId,0);
            }
        }
    }
}
