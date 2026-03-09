import { Relic, BuildResult } from '../optimizer/types';
import { getSkillMaxLevel, getSkillCategory } from './relicUtils';
import skillsData from '../data/skills.json';

export const calculateBuildStats = (buildRelics: Relic[]) => {
    const rawCategoryLevels: Record<string, number> = {};
    const rawSkillLevels: Record<string, number> = {};
    const effectiveSkillLevels: Record<string, number> = {};

    for (const relic of buildRelics) {
        const skills = [relic.main_skill, ...(relic.aux_skills || [])].filter(Boolean) as { name: string; level: number }[];
        for (const skill of skills) {
            rawSkillLevels[skill.name] = (rawSkillLevels[skill.name] || 0) + skill.level;
            const cat = getSkillCategory(skill.name);
            if (cat) rawCategoryLevels[cat] = (rawCategoryLevels[cat] || 0) + skill.level;
        }
    }

    for (const [skill, rawLvl] of Object.entries(rawSkillLevels)) {
        effectiveSkillLevels[skill] = Math.min(rawLvl, getSkillMaxLevel(skill));
    }

    return { rawCategoryLevels, effectiveSkillLevels };
};

export type DamageType = 'average' | 'crit' | 'base';

export const calculateBuildDamage = (build: BuildResult, stats: any, ignoredSkills: string[], logDetails: boolean = false, damageType: DamageType = 'average') => {
    let totalAtkBuff = 0;
    let totalCritRateBuff = 0;
    let totalCritDmgBuff = 0;
    let totalDamageBuff = 0;

    const activeSkillsLog: string[] = [];

    for (const [skillName, level] of Object.entries(build.effectiveSkillLevels)) {
        if (level <= 0) continue;
        if (ignoredSkills.includes(skillName)) continue;

        let skillDef = (skillsData as any).Sentinel?.[skillName] || (skillsData as any).Vanguard?.[skillName] || (skillsData as any).Support?.[skillName];
        if (!skillDef) continue;

        const effectValue = skillDef.x[level - 1]; // level is 1-indexed
        if (effectValue === undefined) continue;

        const multiplier = effectValue / 100.0;

        if (skillDef.stat === "ATK") {
            if (skillDef.scaling === "HP") {
                totalAtkBuff += (stats.HP * multiplier) / stats.ATK;
            } else {
                totalAtkBuff += multiplier;
            }
        } else if (skillDef.stat === "DMG") {
            totalDamageBuff += multiplier;
        } else if (skillDef.stat === "CRIT_RATE") {
            totalCritRateBuff += effectValue;
        } else if (skillDef.stat === "CRIT_DMG") {
            totalCritDmgBuff += effectValue;
        }

        if (logDetails) {
            activeSkillsLog.push(`${skillName} (Lv. ${level})`);
        }
    }

    const finalAtk = stats.ATK * (1 + totalAtkBuff);
    const finalCritRate = Math.min(100, stats.CRIT_RATE + totalCritRateBuff) / 100.0;
    const finalCritDmg = (stats.CRIT_DMG + totalCritDmgBuff) / 100.0;

    const baseDamage = finalAtk / (1 + (stats.EnemyDEF / finalAtk)) * (1 + totalDamageBuff);
    const critDamage = baseDamage * (1 + finalCritDmg);
    const averageDamage = ((1 - finalCritRate) * baseDamage) + (finalCritRate * critDamage);

    if (damageType === 'base') return baseDamage;
    if (damageType === 'crit') return critDamage;
    return averageDamage;
};
