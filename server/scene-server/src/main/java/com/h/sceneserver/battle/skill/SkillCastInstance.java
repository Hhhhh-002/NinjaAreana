package com.h.sceneserver.battle.skill;
import com.h.ninja.config.SkillDefinition;
import com.h.sceneserver.battle.state.Facing;
import com.h.sceneserver.battle.collision.HitboxInstance;
import java.util.*;
/** 服务端的一次施法；castId 不是请求 requestId，也不是配置 skillId。 */
public final class SkillCastInstance {
    public enum Phase { STARTUP, ACTIVE, RECOVERY, FINISHED }
    public final long castId, casterEntityId, requestId, startTick, activeStartTick, recoveryStartTick, endTick;
    public final SkillDefinition definition;
    public final Facing facing;
    public final boolean basic;
    public Phase phase=Phase.STARTUP;
    public boolean activeEntered, finished, basicHitCounted;
    /** 存角色 entityId；首次接触后登记，包括格挡和无敌。 */
    public final Set<Long> processedTargetEntityIds=new HashSet<>();
    public final List<HitboxInstance> hitboxes=new ArrayList<>();
    public SkillCastInstance(long id,long caster,long request,SkillDefinition skill,Facing facing,long tick,boolean basic) {
        castId=id; casterEntityId=caster; requestId=request; definition=skill; this.facing=facing; this.basic=basic;
        startTick=tick; activeStartTick=tick+skill.startupTicks(); recoveryStartTick=activeStartTick+skill.activeTicks();
        endTick=recoveryStartTick+skill.recoveryTicks();
    }
}
