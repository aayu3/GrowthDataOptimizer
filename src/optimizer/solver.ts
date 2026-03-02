import { Relic, OptimizerConstraints, BuildResult, SkillDefinition } from './types';

// Maximum possible level a single relic can contribute to ANY category
// main (3) + 2 aux (3 each) = 9
const MAX_POINTS_PER_RELIC = 9;

export class RelicSolver {
    private relics: Relic[];
    private constraints: OptimizerConstraints;
    private categoryMap: Map<string, string>; // Maps skill names to their Category ("Bulwark")
    private skillMaxLevels: Map<string, number>;

    private validBuilds: BuildResult[] = [];
    private buildSet: Set<string> = new Set();
    private maxBuilds: number = 2000;

    constructor(relics: Relic[], constraints: OptimizerConstraints, skillsData: Record<string, SkillDefinition>, relicInfo: any = null) {
        this.relics = relics;
        this.constraints = constraints;
        this.categoryMap = new Map();
        this.skillMaxLevels = new Map();

        // Fallback: Build map from relicInfo
        if (relicInfo && relicInfo.RELIC_TYPES) {
            for (const [catName, catData] of Object.entries<any>(relicInfo.RELIC_TYPES)) {
                if (catData.main_skills) {
                    catData.main_skills.forEach((skill: string) => {
                        this.categoryMap.set(skill, catName);
                        this.skillMaxLevels.set(skill, 6); // Default assuming 6
                    });
                }
                if (catData.aux_skills) {
                    for (const [skillTemplate, maxLvl] of Object.entries<number>(catData.aux_skills)) {
                        if (skillTemplate.includes('{Element}')) {
                            relicInfo.ELEMENTS?.forEach((el: string) => {
                                const specSkill = skillTemplate.replace('{Element}', el);
                                this.categoryMap.set(specSkill, catName);
                                this.skillMaxLevels.set(specSkill, maxLvl);
                            });
                        } else {
                            this.categoryMap.set(skillTemplate, catName);
                            this.skillMaxLevels.set(skillTemplate, maxLvl);
                        }
                    }
                }
            }
        }

        // Override with explicit skillsData if provided
        for (const [skillName, def] of Object.entries(skillsData)) {
            this.categoryMap.set(skillName, def.type);
            this.skillMaxLevels.set(skillName, def.maxlevel);
        }
    }

    public solve(): BuildResult[] {
        this.validBuilds = [];
        this.buildSet = new Set<string>();

        // HEURISTIC: Score relics based on usefulness for current constraints
        const scoredRelics = this.relics.map(r => {
            let score = 0;
            const skills = [r.main_skill, ...r.aux_skills];
            for (const skill of skills) {
                if (!skill) continue;
                const cat = this.categoryMap.get(skill.name);
                if (cat && this.constraints.targetCategoryLevels[cat]) {
                    score += skill.level * 2; // Category matches get good score
                }
                if (this.constraints.targetSkillLevels[skill.name]) {
                    score += skill.level * 10; // Specific skill targets get very high priority
                }
            }
            return { relic: r, score };
        });

        // Ensure diversity: Take top 15 from each required slot type to ensure we can always form a full build
        const topDiverseRelics: Relic[] = [];
        const requiredCategories = this.constraints.allowedSlots ? Object.keys(this.constraints.allowedSlots) : ['Bulwark', 'Vanguard', 'Support', 'Sentinel'];

        const groupedByCat: Record<string, typeof scoredRelics> = {};
        scoredRelics.forEach(item => {
            const cat = item.relic.type;
            if (!groupedByCat[cat]) groupedByCat[cat] = [];
            groupedByCat[cat].push(item);
        });

        for (const cat of requiredCategories) {
            const candidates = (groupedByCat[cat] || [])
                .sort((a, b) => b.score - a.score)
                .slice(0, 15);
            candidates.forEach(c => topDiverseRelics.push(c.relic));
        }

        // De-duplicate in case some relics were added via multiple categories (unlikely but safe)
        const uniqueTop = Array.from(new Set(topDiverseRelics));

        // If we still have room or no specific required slots, pad with best remaining overall
        if (uniqueTop.length < 50) {
            const additional = scoredRelics
                .filter(i => !uniqueTop.includes(i.relic))
                .sort((a, b) => b.score - a.score)
                .slice(0, 50 - uniqueTop.length);
            uniqueTop.push(...additional.map(i => i.relic));
        }

        this.relics = uniqueTop;
        console.log(`Optimization starting with ${this.relics.length} candidate relics.`);

        this.backtrack([], 0, 0);
        // Sort by some heuristic, e.g. most total skill levels
        this.validBuilds.sort((a, b) => {
            const sumA = Object.values(a.rawSkillLevels).reduce((acc, v) => acc + v, 0);
            const sumB = Object.values(b.rawSkillLevels).reduce((acc, v) => acc + v, 0);
            if (sumB !== sumA) return sumB - sumA;
            // secondary sort by effective skill levels if raw is same
            const effA = Object.values(a.effectiveSkillLevels).reduce((acc, v) => acc + v, 0);
            const effB = Object.values(b.effectiveSkillLevels).reduce((acc, v) => acc + v, 0);
            return effB - effA;
        });
        return this.validBuilds;
    }

