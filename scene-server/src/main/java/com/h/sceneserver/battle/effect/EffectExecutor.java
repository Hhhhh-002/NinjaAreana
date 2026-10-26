package com.h.sceneserver.battle.effect;

import com.h.ninja.config.*;
import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.battle.status.StatusProcessor;
import com.h.sceneserver.battle.movement.*;
import com.h.sceneserver.battle.projectile.ProjectileInstance;
import com.h.sceneserver.battle.damage.DamageResolver;
import java.util.*;
import static com.h.ninja.config.CombatTypes.*;

/** 效果类型 → 执行器；不保存战场数据，所有输入由所属 Actor 传入。 */
public final class EffectExecutor {
    private record Context(BattleState battle,CombatantState source,CombatantState target,long cast,Facing facing,boolean basic) {}
    @FunctionalInterface private interface Handler { boolean apply(Context context,EffectDefinition effect); }
    private final Map<EffectType,Handler> handlers=new EnumMap<>(EffectType.class);
    public EffectExecutor(StatusProcessor statuses,MovementProcessor movement,DamageResolver damage) {
        handlers.put(EffectType.DAMAGE,(c,e)->damage.damage(c.battle,c.source.entityId,c.target,e.skillId(),c.cast,e.value(),c.basic).effective());
        handlers.put(EffectType.GUARD_DAMAGE,(c,e)-> {
            c.target.guard=Math.max(0,c.target.guard-(int)e.value());
            c.battle.result("GUARD_DAMAGE",c.source.entityId,c.target.entityId,e.skillId(),c.cast,(int)e.value());return false;
        });
        handlers.put(EffectType.KNOCKBACK,(c,e)-> {movement.moveHorizontal(c.battle,c.target,c.facing.sign*e.value());return false;});
        handlers.put(EffectType.DASH,(c,e)-> {
            c.target.movement.forcedMotion=new ForcedMotion(c.cast,e.value(),e.durationTicks(),c.facing);return false;
        });
        handlers.put(EffectType.BACKSTEP,(c,e)-> {
            c.target.movement.forcedMotion=new ForcedMotion(c.cast,e.value(),e.durationTicks(),c.facing.opposite());return false;
        });
        handlers.put(EffectType.SPAWN_PROJECTILE,(c,e)-> {
            SkillDefinition skill=c.battle.configs.skills().get(e.skillId());
            if(skill.projectile()==null)throw new IllegalArgumentException("技能缺少投射物参数");
            var box=c.target.hurtbox.bounds(c.target.transform);
            for(int i=0;i<(int)e.value();i++) {
                var p=new ProjectileInstance(c.battle.nextId(),c.cast,c.source.entityId,skill,c.facing,
                        c.source.transform.centerX,(box.top()+box.bottom())/2);
                c.battle.projectiles.put(p.instanceId,p);
                c.battle.result("PROJECTILE_SPAWNED",c.source.entityId,c.source.entityId,e.skillId(),c.cast,0);
            }
            return false;
        });
        for(EffectType type:List.of(EffectType.INVINCIBLE,EffectType.DAMAGE_REDUCTION,EffectType.MOVE_SLOW,
                EffectType.MOVE_SPEED_UP,EffectType.SHIELD,EffectType.POISON,EffectType.BLEED,EffectType.BURN,EffectType.REGEN))
            handlers.put(type,(c,e)-> {statuses.apply(c.battle,c.target,e,c.source.entityId,c.cast);return false;});
    }
    /** 返回这次命中的伤害是否对 HP 或护盾实际有效。 */
    public boolean execute(BattleState b,SkillDefinition skill,Trigger trigger,CombatantState source,
                           CombatantState enemy,long cast,Facing facing,boolean basic) {
        boolean effective=false;
        for(var e:skill.effects()) {
            if(e.trigger()!=trigger)continue;
            CombatantState target=e.target()==Target.SELF?source:enemy;
            if(target==null || !target.alive)continue;
            Handler handler=handlers.get(e.type());
            if(handler==null)throw new IllegalStateException("未注册效果: "+e.type());
            effective|=handler.apply(new Context(b,source,target,cast,facing,basic),e);
        }
        return effective;
    }
}
