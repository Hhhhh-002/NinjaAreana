package com.h.sceneserver.battle.collision;
public record Aabb(double left,double top,double right,double bottom) {
    public boolean overlaps(Aabb other) {
        return right>=other.left && left<=other.right && bottom>=other.top && top<=other.bottom;
    }
}
