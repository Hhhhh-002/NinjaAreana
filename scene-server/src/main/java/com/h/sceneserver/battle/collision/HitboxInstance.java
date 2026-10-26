package com.h.sceneserver.battle.collision;
import com.h.ninja.config.HitboxDefinition;
import com.h.sceneserver.battle.state.*;
/** 施法生效期间存在的攻击判定，位置跟随角色，朝向使用锁定的施法朝向。 */
public record HitboxInstance(long instanceId,long sourceCastId,HitboxDefinition definition) {
    public Aabb bounds(Transform t,Facing facing) {
        double a=t.centerX+facing.sign*definition.forwardStart();
        double b=t.centerX+facing.sign*definition.forwardEnd();
        return new Aabb(Math.min(a,b),t.feetY-definition.topFromFeet(),Math.max(a,b),t.feetY-definition.bottomFromFeet());
    }
}
