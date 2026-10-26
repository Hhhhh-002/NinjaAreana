package com.h.sceneserver.battle.projectile;
import com.h.sceneserver.battle.state.BattleState;
public final class ProjectileProcessor {
    public void update(BattleState b) {
        for(var p:b.projectiles.values()) {
            if(p.destroyed)continue;
            p.previousX=p.x;p.previousY=p.y;
            double step=Math.min(p.skill.projectile().speed(),p.skill.projectile().maxDistance()-p.travelled);
            double bound=p.facing.sign>0?b.rules.width()-p.x:p.x;
            step=Math.max(0,Math.min(step,bound));p.x+=p.facing.sign*step;p.travelled+=step;
            p.expiresAfterCollision=p.travelled>=p.skill.projectile().maxDistance() || bound<=step;
        }
    }
}
