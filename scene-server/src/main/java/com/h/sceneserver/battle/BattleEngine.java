package com.h.sceneserver.battle;

import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.battle.skill.*;
import com.h.sceneserver.battle.status.*;
import com.h.sceneserver.battle.passive.*;
import com.h.sceneserver.battle.damage.*;
import com.h.sceneserver.battle.movement.*;
import com.h.sceneserver.battle.projectile.*;
import com.h.sceneserver.battle.collision.*;
import com.h.sceneserver.battle.effect.*;
import static com.h.ninja.config.CombatTypes.*;

/** 同步技能领域流程，调用方必须在 BattleActor 邮箱内。没有事件派发队列。 */
public final class BattleEngine {
    public final SkillProcessor skills=new SkillProcessor();
    public final StatusProcessor statuses=new StatusProcessor();
    public final MovementProcessor movement=new MovementProcessor();
    public final PassiveProcessor passives=new PassiveProcessor(statuses);
    public final DamageResolver damage=new DamageResolver(passives,skills);
    public final EffectExecutor effects=new EffectExecutor(statuses,movement,damage);
    public final ProjectileProcessor projectiles=new ProjectileProcessor();
    public final CollisionSystem collisions=new CollisionSystem();

    /** 八个阶段在同一个 tick 执行，内部按时间/条件跳过。 */
    public void onTick(BattleState b,Runnable processCommands,Runnable publishResults) {
        ++b.tick;
        statuses.update(b,damage);                     // 1 已有状态、周期效果、到期。
        regenerateMana(b);                            //   自然回蓝，同局逻辑帧计时，不另起定时器。
        skills.finishExpiredAtTick(b);                //   先释放已结束动作的占用。
        processCommands.run();                        // 2 cmd 查表调用 Handler。
        skills.update(b,effects);                     // 3 阶段、ON_CAST、攻击框。
        movement.update(b);                           //   普通/强制水平移动、跳跃重力。
        projectiles.update(b);                        // 4 记录投射物移动轨迹。
        var hits=collisions.detect(b);                // 5 只检测，不扣血。
        for(var hit:hits)resolveHit(b,hit);            // 6 每条直接完整结算。
        cleanup(b);                                   // 7 删除结束的对象。
        publishResults.run();                         // 8 通知已发生结果。
        b.combatResults.clear();
    }
    private void regenerateMana(BattleState b) {
        if(b.rules.manaRegenAmount()==0 || b.tick%b.rules.manaRegenIntervalTicks()!=0)return;
        for(var c:b.combatants.values())if(c.alive)
            c.mana=(int)Math.min(c.definition.maxMana(),(long)c.mana+b.rules.manaRegenAmount());
    }
    public void resolveHit(BattleState b,HitIntent hit) {
        CombatantState owner=b.combatants.get(hit.sourceId()),target=b.combatants.get(hit.targetId());
        //代码只在公共检查里验证了 target.alive，并没有统一验证 owner.alive。
//        这意味着你当前的投射物可能在攻击者死亡后继续命中敌人。如果这是你想要的玩法，就没有问题
        if(owner==null || target==null || !target.alive)return;

        SkillCastInstance cast=b.casts.get(hit.castId());
        boolean basic=false;
        if(hit.projectileId()!=null) {
            var p=b.projectiles.get(hit.projectileId());
            if(p==null || p.destroyed)return;
            p.destroyed=true; // 首次接触，包括格挡、无敌，也消耗投射物。
        } else {
            if(cast==null || cast.finished || !owner.alive || cast.phase!=SkillCastInstance.Phase.ACTIVE
                    || !cast.processedTargetEntityIds.add(target.entityId))return;
            basic=cast.basic;
        }
        if(target.statuses.has(EffectType.INVINCIBLE,b.tick)) {
            b.result("EVADED",owner.entityId,target.entityId,hit.skill().skillId(),hit.castId(),0);return;
        }
        boolean blocked=target.input.blocking && target.guard>0 && target.facing!=hit.facing();
        if(blocked) {
            effects.execute(b,hit.skill(),Trigger.ON_BLOCK,owner,target,hit.castId(),hit.facing(),basic);
            if(basic)passives.basicBlocked(owner);
            b.result("BLOCKED",owner.entityId,target.entityId,hit.skill().skillId(),hit.castId(),0);return;
        }
        boolean effective=effects.execute(b,hit.skill(),Trigger.ON_HIT,owner,target,hit.castId(),hit.facing(),basic);
        if(basic && effective)passives.basicHit(b,owner,cast);
    }
    private void cleanup(BattleState b) {
        b.casts.values().removeIf(c->c.finished);
        b.projectiles.values().removeIf(p->p.destroyed || p.expiresAfterCollision);
        b.combatants.values().forEach(c->c.statuses.byEffectId.values().removeIf(s->s.removed));
    }
}
