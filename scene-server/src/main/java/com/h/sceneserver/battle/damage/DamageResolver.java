package com.h.sceneserver.battle.damage;
import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.battle.skill.*;
import com.h.sceneserver.battle.status.*;
import com.h.sceneserver.battle.passive.PassiveProcessor;
import java.util.*;
import static com.h.ninja.config.CombatTypes.EffectType.*;

/** 直接扣盾、扣 HP、处理死亡和受伤后被动。 */
public final class DamageResolver {
    private final PassiveProcessor passives;
    private final SkillProcessor skills;
    public DamageResolver(PassiveProcessor passives,SkillProcessor skills) {this.passives=passives;this.skills=skills;}
    public DamageResult damage(BattleState b,long source,CombatantState target,int skill,long cast,double amount,boolean basic) {
        int old=target.hp;
        if(!target.alive || target.statuses.has(INVINCIBLE,b.tick))return new DamageResult(0,0,old,old,false);
        boolean critical=basic && b.random.nextDouble()<0.05;double value=amount*(critical?1.5:1);
        for(var s:target.statuses.active(b.tick))if(s.definition.type()==DAMAGE_REDUCTION)value*=1-Math.max(0,Math.min(1,s.definition.value()));
        int remaining=(int)Math.max(0,Math.floor(value)),absorbed=0;
        List<StatusInstance> shields=target.statuses.active(b.tick).stream().filter(s->s.definition.type()==SHIELD)
                .sorted(Comparator.comparingLong((StatusInstance s)->s.endTick).thenComparingLong(s->s.instanceId)).toList();
        for(var s:shields) {
            int taken=(int)Math.min(s.remainingShield,remaining);s.remainingShield-=taken;remaining-=taken;absorbed+=taken;
            if(s.remainingShield<=0)s.removed=true;
        }
        target.hp=Math.max(0,old-remaining);
        b.result(critical?"CRITICAL_DAMAGE":"DAMAGE",source,target.entityId,skill,cast,old-target.hp);
        if(absorbed>0)b.result("SHIELD_ABSORBED",source,target.entityId,skill,cast,absorbed);
        if(target.hp==0)die(b,target,source,skill,cast);else passives.afterHpDamage(b,target,old);
        return new DamageResult(old-target.hp,absorbed,old,target.hp,critical);
    }
    public void die(BattleState b,CombatantState c,long source,int skill,long cast) {
        c.hp=0;c.alive=false;c.input.moveAxis=0;c.input.blocking=false;c.movement.forcedMotion=null;
        c.statuses.byEffectId.values().forEach(s->s.removed=true);c.statuses.byEffectId.clear();
        c.passives.progressBySkillId.values().forEach(p->p.hitTicks.clear());
        for(var active:b.casts.values())if(active.casterEntityId==c.entityId)skills.finish(b,active,true);
        b.result("DEATH",source,c.entityId,skill,cast,0);
    }
}
