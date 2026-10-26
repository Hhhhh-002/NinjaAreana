package com.h.sceneserver.battle.projectile;
import com.h.ninja.config.SkillDefinition;
import com.h.sceneserver.battle.state.Facing;
/** 发出后独立于施法存活；保留技能配置，避免施法清理后无法处理命中。 */
public final class ProjectileInstance {
    public final long instanceId, sourceCastId, ownerEntityId;
    public final SkillDefinition skill;
    public final Facing facing;
    public double x,y,previousX,previousY,travelled;
    public boolean destroyed, expiresAfterCollision;
    public ProjectileInstance(long id,long cast,long owner,SkillDefinition skill,Facing facing,double x,double y) {
        instanceId=id; sourceCastId=cast; ownerEntityId=owner; this.skill=skill; this.facing=facing;
        this.x=x; this.y=y; previousX=x; previousY=y;
    }
}
