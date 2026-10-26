package com.h.sceneserver.battle.state;
import com.h.ninja.config.*;
import com.h.sceneserver.battle.skill.*;
import com.h.sceneserver.battle.status.*;
import com.h.sceneserver.battle.passive.*;
import com.h.sceneserver.battle.collision.Hurtbox;
import static com.h.ninja.config.CombatTypes.SkillType;
/** 本局角色运行状态；只由所属 BattleActor 修改，不映射数据库表。 */
public final class CombatantState {
    public final long entityId;
    public final String playerId;
    public final HeroDefinition definition;
    public int hp,mana,guard;
    public boolean alive=true;
    public final Transform transform;
    public Facing facing;
    public final InputState input=new InputState();
    public final MovementState movement=new MovementState();
    public final SkillLoadout loadout=new SkillLoadout();
    public final CooldownBook cooldowns=new CooldownBook();
    public final StatusContainer statuses=new StatusContainer();
    public final PassiveRuntimeState passives=new PassiveRuntimeState();
    public final Hurtbox hurtbox;
    public Long currentCastId;
    public CombatantState(long id,String player,HeroDefinition hero,BattleConfigSnapshot config,
                          CombatTypes.Mode mode,double x,double ground,Facing facing) {
        entityId=id; playerId=player; definition=hero; hp=hero.maxHp(); mana=hero.maxMana(); guard=hero.maxGuard();
        transform=new Transform(x,ground); this.facing=facing; hurtbox=new Hurtbox(hero.hurtbox());
        for(var skill:config.skillsForHero(hero.heroId())) {
            if(!skill.enabled(mode))continue;
            if(skill.type()==SkillType.PASSIVE)passives.progressBySkillId.put(skill.skillId(),new PassiveProgress());
            else {
                loadout.allowedSkillIds.add(skill.skillId());
                if(!skill.inputKey().isBlank())loadout.skillsByKey.put(skill.inputKey(),skill.skillId());
            }
        }
    }
}
