package com.h.sceneserver.battle.skill;
import java.util.*;
/** 技能 ID → 可再次释放的 tick；无需每帧逐项减一。 */
public final class CooldownBook {
    public final Map<Integer,Long> readyTickBySkillId=new HashMap<>();
    public boolean ready(int skillId,long tick) {return tick>=readyTickBySkillId.getOrDefault(skillId,0L);}
}
