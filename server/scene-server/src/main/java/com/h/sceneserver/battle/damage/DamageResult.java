package com.h.sceneserver.battle.damage;
public record DamageResult(int hpDamage,int absorbed,int oldHp,int newHp,boolean critical) {
    public boolean effective() {return hpDamage>0 || absorbed>0;}
}
