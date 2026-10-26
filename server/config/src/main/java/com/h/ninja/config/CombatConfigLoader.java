package com.h.ninja.config;

import org.apache.commons.csv.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static com.h.ninja.config.CombatTypes.*;

/** CSV 第一行中文说明、第二行字段名；使用 Commons CSV 处理引号和逗号。 */
public final class CombatConfigLoader {
    public BattleConfigSnapshot load() {
        Map<Integer, HeroDefinition> heroes = new LinkedHashMap<>();
        for (CSVRecord r : read("/hero.csv")) {
            int id = i(r, "hero_id");
            var box = new HurtboxDefinition(d(r,"hurtbox_width_px"), d(r,"hurtbox_offset_x_px"),
                    d(r,"hurtbox_top_from_feet_px"), d(r,"hurtbox_bottom_from_feet_px"));
            var hero = new HeroDefinition(id,r.get("hero_name"),i(r,"max_hp"),i(r,"max_mana"),
                    i(r,"max_guard"),d(r,"move_speed_px_tick"),box);
            require(hero.maxHp()>0 && hero.maxMana()>=0 && hero.maxGuard()>=0 && hero.moveSpeed()>0
                    && box.width()>0 && box.topFromFeet()>box.bottomFromFeet(), "角色参数错误: " + id);
            require(heroes.putIfAbsent(id,hero)==null,"重复角色: " + id);
        }
        Map<Integer,List<EffectDefinition>> effects = new HashMap<>();
        Set<Integer> effectIds = new HashSet<>();
        for (CSVRecord r : read("/skill_effect.csv")) {
            var e = new EffectDefinition(i(r,"effect_id"),i(r,"skill_id"),i(r,"sequence"),
                    Trigger.valueOf(r.get("trigger")),d(r,"trigger_value"),i(r,"trigger_count"),
                    i(r,"trigger_window_ticks"),Target.valueOf(r.get("target")),EffectType.valueOf(r.get("effect_type")),
                    d(r,"value"),i(r,"duration_ticks"),i(r,"interval_ticks"),i(r,"internal_cooldown_ticks"),
                    StackRule.valueOf(r.get("stack_rule")),i(r,"max_triggers_per_battle"));
            require(effectIds.add(e.effectId()),"重复效果: " + e.effectId());
            require(e.durationTicks()>=0 && e.intervalTicks()>=0 && e.internalCooldownTicks()>=0
                    && e.maxTriggersPerBattle()>=0 && e.value()>=0,"效果参数错误: " + e.effectId());
            require(!e.periodic() || e.intervalTicks()>0 && e.durationTicks()>=e.intervalTicks(),"周期参数错误");
            require(e.trigger()!=Trigger.ON_BASIC_HIT_COUNT || e.triggerCount()>0 && e.triggerWindowTicks()>0,
                    "计数窗口错误");
            require(e.trigger()!=Trigger.ON_HP_CROSS_BELOW || e.triggerValue()>0 && e.triggerValue()<1,"血量阈值错误");
            require(switch(e.type()) {
                case DAMAGE_REDUCTION, MOVE_SLOW -> e.value()<=1;
                case DASH, BACKSTEP, SHIELD, INVINCIBLE, MOVE_SPEED_UP -> e.durationTicks()>0;
                default -> true;
            },"效果数值错误: " + e.effectId());
            effects.computeIfAbsent(e.skillId(),k->new ArrayList<>()).add(e);
        }
        Map<Integer,SkillDefinition> skills = new LinkedHashMap<>();
        for (CSVRecord r : read("/skill.csv")) {
            int id=i(r,"skill_id");
            HitboxType type=HitboxType.valueOf(r.get("hitbox_type"));
            HitboxDefinition box=type==HitboxType.FRONT_RECT?new HitboxDefinition(d(r,"hitbox_start_px"),
                    d(r,"hitbox_end_px"),d(r,"hitbox_bottom_px"),d(r,"hitbox_top_px")):null;
            ProjectileDefinition projectile=type==HitboxType.PROJECTILE?new ProjectileDefinition(
                    d(r,"projectile_speed_px_tick"),d(r,"projectile_max_distance_px"),
                    d(r,"projectile_width_px"),d(r,"projectile_height_px")):null;
            List<EffectDefinition> list=effects.getOrDefault(id,List.of()).stream()
                    .sorted(Comparator.comparingInt(EffectDefinition::sequence).thenComparingInt(EffectDefinition::effectId)).toList();
            var s=new SkillDefinition(id,i(r,"hero_id"),r.get("skill_name"),SkillType.valueOf(r.get("skill_type")),
                    r.get("input_key"),CastCondition.valueOf(r.get("cast_condition")),i(r,"mana_cost"),i(r,"cooldown_ticks"),
                    i(r,"startup_ticks"),i(r,"active_ticks"),i(r,"recovery_ticks"),type,box,projectile,
                    Boolean.parseBoolean(r.get("can_interrupt")),r.get("enabled_mode"),list);
            require(heroes.containsKey(s.heroId()),"不存在的所属角色: " + id);
            require(s.manaCost()>=0 && s.cooldownTicks()>=0 && s.startupTicks()>=0 && s.recoveryTicks()>=0
                    && (s.type()==SkillType.PASSIVE || s.activeTicks()>0),"技能阶段错误: " + id);
            require(Set.of("ALL","VERSUS","TRAINING").contains(s.enabledMode()),"技能模式错误");
            require(box==null || box.forwardStart()>=0 && box.forwardEnd()>box.forwardStart()
                    && box.topFromFeet()>box.bottomFromFeet(),"攻击框错误");
            require(projectile==null || projectile.speed()>0 && projectile.maxDistance()>0
                    && projectile.width()>0 && projectile.height()>0,"投射物错误");
            require(skills.putIfAbsent(id,s)==null,"重复技能: " + id);
        }
        require(skills.keySet().containsAll(effects.keySet()),"效果引用不存在的技能");
        return new BattleConfigSnapshot(heroes,skills);
    }

    private List<CSVRecord> read(String resource) {
        try (InputStream input=CombatConfigLoader.class.getResourceAsStream(resource)) {
            if(input==null)throw new IllegalStateException("缺少配置 " + resource);
            try (var reader=new BufferedReader(new InputStreamReader(input,StandardCharsets.UTF_8))) {
                reader.readLine(); // 中文说明（含 BOM），不作为字段名。
                try(var parser=CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true)
                        .setIgnoreEmptyLines(true).setTrim(true).get().parse(reader)) { return parser.getRecords(); }
            }
        } catch(IOException e) {throw new IllegalStateException("读取配置失败 " + resource,e);}
    }
    private int i(CSVRecord r,String key) {return r.get(key).isBlank()?0:Integer.parseInt(r.get(key));}
    private double d(CSVRecord r,String key) {
        double value=r.get(key).isBlank()?0:Double.parseDouble(r.get(key));
        require(Double.isFinite(value),"非有限数值 " + key); return value;
    }
    private void require(boolean condition,String message) {if(!condition)throw new IllegalArgumentException(message);}
}
