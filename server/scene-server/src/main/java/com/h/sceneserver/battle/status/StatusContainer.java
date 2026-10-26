package com.h.sceneserver.battle.status;
import java.util.*;
import com.h.ninja.config.CombatTypes.EffectType;
/** 每个 effectId 在目标身上最多一个状态；刷新直接替换对象，防止旧更新误删新状态。 */
public final class StatusContainer {
    public final Map<Integer,StatusInstance> byEffectId=new TreeMap<>();
    public boolean has(EffectType type,long tick) {
        return byEffectId.values().stream().anyMatch(s->s.active(tick) && s.definition.type()==type);
    }
    public List<StatusInstance> active(long tick) {
        return byEffectId.values().stream().filter(s->s.active(tick)).toList();
    }
}
