package com.h.ninja.config;

/** 只读角色基础配置；技能归属统一按 SkillDefinition.heroId 索引。 */
public record HeroDefinition(int heroId, String name, int maxHp, int maxMana, int maxGuard,
                             double moveSpeed, HurtboxDefinition hurtbox) {}
