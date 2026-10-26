package com.h.sceneserver.battle.collision;
import com.h.ninja.config.HurtboxDefinition;
import com.h.sceneserver.battle.state.Transform;
/** 根据角色位置和只读配置计算世界受击范围。 */
public record Hurtbox(HurtboxDefinition definition) {
    public Aabb bounds(Transform transform) {
        double x=transform.centerX+definition.offsetX();
        return new Aabb(x-definition.width()/2,transform.feetY-definition.topFromFeet(),
                x+definition.width()/2,transform.feetY-definition.bottomFromFeet());
    }
}
