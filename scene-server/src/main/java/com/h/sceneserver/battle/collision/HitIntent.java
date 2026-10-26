package com.h.sceneserver.battle.collision;
import com.h.ninja.config.SkillDefinition;
import com.h.sceneserver.battle.state.Facing;
/** 检测阶段产生的临时命中记录；尚未修改 HP。 */
public record HitIntent(long sourceId,long targetId,long castId,Long projectileId,SkillDefinition skill,
                        Facing facing,double contactTime) {}
