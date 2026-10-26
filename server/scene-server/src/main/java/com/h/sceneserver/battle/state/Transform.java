package com.h.sceneserver.battle.state;
/** 角色水平中心、脚底世界坐标；Y 向下为正。 */
public final class Transform {
    public double centerX, feetY;
    public Transform(double x,double y) { centerX=x; feetY=y; }
}