    private backtrack(currentBuild: Relic[], startIndex: number, depth: number) {
        if (this.validBuilds.length >= this.maxBuilds) return;

        if (depth === 6) {
            this.evaluateBuild(currentBuild);
            return;
        }

        const remainingSlots = 6 - depth;
        const { rawCategoryLevels } = this.calculateBuildStats(currentBuild);

        // Pruning: Check if target category constraints are reachable
        let canReachAllCategories = true;
        if (this.constraints.targetCategoryLevels) {
            for (const [cat, target] of Object.entries(this.constraints.targetCategoryLevels)) {
                const currentVal = rawCategoryLevels[cat] || 0;
                const maxPossibleRemaining = remainingSlots * MAX_POINTS_PER_RELIC;
                if (currentVal + maxPossibleRemaining < (target as number)) {
                    canReachAllCategories = false;
                    break;
                }
            }
        }

        if (!canReachAllCategories) return; // Prune branch

        for (let i = startIndex; i < this.relics.length; i++) {
            const nextRelic = this.relics[i];

            // Enforce slot constraints if provided
            if (this.constraints.allowedSlots) {
                const currentSlotCount = currentBuild.filter(r => r.type === nextRelic.type).length;
                const maxAllowed = this.constraints.allowedSlots[nextRelic.type] || 0;
                if (currentSlotCount >= maxAllowed) continue; // Skip if we already have enough of this type
            }

            currentBuild.push(nextRelic);
            this.backtrack(currentBuild, i + 1, depth + 1);
            currentBuild.pop();
        }
    }

    private calculateBuildStats(build: Relic[]) {
        const rawSkillLevels: Record<string, number> = {};
        const rawCategoryLevels: Record<string, number> = {};

        for (const relic of build) {
            const skills = [relic.main_skill, ...relic.aux_skills];
            for (const skill of skills) {
                if (!skill) continue;

                // Sum Raw Skill Levels
                rawSkillLevels[skill.name] = (rawSkillLevels[skill.name] || 0) + skill.level;

                // Sum Raw Category Levels
                const category = this.categoryMap.get(skill.name);
                if (category) {
                    rawCategoryLevels[category] = (rawCategoryLevels[category] || 0) + skill.level;
                }
            }
        }
        return { rawSkillLevels, rawCategoryLevels };
    }

    private evaluateBuild(build: Relic[]) {
        const { rawSkillLevels, rawCategoryLevels } = this.calculateBuildStats(build);

        // Check category constraints
        if (this.constraints.targetCategoryLevels) {
            for (const [cat, target] of Object.entries(this.constraints.targetCategoryLevels)) {
                if ((rawCategoryLevels[cat] || 0) < (target as number)) return;
            }
        }

        // Check specific skill constraints (raw)
        if (this.constraints.targetSkillLevels) {
            for (const [skill, target] of Object.entries(this.constraints.targetSkillLevels)) {
                if ((rawSkillLevels[skill] || 0) < (target as number)) return;
            }
        }

        const effectiveSkillLevels: Record<string, number> = {};
        for (const [skill, rawLvl] of Object.entries(rawSkillLevels)) {
            const maxLvl = this.skillMaxLevels.get(skill) ?? 6; // default 6 bounds if fully unknown
            effectiveSkillLevels[skill] = Math.min(rawLvl, maxLvl);
        }

        const relicFingerprints = build.map(r => {
            const main = `${r.main_skill.name}:${r.main_skill.level}`;
            const aux = r.aux_skills
                .map(s => `${s.name}:${s.level}`)
                .sort()
                .join('-');
            return `${r.type}-${main}-${aux}`;
        });
        const buildFingerprint = relicFingerprints.sort().join('|');

        if (this.buildSet.has(buildFingerprint)) {
            return;
        }
        this.buildSet.add(buildFingerprint);

        this.validBuilds.push({
            relics: [...build],
            rawCategoryLevels,
            rawSkillLevels,
            effectiveSkillLevels
        });
    }
}
