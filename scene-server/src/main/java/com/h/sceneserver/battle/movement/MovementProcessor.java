package com.h.sceneserver.battle.movement;
import com.h.sceneserver.battle.state.*;
import static com.h.ninja.config.CombatTypes.EffectType.*;

/** 平地和左右边界；不自行增加地图、寻路或物理引擎。 */
public final class MovementProcessor {
    public void update(BattleState b) {
        for(var c:b.combatants.values()) {
            if(!c.alive)continue;
            var motion=c.movement.forcedMotion;
            if(motion!=null) {
                double next=motion.distance*(motion.elapsed+1)/motion.duration;
                double delta=(next-motion.moved)*motion.direction.sign;
                double old=c.transform.centerX;moveHorizontal(b,c,delta);motion.moved=next;motion.elapsed++;
                if(motion.elapsed>=motion.duration || Math.abs(c.transform.centerX-old-delta)>0.000001)c.movement.forcedMotion=null;
            } else if(c.currentCastId==null && !c.input.blocking) {
                double up=0,slow=0;
                for(var s:c.statuses.active(b.tick)) {
                    if(s.definition.type()==MOVE_SPEED_UP)up+=s.definition.value();
                    if(s.definition.type()==MOVE_SLOW)slow=Math.max(slow,s.definition.value());
                }
                moveHorizontal(b,c,c.input.moveAxis*c.definition.moveSpeed()*(1+up)*(1-Math.min(1,slow)));
                if(c.input.moveAxis!=0)c.facing=c.input.moveAxis>0?Facing.RIGHT:Facing.LEFT;
            }
            if(!c.movement.grounded) {
                c.movement.velocityY=Math.min(b.rules.maxFallSpeed(),c.movement.velocityY+b.rules.gravity());
                c.transform.feetY+=c.movement.velocityY;
                if(c.transform.feetY>=b.rules.groundY()) {
                    c.transform.feetY=b.rules.groundY();c.movement.velocityY=0;c.movement.grounded=true;
                }
            }
        }
    }
    public void moveHorizontal(BattleState b,CombatantState c,double delta) {
        double half=c.definition.hurtbox().width()/2,offset=c.definition.hurtbox().offsetX();
        c.transform.centerX=Math.max(half-offset,Math.min(b.rules.width()-half-offset,c.transform.centerX+delta));
    }
}
