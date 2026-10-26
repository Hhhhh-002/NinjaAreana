package com.h.ninja.config;

import java.util.*;

/** 启动加载并校验；一局固定引用同一份只读快照。 */
public record BattleConfigSnapshot(Map<Integer, HeroDefinition> heroes, Map<Integer, SkillDefinition> skills) {
    public BattleConfigSnapshot { heroes = Map.copyOf(heroes); skills = Map.copyOf(skills); }
    public List<SkillDefinition> skillsForHero(int heroId) {
        return skills.values().stream().filter(s -> s.heroId() == heroId)
                .sorted(Comparator.comparingInt(SkillDefinition::skillId)).toList();
    }
}
