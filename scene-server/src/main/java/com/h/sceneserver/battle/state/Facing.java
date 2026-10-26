package com.h.sceneserver.battle.state;
public enum Facing {
    LEFT(-1), RIGHT(1);
    public final int sign;
    Facing(int sign) { this.sign=sign; }
    public Facing opposite() { return this==LEFT?RIGHT:LEFT; }
}
