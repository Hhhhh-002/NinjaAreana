package com.h.sceneserver.battle.status;
import com.h.ninja.config.EffectDefinition;
/** 目标身上的一次持续效果；来源施法结束不删除该状态。 */
public final class StatusInstance {
    public final long instanceId, sourceEntityId, sourceCastId, targetEntityId;
    public final EffectDefinition definition;
    public final long endTick;
    public long nextTriggerTick;
    public double remainingShield;
    public boolean removed;
    public StatusInstance(long id,EffectDefinition definition,long source,long cast,long target,long tick) {
        instanceId=id; this.definition=definition; sourceEntityId=source; sourceCastId=cast; targetEntityId=target;
        endTick=tick+definition.durationTicks();
        nextTriggerTick=tick+definition.intervalTicks(); remainingShield=definition.value();
    }
    public boolean active(long tick) {return !removed && tick<endTick;}
}
