package com.h.ninja.config;

import static com.h.ninja.config.CombatTypes.*;

/** skill_effect.csv 的一条只读效果配置，按 sequence、effectId 执行。 */
public record EffectDefinition(int effectId, int skillId, int sequence, Trigger trigger,
                               double triggerValue, int triggerCount, int triggerWindowTicks,
                               Target target, EffectType type, double value, int durationTicks,
                               int intervalTicks, int internalCooldownTicks, StackRule stackRule,
                               int maxTriggersPerBattle) {
    public boolean periodic() { return switch (type) {
        case POISON, BLEED, BURN, REGEN -> true;
        default -> false;
    }; }
}
