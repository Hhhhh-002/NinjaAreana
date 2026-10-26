package com.h.sceneserver.config;

import com.h.ninja.config.CombatTypes.Mode;
import org.springframework.core.env.Environment;
import java.util.*;

/** 每局固定的通用规则。地图/跳跃数值由配置提供，不从技能 notes 猜测。 */
public record BattleRules(int maxPlayers,int tickRate,int maxCatchUp,int matchDurationSeconds,
                          double width,double groundY,double jumpVelocity,double gravity,double maxFallSpeed,
                          Mode mode,Set<Integer> basicAttackSkillIds,int maxPendingCommands,
                          int manaRegenAmount,int manaRegenIntervalTicks) {
    public BattleRules {
        basicAttackSkillIds=Set.copyOf(basicAttackSkillIds);
        if(maxPlayers!=2 || tickRate!=30 || maxCatchUp<1 || maxCatchUp>10 || matchDurationSeconds<1
                || !Double.isFinite(width) || width<200 || !Double.isFinite(groundY)
                || !Double.isFinite(jumpVelocity) || jumpVelocity>=0 || !Double.isFinite(gravity) || gravity<=0
                || !Double.isFinite(maxFallSpeed) || maxFallSpeed<=0 || maxPendingCommands<1
                || manaRegenAmount<0 || manaRegenIntervalTicks<1)
            throw new IllegalArgumentException("战斗通用配置不合法");
    }
    /** 保留不启用自然回蓝的领域测试/调用入口。线上参数统一从 Nacos load。 */
    public BattleRules(int maxPlayers,int tickRate,int maxCatchUp,int matchDurationSeconds,
                       double width,double groundY,double jumpVelocity,double gravity,double maxFallSpeed,
                       Mode mode,Set<Integer> basicAttackSkillIds,int maxPendingCommands) {
        this(maxPlayers,tickRate,maxCatchUp,matchDurationSeconds,width,groundY,jumpVelocity,gravity,maxFallSpeed,
                mode,basicAttackSkillIds,maxPendingCommands,0,30);
    }
    public int minPlayersToStart() {return mode==Mode.TRAINING?1:2;}
    public static BattleRules load(Environment env) {
        Set<Integer> ids=new HashSet<>();
        for(String s:env.getProperty("battle.basic-attack-skill-ids","1101,2101").split(","))
            if(!s.isBlank())ids.add(Integer.parseInt(s.trim()));
        return new BattleRules(2,30,env.getProperty("battle.max-catch-up",Integer.class,5),
                env.getProperty("battle.match-duration-seconds",Integer.class,600),
                required(env,"battle.width-px"),required(env,"battle.ground-y-px"),
                required(env,"battle.jump-velocity-px-tick"),required(env,"battle.gravity-px-tick2"),
                required(env,"battle.max-fall-speed-px-tick"),
                Mode.valueOf(env.getProperty("battle.mode","VERSUS")),ids,
                env.getProperty("battle.max-pending-commands",Integer.class,256),
                env.getProperty("battle.mana-regen-amount",Integer.class,5),
                env.getProperty("battle.mana-regen-interval-ticks",Integer.class,30));
    }
    private static double required(Environment env,String key) { return env.getRequiredProperty(key,Double.class); }
}
