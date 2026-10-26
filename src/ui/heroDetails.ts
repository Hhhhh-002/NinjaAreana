import data from '../generated/catalog.json';
import { heroById, skills } from '../catalog';

export function heroPresentation(id: number): { role: string; glyph: string; description: string } {
  return id === 101
    ? { role: '迅捷突进', glyph: '风', description: '以灵巧走位寻找破绽，突进出刀，迅速撤离。' }
    : { role: '重击防御', glyph: '岩', description: '以重击压制对手，稳住阵脚，在攻守之间寻找胜机。' };
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const seconds = (ticks: string | number) => `${+(Number(ticks) / 30).toFixed(2)} 秒`;

/** Display actual configured values rather than keeping a second set of skill rules in the UI. */
function effectDescription(e: typeof data.effects[number]): string {
  const duration = Number(e.duration_ticks) ? `，持续 ${seconds(e.duration_ticks)}` : '';
  const interval = `每 ${seconds(e.interval_ticks)}造成 ${e.value} 点`;
  const descriptions: Record<string, string> = {
    DASH: `向前突进 ${e.value} 距离`, BACKSTEP: `向后撤离 ${e.value} 距离`,
    DAMAGE: `命中造成 ${e.value} 点伤害`, KNOCKBACK: `命中击退 ${e.value} 距离`,
    INVINCIBLE: '获得无敌', SPAWN_PROJECTILE: '发射飞镖',
    GUARD_DAMAGE: `被格挡时削减 ${e.value} 点防御值`,
    DAMAGE_REDUCTION: `受到伤害降低 ${Math.round(Number(e.value) * 100)}%`,
    MOVE_SLOW: `自身移动速度降低 ${Math.round(Number(e.value) * 100)}%`,
    MOVE_SPEED_UP: `移动速度提高 ${Math.round(Number(e.value) * 100)}%`,
    SHIELD: `获得 ${e.value} 点护盾`,
    POISON: `命中附加中毒，${interval}毒伤`, BLEED: `命中附加流血，${interval}流血伤害`,
    BURN: `命中附加灼烧，${interval}灼烧伤害`,
    REGEN: `每 ${seconds(e.interval_ticks)}恢复 ${e.value} 点生命`,
  };
  let trigger = '';
  if (e.trigger === 'ON_BASIC_HIT_COUNT') trigger = `${seconds(e.trigger_window_ticks)}内累计 ${e.trigger_count} 次有效普攻命中后，`;
  if (e.trigger === 'ON_HP_CROSS_BELOW') trigger = `生命值从阈值上方跌破 ${Math.round(Number(e.trigger_value) * 100)}% 时，`;
  const limit = Number(e.max_triggers_per_battle) ? `；每局最多触发 ${e.max_triggers_per_battle} 次` : '';
  const cooldown = Number(e.internal_cooldown_ticks) ? `；触发冷却 ${seconds(e.internal_cooldown_ticks)}` : '';
  return escape(`${trigger}${descriptions[e.effect_type] ?? e.effect_name}${duration}${cooldown}${limit}。`);
}

export function heroDetails(id: number): string {
  const hero = heroById(id), presentation = heroPresentation(id);
  return `<div class="roster-intro"><h3>${escape(hero.name)}</h3><p>${presentation.description}</p><dl class="hero-stats"><div><dt>生命</dt><dd>${hero.hp}</dd></div><div><dt>蓝量</dt><dd>${hero.mana}</dd></div><div><dt>防御</dt><dd>${hero.guard}</dd></div></dl></div>` +
    skills.filter(s => s.heroId === id).map(s => {
      const configured = data.skills.find(row => +row.skill_id === s.id)!;
      const rule = s.passive ? '自动触发，无需按键' : `${s.mana} 蓝量 · 冷却 ${seconds(s.cooldown)}${configured.cast_condition === 'GROUND_ONLY' ? ' · 地面释放' : ''}`;
      return `<section class="skill-detail"><kbd>${s.passive ? '被' : s.key}</kbd><div><h4>${escape(s.name)}${s.mode === 'TRAINING' ? ' · 仅训练' : ''}</h4><p>${data.effects.filter(e => +e.skill_id === s.id).map(effectDescription).join('<br>')}</p><small>${rule}</small></div></section>`;
    }).join('');
}
