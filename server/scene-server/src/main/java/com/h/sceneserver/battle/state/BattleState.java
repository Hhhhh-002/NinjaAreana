package com.h.sceneserver.battle.state;
import com.h.ninja.config.BattleConfigSnapshot;
import com.h.sceneserver.config.BattleRules;
import com.h.sceneserver.battle.skill.*;
import com.h.sceneserver.battle.projectile.*;
import com.h.sceneserver.battle.result.*;
import java.util.*;
/** 一局一份，Actor 独占。没有 BattleEventQueue。 */
public final class BattleState {
    public final long battleId;
    public final BattleConfigSnapshot configs;
    public final BattleRules rules;
    public long tick;
    private long nextInstanceId;
    public final Map<Long,CombatantState> combatants=new TreeMap<>();
    public final Map<Long,SkillCastInstance> casts=new TreeMap<>();
    public final Map<Long,ProjectileInstance> projectiles=new TreeMap<>();
    public final List<CombatResult> combatResults=new ArrayList<>();
    public final SplittableRandom random;
    public BattleState(long id,BattleConfigSnapshot config,BattleRules rules) {
        battleId=id; configs=config; this.rules=rules; random=new SplittableRandom(id);
    }
    public long nextId() {return ++nextInstanceId;}
    public CombatantState player(String id) {
        return combatants.values().stream().filter(c->c.playerId.equals(id)).findFirst()
                .orElseThrow(()->new IllegalArgumentException("玩家不在战场"));
    }
    public void result(String type,long source,long target,int skill,long cast,int value) {
        CombatantState c=combatants.get(target);
        combatResults.add(new CombatResult(tick,type,source,target,skill,cast,value,c==null?0:c.hp,c==null?0:c.guard));
    }
}
