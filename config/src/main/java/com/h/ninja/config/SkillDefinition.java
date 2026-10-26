package com.h.ninja.config;

import java.util.List;
import static com.h.ninja.config.CombatTypes.*;

/** 主动、被动共用技能配置；没有 PassiveDefinition。 */
public record SkillDefinition(int skillId, int heroId, String name, SkillType type, String inputKey,
                              CastCondition castCondition, int manaCost, int cooldownTicks,
                              int startupTicks, int activeTicks, int recoveryTicks,
                              HitboxType hitboxType, HitboxDefinition hitbox, ProjectileDefinition projectile,
                              boolean canInterrupt, String enabledMode, List<EffectDefinition> effects) {
    public SkillDefinition { effects = List.copyOf(effects); }
    public boolean enabled(Mode mode) { return enabledMode.equals("ALL") || enabledMode.equals(mode.name()); }
}
