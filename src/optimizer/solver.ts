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
                    score += skill.level * 5; // Specific skill targets get very high score
                }
            }
            return { relic: r, score };
        });

        // Sort by score descending and take top 40 to avoid combinatorial explosion (C(40,6) = 3.8M)
        scoredRelics.sort((a, b) => b.score - a.score);
        this.relics = scoredRelics.slice(0, 40).map(item => item.relic);

        this.backtrack([], 0, 0);
        // Sort by some heuristic, e.g. most total levels
        this.validBuilds.sort((a, b) => {
            const sumA = Object.values(a.rawCategoryLevels).reduce((acc, v) => acc + v, 0);
            const sumB = Object.values(b.rawCategoryLevels).reduce((acc, v) => acc + v, 0);
            return sumB - sumA;
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

        this.validBuilds.push({
            relics: [...build],
            rawCategoryLevels,
            rawSkillLevels,
            effectiveSkillLevels
        });
    }
}
