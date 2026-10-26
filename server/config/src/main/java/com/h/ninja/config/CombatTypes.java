package com.h.ninja.config;

/** 配置可用的规则类型；不解析 notes 中的中文来决定行为。 */
public final class CombatTypes {
    private CombatTypes() {}
    public enum SkillType { ACTIVE, PASSIVE }
    public enum CastCondition { GROUND_ONLY, ANY, AUTO }
    public enum HitboxType { FRONT_RECT, PROJECTILE, SELF }
    public enum Trigger { ON_CAST, ON_HIT, ON_BLOCK, ON_BASIC_HIT_COUNT, ON_HP_CROSS_BELOW }
    public enum EffectType {
        DASH, BACKSTEP, SPAWN_PROJECTILE, DAMAGE, KNOCKBACK, GUARD_DAMAGE,
        INVINCIBLE, DAMAGE_REDUCTION, MOVE_SLOW, MOVE_SPEED_UP, SHIELD, POISON, BLEED, REGEN, BURN
    }
    public enum Target { SELF, ENEMY }
    public enum StackRule { NONE, REFRESH, REPLACE }
    public enum Mode { VERSUS, TRAINING }
}
