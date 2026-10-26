import data from './generated/catalog.json';

export interface Hero {
  id: number; name: string; hp: number; mana: number; guard: number; speed: number; width: number; height: number; color: number;
}
export interface Skill {
  id: number; heroId: number; name: string; key: string; passive: boolean; mana: number; cooldown: number;
  mode: string; startup: number; active: number; recovery: number;
}
export const heroes: Hero[] = data.heroes.map(h => ({
  id: +h.hero_id, name: h.hero_name, hp: +h.max_hp, mana: +h.max_mana, guard: +h.max_guard,
  speed: +h.move_speed_px_tick, width: +h.hurtbox_width_px, height: +h.hurtbox_top_from_feet_px,
  color: +h.hero_id === 101 ? 0x66cfc1 : 0xe8ad65,
}));
export const skills: Skill[] = data.skills.map(s => ({
  id: +s.skill_id, heroId: +s.hero_id, name: s.skill_name, key: s.input_key, passive: s.skill_type === 'PASSIVE',
  mana: +s.mana_cost, cooldown: +s.cooldown_ticks, mode: s.enabled_mode,
  startup: +s.startup_ticks, active: +s.active_ticks, recovery: +s.recovery_ticks,
}));
export const effects = new Map(data.effects.map(e => [+e.effect_id, { name: e.effect_name, type: e.effect_type }]));
export const heroById = (id: number) => heroes.find(h => h.id === id) ?? heroes[0];
export const skillById = (id: number) => skills.find(s => s.id === id);
