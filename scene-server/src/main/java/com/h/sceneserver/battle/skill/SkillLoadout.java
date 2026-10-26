package com.h.sceneserver.battle.skill;
import java.util.*;
/** 按键到主动技能 ID；allowedSkillIds 同时用于服务端释放授权。 */
public final class SkillLoadout {
    public final Map<String,Integer> skillsByKey=new HashMap<>();
    public final Set<Integer> allowedSkillIds=new HashSet<>();
}
