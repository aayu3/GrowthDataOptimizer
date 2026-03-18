import { Relic, BuildResult } from '../optimizer/types';
import { getSkillMaxLevel, getSkillCategory } from './relicUtils';
import skillsData from '../data/skills.json';
import dollsData from '../data/dolls.json';

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
export type AttackMode = 'both' | 'aoe' | 'single';

export const calculateBuildDamage = (build: BuildResult, stats: any, ignoredSkills: string[], logDetails: boolean = false, damageType: DamageType = 'average', attackMode: AttackMode = 'both', selectedDoll?: string, ignoredPassives: string[] = []) => {
    let totalAtkBuff = 0;
    let totalCritRateBuff = 0;
    let totalCritDmgBuff = 0;
    let totalDamageBuff = 0;

    const activeSkillsLog: string[] = [];
    const activePassivesLog: string[] = [];

    // Parse doll passive bonuses
    if (selectedDoll && (dollsData as any)[selectedDoll]?.bonuses) {
        const hBonuses = (dollsData as any)[selectedDoll].bonuses;
        for (const bonus of hBonuses) {
            let isActive = true;
            for (const [key, val] of Object.entries(bonus)) {
                if (key !== 'tier' && key !== 'description' && key !== 'Buff') {
                    if ((build.rawCategoryLevels[key] || 0) < (val as number)) {
                        isActive = false;
                        break;
                    }
                }
            }
            if (isActive && bonus.Buff && !ignoredPassives.includes(bonus.description)) {
                const buffVal = bonus.Buff.value;
                const buffStats: string[] = Array.isArray(bonus.Buff.stat) ? bonus.Buff.stat : [bonus.Buff.stat];
                if (buffStats.includes("ATK")) totalAtkBuff += buffVal / 100.0;
                else if (buffStats.includes("DMG")) totalDamageBuff += buffVal / 100.0;
                else if (buffStats.includes("CRIT_RATE")) totalCritRateBuff += buffVal;
                else if (buffStats.includes("CRIT_DMG")) totalCritDmgBuff += buffVal;

                if (logDetails) {
                    activePassivesLog.push(`Tier ${bonus.tier}: ${buffStats.join(", ")} +${buffVal}`);
                }
            }
        }
    }

    for (const [skillName, level] of Object.entries(build.effectiveSkillLevels)) {
        if (level <= 0) continue;
        if (ignoredSkills.includes(skillName)) continue;

        let skillDef = (skillsData as any).Sentinel?.[skillName] || (skillsData as any).Vanguard?.[skillName] || (skillsData as any).Support?.[skillName];
        if (!skillDef) continue;

        // If the skill only applies to a specific attack type (aoe/single), skip it if mode doesn't match
        if (attackMode !== 'both' && skillDef.attackType && skillDef.attackType !== attackMode) continue;


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

    const externalAtkBuff = (stats.ExternalAtkBuff || 0) / 100.0;

    const finalAtk = Math.ceil(stats.ATK * (1 + totalAtkBuff + externalAtkBuff));

    const finalCritRate = Math.min(100, stats.CRIT_RATE + totalCritRateBuff) / 100.0;
    const externalCritDmgBuff = stats.ExternalCritDmgBuff || 0;
    const finalCritDmg = (stats.CRIT_DMG + totalCritDmgBuff + externalCritDmgBuff) / 100.0;

    const externalDmgBuff = (stats.ExternalDmgBuff || 0) / 100.0;
    const skillMultiplier = (stats.SkillMultiplier ?? 100) / 100.0;
    const weaknessMultiplier = 1 + (stats.WeaknessExploit ?? 1) / 10;

    const scaleType = finalAtk; // Defaults to ATK scaling for now
    const defReduction = finalAtk / (finalAtk + stats.EnemyDEF);

    const finalDamageMultiplier = 1 + totalDamageBuff + externalDmgBuff;
    const baseDamage = Math.ceil(scaleType * defReduction * skillMultiplier * finalDamageMultiplier * weaknessMultiplier);
    const critDamage = Math.ceil(scaleType * defReduction * skillMultiplier * finalDamageMultiplier * weaknessMultiplier * finalCritDmg);
    const averageDamage = ((1 - finalCritRate) * baseDamage) + (finalCritRate * critDamage);

    if (damageType === 'base') return baseDamage;
    if (damageType === 'crit') return critDamage;
    return averageDamage;
};

export const evaluateDpsForBuilds = (
    rawResults: Uint32Array,
    filteredIndices: Uint32Array,
    optimizedRelics: Relic[],
    stats: any,
    ignoredSkills: string[],
    damageType: DamageType = 'average',
    attackMode: AttackMode = 'both',
    selectedDoll?: string,
    ignoredPassives: string[] = []
): Float64Array => {
    const numBuilds = filteredIndices.length;
    const dpsArray = new Float64Array(numBuilds);
    if (numBuilds === 0) return dpsArray;

    const skillList: string[] = [];
    const skillToIndex = new Map<string, number>();

    for (const relic of optimizedRelics) {
        const skills = [relic.main_skill, ...(relic.aux_skills || [])];
        for (const skill of skills) {
            if (skill && skill.name && !skillToIndex.has(skill.name)) {
                skillToIndex.set(skill.name, skillList.length);
                skillList.push(skill.name);
            }
        }
    }

    const numSkills = skillList.length;

    // Skill properties
    const statTypes = new Uint8Array(numSkills);
    const attackTypes = new Uint8Array(numSkills);
    const maxLevels = new Uint8Array(numSkills);
    const validSkills = new Uint8Array(numSkills);
    const skillToCat = new Int32Array(numSkills);
    skillToCat.fill(-1);

    const maxLevelPossible = 6;
    const skillX = new Float32Array(numSkills * maxLevelPossible);

    for (let i = 0; i < numSkills; i++) {
        const name = skillList[i];

        // Always map category so ignored skills still count toward category totals (for doll bonus checks)
        const cat = getSkillCategory(name);
        if (cat === "Bulwark") skillToCat[i] = 1;
        else if (cat === "Support") skillToCat[i] = 2;
        else if (cat === "Sentinel") skillToCat[i] = 3;
        else if (cat === "Vanguard") skillToCat[i] = 4;

        if (ignoredSkills.includes(name)) continue;

        const skillDef = (skillsData as any).Sentinel?.[name] || (skillsData as any).Vanguard?.[name] || (skillsData as any).Support?.[name];
        if (!skillDef) continue;

        validSkills[i] = 1;
        maxLevels[i] = getSkillMaxLevel(name);

        if (skillDef.stat === "ATK") {
            statTypes[i] = skillDef.scaling === "HP" ? 5 : 1;
        } else if (skillDef.stat === "DMG") {
            statTypes[i] = 2;
        } else if (skillDef.stat === "CRIT_RATE") {
            statTypes[i] = 3;
        } else if (skillDef.stat === "CRIT_DMG") {
            statTypes[i] = 4;
        }

        if (skillDef.attackType === "aoe") {
            attackTypes[i] = 1;
        } else if (skillDef.attackType === "single") {
            attackTypes[i] = 2;
        }

        const values = skillDef.x;
        const isCrit = skillDef.stat === "CRIT_RATE" || skillDef.stat === "CRIT_DMG";
        for (let lvl = 0; lvl < maxLevelPossible; lvl++) {
            let val = values[lvl] !== undefined ? values[lvl] : (lvl > 0 ? values[lvl - 1] : 0);
            if (!isCrit) val /= 100.0;
            skillX[i * maxLevelPossible + lvl] = val;
        }
    }

    const MAX_SKILLS_PER_RELIC = 4;
    const relicSkills = new Int16Array(optimizedRelics.length * MAX_SKILLS_PER_RELIC * 2);

    for (let r = 0; r < optimizedRelics.length; r++) {
        const relic = optimizedRelics[r];
        const offset = r * MAX_SKILLS_PER_RELIC * 2;
        for (let k = 0; k < MAX_SKILLS_PER_RELIC * 2; k++) relicSkills[offset + k] = -1;

        const skills = [relic.main_skill, ...(relic.aux_skills || [])];
        let k = 0;
        for (const skill of skills) {
            if (skill && skill.name) {
                const idx = skillToIndex.get(skill.name);
                if (idx !== undefined) {
                    relicSkills[offset + k * 2] = idx;
                    relicSkills[offset + k * 2 + 1] = skill.level;
                    k++;
                }
            }
        }
    }

    const INTS_PER_BUILD = 7;
    const runningSkillLevels = new Int32Array(numSkills);

    const baseEnemyDef = stats.EnemyDEF;
    const baseAtk = stats.ATK;
    const baseHp = stats.HP;
    const baseCritRate = stats.CRIT_RATE;
    const baseCritDmg = stats.CRIT_DMG;

    // Cache bonuses outside loop
    const dollBonuses = selectedDoll && (dollsData as any)[selectedDoll]?.bonuses ? (dollsData as any)[selectedDoll].bonuses : [];

    const modeBoth = attackMode === 'both';
    const modeAoe = attackMode === 'aoe';
    const modeSingle = attackMode === 'single';

    for (let i = 0; i < numBuilds; i++) {
        runningSkillLevels.fill(0);
        let runBulwark = 0, runSupport = 0, runSentinel = 0, runVanguard = 0;

        const buildIdx = filteredIndices[i];
        const rawOffset = buildIdx * INTS_PER_BUILD;

        for (let j = 0; j < 6; j++) {
            const relicIdInt = rawResults[rawOffset + j];
            if (relicIdInt > 0) {
                const rIdx = relicIdInt - 1;
                const rOffset = rIdx * MAX_SKILLS_PER_RELIC * 2;
                for (let k = 0; k < MAX_SKILLS_PER_RELIC; k++) {
                    const skillIdx = relicSkills[rOffset + k * 2];
                    if (skillIdx >= 0) {
                        const level = relicSkills[rOffset + k * 2 + 1];
                        runningSkillLevels[skillIdx] += level;

                        const cat = skillToCat[skillIdx];
                        if (cat === 1) runBulwark += level;
                        else if (cat === 2) runSupport += level;
                        else if (cat === 3) runSentinel += level;
                        else if (cat === 4) runVanguard += level;
                    }
                }
            }
        }

        let totalAtkBuff = 0;
        let totalCritRateBuff = 0;
        let totalCritDmgBuff = 0;
        let totalDamageBuff = 0;

        for (const bonus of dollBonuses) {
            let isActive = true;
            for (const [key, val] of Object.entries(bonus)) {
                if (key !== 'tier' && key !== 'description' && key !== 'Buff') {
                    let catLvl = 0;
                    if (key === 'Bulwark') catLvl = runBulwark;
                    else if (key === 'Support') catLvl = runSupport;
                    else if (key === 'Sentinel') catLvl = runSentinel;
                    else if (key === 'Vanguard') catLvl = runVanguard;

                    if (catLvl < (val as number)) {
                        isActive = false;
                        break;
                    }
                }
            }
            if (isActive && bonus.Buff && !ignoredPassives.includes(bonus.description)) {
                const buffVal = bonus.Buff.value;
                const buffStats: string[] = Array.isArray(bonus.Buff.stat) ? bonus.Buff.stat : [bonus.Buff.stat];
                if (buffStats.includes("ATK")) totalAtkBuff += buffVal / 100.0;
                else if (buffStats.includes("DMG")) totalDamageBuff += buffVal / 100.0;
                else if (buffStats.includes("CRIT_RATE")) totalCritRateBuff += buffVal;
                else if (buffStats.includes("CRIT_DMG")) totalCritDmgBuff += buffVal;
            }
        }

        for (let s = 0; s < numSkills; s++) {
            if (validSkills[s] === 0) continue;
            let rawLvl = runningSkillLevels[s];
            if (rawLvl <= 0) continue;

            const aType = attackTypes[s];
            if (!modeBoth) {
                if (modeAoe && aType === 2) continue;
                if (modeSingle && aType === 1) continue;
            }

            const effLvl = Math.min(rawLvl, maxLevels[s]);
            const val = skillX[s * maxLevelPossible + (effLvl - 1)];

            const stat = statTypes[s];
            if (stat === 1) totalAtkBuff += val;
            else if (stat === 2) totalDamageBuff += val;
            else if (stat === 3) totalCritRateBuff += val;
            else if (stat === 4) totalCritDmgBuff += val;
            else if (stat === 5) totalAtkBuff += (baseHp * val) / baseAtk;
        }

        const externalAtkBuff = (stats.ExternalAtkBuff || 0) / 100.0;
        const finalAtk = Math.ceil(baseAtk * (1 + totalAtkBuff + externalAtkBuff))

        const finalCritRate = Math.min(100, baseCritRate + totalCritRateBuff) / 100.0;
        const externalCritDmgBuff = stats.ExternalCritDmgBuff || 0;
        const finalCritDmg = (baseCritDmg + totalCritDmgBuff + externalCritDmgBuff) / 100.0;

        const externalDmgBuff = (stats.ExternalDmgBuff || 0) / 100.0;
        const skillMultiplier = (stats.SkillMultiplier ?? 100) / 100.0;
        const weaknessMultiplier = 1 + (stats.WeaknessExploit ?? 1) / 10;

        const scaleType = finalAtk; // Defaults to ATK scaling for now
        const defReduction = finalAtk / (finalAtk + baseEnemyDef);

        const baseDamage = Math.ceil(scaleType * defReduction * skillMultiplier * (1 + totalDamageBuff + externalDmgBuff) * weaknessMultiplier);
        const critDamage = Math.ceil(scaleType * defReduction * skillMultiplier * (1 + totalDamageBuff + externalDmgBuff) * weaknessMultiplier * finalCritDmg);

        let avgDamage = 0;
        if (damageType === 'base') {
            avgDamage = baseDamage;
        } else if (damageType === 'crit') {
            avgDamage = critDamage;
        } else {
            avgDamage = ((1 - finalCritRate) * baseDamage) + (finalCritRate * critDamage);
        }

        dpsArray[i] = avgDamage;
    }

    return dpsArray;
}
