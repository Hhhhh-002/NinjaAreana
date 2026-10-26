package com.h.sceneserver.battle.collision;
import com.h.sceneserver.battle.state.*;
import com.h.sceneserver.battle.skill.SkillCastInstance;
import java.util.*;
/** 只产生候选列表；检测时不扣血、不执行被动。 */
public final class CollisionSystem {
    public List<HitIntent> detect(BattleState b) {
        List<HitIntent> hits=new ArrayList<>();
        for(var cast:b.casts.values()) {
            if(cast.finished || cast.phase!=SkillCastInstance.Phase.ACTIVE)continue;
            var owner=b.combatants.get(cast.casterEntityId);
            if(owner==null || !owner.alive)continue;
            for(var target:b.combatants.values()) {
                if(!target.alive || target==owner || cast.processedTargetEntityIds.contains(target.entityId))continue;
                if(cast.hitboxes.stream().anyMatch(box->box.bounds(owner.transform,cast.facing).overlaps(target.hurtbox.bounds(target.transform))))
                    hits.add(new HitIntent(owner.entityId,target.entityId,cast.castId,null,cast.definition,cast.facing,0));
            }
        }
        for(var p:b.projectiles.values()) {
            if(p.destroyed)continue;
            double halfW=p.skill.projectile().width()/2,halfH=p.skill.projectile().height()/2;
            for(var target:b.combatants.values()) {
                if(!target.alive || target.entityId==p.ownerEntityId)continue;
                Aabb box=target.hurtbox.bounds(target.transform);
                if(p.y+halfH<box.top() || p.y-halfH>box.bottom())continue;
                double delta=p.x-p.previousX;
                double near=p.facing.sign>0?box.left()-halfW:box.right()+halfW;
                double far=p.facing.sign>0?box.right()+halfW:box.left()-halfW;
                double t=delta==0?(p.previousX>=box.left()-halfW && p.previousX<=box.right()+halfW?0:Double.POSITIVE_INFINITY)
                        :Math.max(0,(near-p.previousX)/delta);
                if(t<=1 && (delta==0 || (far-p.previousX)/delta>=0))
                    hits.add(new HitIntent(p.ownerEntityId,target.entityId,p.sourceCastId,p.instanceId,p.skill,p.facing,t));
            }
        }
        hits.sort(Comparator.comparingLong(HitIntent::sourceId)
                .thenComparingLong(h->h.projectileId()==null?h.castId():h.projectileId())
                .thenComparingDouble(HitIntent::contactTime).thenComparingLong(HitIntent::targetId));return hits;
    }
}
