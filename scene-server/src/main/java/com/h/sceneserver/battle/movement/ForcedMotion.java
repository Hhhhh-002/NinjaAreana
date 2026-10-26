package com.h.sceneserver.battle.movement;
import com.h.sceneserver.battle.state.Facing;
/** 技能强制水平位移；独立于 ACTIVE 持续时间，如影替后撤持续 6 tick。 */
public final class ForcedMotion {
    public final long sourceCastId;
    public final double distance;
    public final int duration;
    public final Facing direction;
    public int elapsed;
    public double moved;
    public ForcedMotion(long castId,double distance,int duration,Facing direction) {
        this.sourceCastId=castId; this.distance=distance; this.duration=duration; this.direction=direction;
    }
}
