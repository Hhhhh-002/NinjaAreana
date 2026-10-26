package com.h.sceneserver.battle;

import com.h.ninja.config.*;
import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.battle.skill.SkillCastInstance;
import com.h.sceneserver.config.BattleRules;
import org.junit.jupiter.api.Test;
import java.util.*;
import static com.h.ninja.config.CombatTypes.*;
import static org.junit.jupiter.api.Assertions.*;

/** 真实 CSV + 同步领域流程，不启动 MySQL、Nacos 或网络。 */
class BattleEngineTests {
    final BattleConfigSnapshot configs=new CombatConfigLoader().load();
    final BattleEngine engine=new BattleEngine();
    BattleState battle() {
        var rules=new BattleRules(2,30,5,600,1200,0,-16,1,30,Mode.TRAINING,Set.of(1101,2101),256);
        var b=new BattleState(7,configs,rules);
        b.combatants.put(1L,new CombatantState(1,"a",configs.heroes().get(101),configs,Mode.TRAINING,300,0,Facing.RIGHT));
        b.combatants.put(2L,new CombatantState(2,"b",configs.heroes().get(102),configs,Mode.TRAINING,410,0,Facing.LEFT));
        return b;
    }
    void tick(BattleState b) {engine.onTick(b,()->{},()->{});}
    @Test void snapshotIncludesAuthoritativeAnimationState() {
        var b=battle();var a=b.player("a");
        a.input.blocking=true;a.movement.grounded=false;a.movement.velocityY=-12.5;
        var snapshot=com.h.sceneserver.battle.result.CombatResultSink.snapshot(b,true);
        var actor=snapshot.getCombatantsList().stream().filter(c->c.getUserId().equals("a")).findFirst().orElseThrow();
        assertTrue(actor.getBlocking());assertFalse(actor.getGrounded());assertEquals(-12.5,actor.getVelocityY());
    }
    @Test void loadsConfiguredSkillsAndEffects() {
        assertEquals(2,configs.heroes().size());assertEquals(9,configs.skills().size());
        assertEquals(21,configs.skills().values().stream().mapToInt(s->s.effects().size()).sum());
    }
    @Test void basicAttacksUseRealHitboxesNoManaAndTriggerWindPassive() {
        var b=battle();var a=b.player("a");var target=b.player("b");target.transform.centerX=360;
        assertEquals(1101,a.loadout.skillsByKey.get("J"));
        assertEquals(1003,a.loadout.skillsByKey.get("L"));
        for(int hit=0;hit<3;hit++) {
            engine.onTick(b,()->engine.skills.cast(b,a,1101,1000+b.tick),()->{});
            for(int frame=0;frame<14;frame++)tick(b);
        }
        // 固定随机种子下其中一次普攻暴击：65 + 65 + floor(65 * 1.5)。
        assertEquals(100,a.mana);assertEquals(1073,target.hp);
        assertEquals(1,a.passives.progressBySkillId.get(9001).triggerCount);
        assertTrue(a.statuses.has(EffectType.MOVE_SPEED_UP,b.tick));
    }
    @Test void blockedBasicAttackResetsCountAndOnlyConsumesGuard() {
        var b=battle();var a=b.player("a");var target=b.player("b");target.transform.centerX=360;
        a.passives.progressBySkillId.get(9001).hitTicks.add(0L);target.input.blocking=true;
        engine.onTick(b,()->engine.skills.cast(b,a,1101,900),()->{});
        for(int frame=0;frame<5;frame++)tick(b);
        assertEquals(1300,target.hp);assertEquals(88,target.guard);
        assertTrue(a.passives.progressBySkillId.get(9001).hitTicks.isEmpty());
    }
    @Test void manaRegenRunsAtConfiguredTickCapsAndSkipsDead() {
        for(int interval:List.of(1,30)) {
            var rules=new BattleRules(2,30,5,600,1200,0,-16,1,30,Mode.TRAINING,Set.of(1101,2101),256,5,interval);
            var b=new BattleState(8,configs,rules);
            var a=new CombatantState(1,"a",configs.heroes().get(101),configs,Mode.TRAINING,300,0,Facing.RIGHT);
            var dead=new CombatantState(2,"b",configs.heroes().get(102),configs,Mode.TRAINING,410,0,Facing.LEFT);
            b.combatants.put(1L,a);b.combatants.put(2L,dead);a.mana=92;dead.mana=0;dead.alive=false;
            for(int frame=1;frame<interval;frame++)tick(b);
            assertEquals(92,a.mana);tick(b);assertEquals(97,a.mana);
            for(int frame=0;frame<interval;frame++)tick(b);
            assertEquals(100,a.mana);assertEquals(0,dead.mana);
        }
    }
    @Test void fiveStartupTicksThenSameTickHitAndDedupAndBurn() {
        var b=battle();var a=b.player("a");var target=b.player("b");b.tick=99;
        engine.onTick(b,()->engine.skills.cast(b,a,1001,500),()->{});
        for(int i=0;i<4;i++)tick(b);
        assertEquals(104,b.tick);assertEquals(1300,target.hp);assertEquals(300,a.transform.centerX);
        tick(b);assertEquals(105,b.tick);assertEquals(1150,target.hp);assertEquals(340,a.transform.centerX);
        assertTrue(target.statuses.byEffectId.containsKey(17));
        tick(b);tick(b);assertEquals(1150,target.hp);assertEquals(420,a.transform.centerX);
        while(b.tick<118)tick(b);assertTrue(b.casts.isEmpty());assertNull(a.currentCastId);
        while(b.tick<195)tick(b);assertEquals(1126,target.hp);assertFalse(target.statuses.byEffectId.containsKey(17));
    }
    @Test void backstepSurvivesOneTickActiveAndCoversSixTicksPrecisely() {
        var b=battle();var a=b.player("a");
        engine.onTick(b,()->engine.skills.cast(b,a,1002,501),()->{});
        assertTrue(a.statuses.has(EffectType.INVINCIBLE,b.tick));
        for(int i=0;i<5;i++)tick(b);
        assertEquals(190,a.transform.centerX,0.000001);assertNull(a.movement.forcedMotion);
        tick(b);assertFalse(a.statuses.has(EffectType.INVINCIBLE,b.tick));assertNotNull(a.currentCastId);
    }
    @Test void guardOnlyConsumesGuardOnceAndDoesNotApplyBleed() {
        var b=battle();var a=b.player("a");var heavy=b.player("b");heavy.transform.centerX=360;
        a.input.blocking=true;
        engine.onTick(b,()->engine.skills.cast(b,heavy,2001,502),()->{});
        for(int i=0;i<12;i++)tick(b);
        assertEquals(1000,a.hp);assertEquals(40,a.guard);assertFalse(a.statuses.byEffectId.containsKey(15));
    }
    @Test void thresholdShieldImmediatelyProtectsNextDamageAndNeverRescuesDeath() {
        var b=battle();var target=b.player("b");target.hp=400;
        engine.damage.damage(b,1,target,1001,4,150,false);
        assertEquals(250,target.hp);assertEquals(200,target.statuses.byEffectId.get(13).remainingShield);
        engine.damage.damage(b,1,target,1001,5,250,false);
        assertEquals(200,target.hp);assertEquals(1,target.passives.progressBySkillId.get(9002).triggerCount);
        var second=battle();var c=second.player("b");c.hp=400;
        engine.damage.damage(second,1,c,1001,6,400,false);
        assertFalse(c.alive);assertTrue(c.statuses.byEffectId.isEmpty());
    }
    @Test void equalThresholdDoesNotTriggerButCrossingFromEqualDoes() {
        var b=battle();var c=b.player("b");c.hp=400;
        engine.damage.damage(b,1,c,1001,4,10,false);assertTrue(c.statuses.byEffectId.isEmpty());
        engine.damage.damage(b,1,c,1001,5,1,false);assertTrue(c.statuses.byEffectId.containsKey(13));
    }
    @Test void periodicRefreshResetsNextTickAndFinalTickRunsBeforeRemoval() {
        var b=battle();var c=b.player("b");var poison=configs.skills().get(1003).effects().stream().filter(e->e.effectId()==14).findFirst().orElseThrow();
        engine.statuses.apply(b,c,poison,1,9);b.tick=20;engine.statuses.apply(b,c,poison,1,10);
        while(b.tick<49)tick(b);assertEquals(1300,c.hp);
        tick(b);assertEquals(1290,c.hp);while(b.tick<140)tick(b);
        assertEquals(1260,c.hp);assertFalse(c.statuses.byEffectId.containsKey(14));
    }
    @Test void passiveWindowBoundaryCooldownAndBlockedResetReadConfiguration() {
        var b=battle();var a=b.player("a");var progress=a.passives.progressBySkillId.get(9001);
        int[] ticks={0,100,150,249};
        for(int i=0;i<ticks.length;i++) {
            b.tick=ticks[i];var cast=new SkillCastInstance(100+i,1,1000+i,configs.skills().get(1001),Facing.RIGHT,b.tick,true);
            engine.passives.basicHit(b,a,cast);engine.passives.basicHit(b,a,cast);
        }
        assertEquals(1,progress.triggerCount);assertEquals(609,progress.cooldownEndTick);assertTrue(progress.hitTicks.isEmpty());
        b.tick=300;engine.passives.basicHit(b,a,new SkillCastInstance(200,1,20,configs.skills().get(1001),Facing.RIGHT,b.tick,true));
        assertTrue(progress.hitTicks.isEmpty());b.tick=609;
        engine.passives.basicHit(b,a,new SkillCastInstance(201,1,21,configs.skills().get(1001),Facing.RIGHT,b.tick,true));
        assertEquals(1,progress.hitTicks.size());engine.passives.basicBlocked(a);assertTrue(progress.hitTicks.isEmpty());
    }
    @Test void projectileLastSegmentUsesSweepAndOutlivesCasterCast() {
        var b=battle();var a=b.player("a");var c=b.player("b");c.transform.centerX=770;
        engine.onTick(b,()->engine.skills.cast(b,a,1003,503),()->{});
        while(b.tick<32)tick(b);assertTrue(b.casts.isEmpty());assertFalse(b.projectiles.isEmpty());assertEquals(1300,c.hp);
        tick(b);assertEquals(1210,c.hp);assertTrue(b.projectiles.isEmpty());assertTrue(c.statuses.byEffectId.containsKey(14));
    }
    @Test void defenseAndRegenRemainAfterCastAndHaveExactFinalHeal() {
        var b=battle();var c=b.player("b");c.hp=1000;
        engine.onTick(b,()->engine.skills.cast(b,c,2002,504),()->{});
        while(b.tick<13)tick(b);assertNull(c.currentCastId);
        engine.damage.damage(b,1,c,1001,99,100,false);assertEquals(950,c.hp);
        while(b.tick<64)tick(b);assertEquals(970,c.hp);assertTrue(c.statuses.byEffectId.isEmpty());
    }
}
