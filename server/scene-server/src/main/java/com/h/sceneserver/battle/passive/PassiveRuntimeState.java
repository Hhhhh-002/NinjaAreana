package com.h.sceneserver.battle.passive;
import java.util.*;
/** 本角色的被动 skillId → 独立运行进度。 */
public final class PassiveRuntimeState {
    public final Map<Integer,PassiveProgress> progressBySkillId=new LinkedHashMap<>();
}
