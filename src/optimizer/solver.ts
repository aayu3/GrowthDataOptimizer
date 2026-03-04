import { Relic, OptimizerConstraints, BuildResult, SkillDefinition } from './types';

// Maximum possible level a single relic can contribute to ANY category
// main (3) + 2 aux (3 each) = 9
const MAX_POINTS_PER_RELIC = 9;

interface RelicArchetype {
    type: string;
    typeId: number;
    skillIds: number[];
    skillLevels: number[];
    catIds: number[];
    relics: Relic[];
}

export class RelicSolver {
    private relics: Relic[];
    private constraints: OptimizerConstraints;

    private categoryNameToId: Map<string, number>;
    private categoryIdToName: string[];

    private skillNameToId: Map<string, number>;
    private skillIdToName: string[];

    private typeNameToId: Map<string, number>;
    private typeIdToName: string[];

    // Core arrays
    private skillIdToCatId: Int32Array;
    private skillIdToMaxLevel: Int32Array;

    // Constraints arrays
    private targetCategoryLevels: Int32Array;
    private targetSkillLevels: Int32Array;
    private allowedSlots: Int32Array;

    private validBuilds: BuildResult[] = [];
    private maxBuilds: number = 2000000;
    private rootBranchIndex: number = 0;

    constructor(relics: Relic[], constraints: OptimizerConstraints, skillsData: Record<string, SkillDefinition>, relicInfo: any = null) {
        this.relics = relics;
        this.constraints = constraints;
        this.categoryNameToId = new Map();
        this.categoryIdToName = [];
        this.skillNameToId = new Map();
        this.skillIdToName = [];
        this.typeNameToId = new Map();
        this.typeIdToName = [];

        const tempCatMap = new Map<string, string>();
        const tempMaxMap = new Map<string, number>();

        // Fallback: Build map from relicInfo
        if (relicInfo && relicInfo.RELIC_TYPES) {
            for (const [catName, catData] of Object.entries<any>(relicInfo.RELIC_TYPES)) {
                if (catData.main_skills) {
                    catData.main_skills.forEach((skill: string) => {
                        tempCatMap.set(skill, catName);
                        tempMaxMap.set(skill, 6);
                    });
                }
                if (catData.aux_skills) {
                    for (const [skillTemplate, maxLvl] of Object.entries<number>(catData.aux_skills)) {
                        if (skillTemplate.includes('{Element}')) {
                            relicInfo.ELEMENTS?.forEach((el: string) => {
                                const specSkill = skillTemplate.replace('{Element}', el);
                                tempCatMap.set(specSkill, catName);
                                tempMaxMap.set(specSkill, maxLvl);
                            });
                        } else {
                            tempCatMap.set(skillTemplate, catName);
                            tempMaxMap.set(skillTemplate, maxLvl);
                        }
                    }
                }
            }
        }

        // Override with explicit skillsData if provided
        for (const [skillName, def] of Object.entries(skillsData)) {
            tempCatMap.set(skillName, def.type);
            tempMaxMap.set(skillName, def.maxlevel);
        }

        // Build integer IDs
        for (const [skillName, catName] of tempCatMap.entries()) {
            this.getOrAddSkillId(skillName);
            this.getOrAddCatId(catName);
        }

        this.skillIdToCatId = new Int32Array(this.skillIdToName.length);
        this.skillIdToMaxLevel = new Int32Array(this.skillIdToName.length);

        for (const [skillName, catName] of tempCatMap.entries()) {
            const skillId = this.getOrAddSkillId(skillName);
            const catId = this.getOrAddCatId(catName);
            this.skillIdToCatId[skillId] = catId;
            this.skillIdToMaxLevel[skillId] = tempMaxMap.get(skillName) ?? 6;
        }

        // Constraints arrays
        this.targetCategoryLevels = new Int32Array(this.categoryIdToName.length);
        if (this.constraints.targetCategoryLevels) {
            for (const [cat, target] of Object.entries(this.constraints.targetCategoryLevels)) {
                const catId = this.getOrAddCatId(cat);
                this.targetCategoryLevels[catId] = target;
            }
        }

        this.targetSkillLevels = new Int32Array(this.skillIdToName.length);
        if (this.constraints.targetSkillLevels) {
            for (const [skill, target] of Object.entries(this.constraints.targetSkillLevels)) {
                const skillId = this.getOrAddSkillId(skill);
                this.targetSkillLevels[skillId] = target;
            }
        }

        // Find all type IDs
        this.relics.forEach(r => this.getOrAddTypeId(r.type));
        this.allowedSlots = new Int32Array(this.typeIdToName.length).fill(99);
        if (this.constraints.allowedSlots) {
            for (const [type, allowed] of Object.entries(this.constraints.allowedSlots)) {
                const typeId = this.getOrAddTypeId(type);
                this.allowedSlots[typeId] = allowed;
            }
        } else {
            // Default allowed slots if not specified
            ['Bulwark', 'Vanguard', 'Support', 'Sentinel'].forEach(type => {
                const typeId = this.getOrAddTypeId(type);
                this.allowedSlots[typeId] = 99; // Practically unlimited, but restricted by 6 depth
            });
        }
    }

    private getOrAddCatId(catName: string): number {
        if (!this.categoryNameToId.has(catName)) {
            const id = this.categoryIdToName.length;
            this.categoryNameToId.set(catName, id);
            this.categoryIdToName.push(catName);
            return id;
        }
        return this.categoryNameToId.get(catName)!;
    }

    private getOrAddSkillId(skillName: string): number {
        if (!this.skillNameToId.has(skillName)) {
            const id = this.skillIdToName.length;
            this.skillNameToId.set(skillName, id);
            this.skillIdToName.push(skillName);
            return id;
        }
        return this.skillNameToId.get(skillName)!;
    }

    private getOrAddTypeId(typeName: string): number {
        if (!this.typeNameToId.has(typeName)) {
            const id = this.typeIdToName.length;
            this.typeNameToId.set(typeName, id);
            this.typeIdToName.push(typeName);
            return id;
        }
        return this.typeNameToId.get(typeName)!;
    }

    public solve(partition?: { id: number, total: number }): BuildResult[] {
        this.validBuilds = [];
        this.rootBranchIndex = 0;

        // Adjust maxBuilds if partitioned
        if (partition) {
            this.maxBuilds = Math.ceil(this.maxBuilds / partition.total);
        }

        // HEURISTIC: Score relics based on usefulness for current constraints
        const scoredRelics = this.relics.map(r => {
            let score = 0;
            const skills = [r.main_skill, ...r.aux_skills];
            for (const skill of skills) {
                if (!skill) continue;
                const skillId = this.skillNameToId.get(skill.name);
                if (skillId !== undefined) {
                    const catId = this.skillIdToCatId[skillId];
                    if (this.targetCategoryLevels[catId] > 0) {
                        score += skill.level * 2; // Category matches get good score
                    }
                    if (this.targetSkillLevels[skillId] > 0) {
                        score += skill.level * 10; // Specific skill targets get very high priority
                    }
                }
            }
            return { relic: r, score };
        });

        // Ensure diversity: Take top 30 from each required slot type to ensure we can always form a full build
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
                .slice(0, 30);
            candidates.forEach(c => topDiverseRelics.push(c.relic));
        }

        // De-duplicate in case some relics were added via multiple categories
        const uniqueTop = Array.from(new Set(topDiverseRelics));

        // If we still have room or no specific required slots, pad with best remaining overall
        if (uniqueTop.length < 100) {
            const additional = scoredRelics
                .filter(i => !uniqueTop.includes(i.relic))
                .sort((a, b) => b.score - a.score)
                .slice(0, 100 - uniqueTop.length);
            uniqueTop.push(...additional.map(i => i.relic));
        }

        console.log(`Optimization starting with ${uniqueTop.length} candidate relics.`);

        // --- PRE-DEDUPLICATION INTO ARCHETYPES ---
        const archetypeMap = new Map<string, RelicArchetype>();
        for (const r of uniqueTop) {
            const main = `${r.main_skill.name}:${r.main_skill.level}`;
            const aux = r.aux_skills
                .map(s => `${s.name}:${s.level}`)
                .sort()
                .join('-');
            const fingerprint = `${r.type}-${main}-${aux}`;

            if (!archetypeMap.has(fingerprint)) {
                const skills = [r.main_skill, ...r.aux_skills].filter(s => s && s.name);
                const skillIds: number[] = [];
                const skillLevels: number[] = [];
                const catIds: number[] = [];

                for (const s of skills) {
                    const sId = this.getOrAddSkillId(s.name);
                    skillIds.push(sId);
                    skillLevels.push(s.level);
                    const cId = sId < this.skillIdToCatId.length ? this.skillIdToCatId[sId] : -1;
                    catIds.push(cId);
                }

                archetypeMap.set(fingerprint, {
                    type: r.type,
                    typeId: this.getOrAddTypeId(r.type),
                    skillIds,
                    skillLevels,
                    catIds,
                    relics: []
                });
            }
            archetypeMap.get(fingerprint)!.relics.push(r);
        }

        const archetypes = Array.from(archetypeMap.values());
        console.log(`Condensed into ${archetypes.length} unique relic archetypes.`);

        // Re-allocate arrays in case new skills were found during archetype gen
        if (this.targetCategoryLevels.length < this.categoryIdToName.length) {
            const old = this.targetCategoryLevels;
            this.targetCategoryLevels = new Int32Array(this.categoryIdToName.length);
            this.targetCategoryLevels.set(old);
        }
        if (this.targetSkillLevels.length < this.skillIdToName.length) {
            const old = this.targetSkillLevels;
            this.targetSkillLevels = new Int32Array(this.skillIdToName.length);
            this.targetSkillLevels.set(old);
        }

        const runningCat = new Int32Array(this.categoryIdToName.length);
        const runningSkill = new Int32Array(this.skillIdToName.length);
        const runningTypes = new Int32Array(this.typeIdToName.length);
        const currentBuild: Relic[] = [];

        this.backtrack(archetypes, 0, 0, runningCat, runningSkill, runningTypes, currentBuild, partition);

        // Sort by some heuristic, e.g. most total skill levels
        this.validBuilds.sort((a, b) => {
            const sumA = Object.values(a.rawSkillLevels).reduce((acc, v) => acc + v, 0);
            const sumB = Object.values(b.rawSkillLevels).reduce((acc, v) => acc + v, 0);
            if (sumB !== sumA) return sumB - sumA;
            const effA = Object.values(a.effectiveSkillLevels).reduce((acc, v) => acc + v, 0);
            const effB = Object.values(b.effectiveSkillLevels).reduce((acc, v) => acc + v, 0);
            return effB - effA;
        });

        return this.validBuilds;
    }

    private backtrack(
        archetypes: RelicArchetype[],
        startIndex: number,
        depth: number,
        runningCat: Int32Array,
        runningSkill: Int32Array,
        runningTypes: Int32Array,
        currentBuild: Relic[],
        partition?: { id: number, total: number }
    ) {
        if (this.validBuilds.length >= this.maxBuilds) return;

        if (depth === 6) {
            this.evaluateBuild(runningCat, runningSkill, currentBuild);
            return;
        }

        const remainingSlots = 6 - depth;

        // Pruning: Check if target category constraints are reachable
        let canReachAllCategories = true;
        for (let i = 0; i < this.targetCategoryLevels.length; i++) {
            const target = this.targetCategoryLevels[i];
            if (target > 0) {
                const maxPossibleRemaining = remainingSlots * MAX_POINTS_PER_RELIC;
                if (runningCat[i] + maxPossibleRemaining < target) {
                    canReachAllCategories = false;
                    break;
                }
            }
        }
        if (!canReachAllCategories) return;

        for (let i = startIndex; i < archetypes.length; i++) {
            const arch = archetypes[i];

            // Check max allowed types
            const currentOfThisType = runningTypes[arch.typeId];
            const maxAllowed = this.allowedSlots[arch.typeId];

            if (currentOfThisType >= maxAllowed) continue;

            const maxWeCanTake = Math.min(
                arch.relics.length,
                remainingSlots,
                maxAllowed - currentOfThisType
            );

            // Backtrack loop: take `take` instances of this archetype
            for (let take = 1; take <= maxWeCanTake; take++) {
                if (depth === 0 && partition) {
                    const isMyTurn = (this.rootBranchIndex % partition.total) === partition.id;
                    this.rootBranchIndex++;
                    if (!isMyTurn) continue;
                }

                // Apply stats
                for (let s = 0; s < arch.skillIds.length; s++) {
                    const sId = arch.skillIds[s];
                    const cId = arch.catIds[s];
                    const val = arch.skillLevels[s] * take;

                    runningSkill[sId] += val;
                    if (cId >= 0) runningCat[cId] += val;
                }
                runningTypes[arch.typeId] += take;

                for (let k = 0; k < take; k++) {
                    currentBuild.push(arch.relics[k]);
                }

                this.backtrack(archetypes, i + 1, depth + take, runningCat, runningSkill, runningTypes, currentBuild, partition);

                // Revert stats
                for (let k = 0; k < take; k++) {
                    currentBuild.pop();
                }
                runningTypes[arch.typeId] -= take;
                for (let s = 0; s < arch.skillIds.length; s++) {
                    const sId = arch.skillIds[s];
                    const cId = arch.catIds[s];
                    const val = arch.skillLevels[s] * take;

                    runningSkill[sId] -= val;
                    if (cId >= 0) runningCat[cId] -= val;
                }
            }
        }
    }

    private evaluateBuild(runningCat: Int32Array, runningSkill: Int32Array, build: Relic[]) {
        // Check raw category constraints strictly
        for (let i = 0; i < this.targetCategoryLevels.length; i++) {
            if (this.targetCategoryLevels[i] > 0 && runningCat[i] < this.targetCategoryLevels[i]) {
                return;
            }
        }

        // Check specific skill constraints strictly
        for (let i = 0; i < this.targetSkillLevels.length; i++) {
            if (this.targetSkillLevels[i] > 0 && runningSkill[i] < this.targetSkillLevels[i]) {
                return;
            }
        }

        const rawSkillLevels: Record<string, number> = {};
        const rawCategoryLevels: Record<string, number> = {};
        const effectiveSkillLevels: Record<string, number> = {};

        for (let i = 0; i < runningCat.length; i++) {
            if (runningCat[i] > 0 && i < this.categoryIdToName.length) {
                rawCategoryLevels[this.categoryIdToName[i]] = runningCat[i];
            }
        }

        for (let i = 0; i < runningSkill.length; i++) {
            if (runningSkill[i] > 0 && i < this.skillIdToName.length) {
                const name = this.skillIdToName[i];
                const rawVal = runningSkill[i];
                rawSkillLevels[name] = rawVal;

                const maxLvl = i < this.skillIdToMaxLevel.length && this.skillIdToMaxLevel[i] > 0
                    ? this.skillIdToMaxLevel[i] : 6;
                effectiveSkillLevels[name] = Math.min(rawVal, maxLvl);
            }
        }

        this.validBuilds.push({
            relics: [...build],
            rawCategoryLevels,
            rawSkillLevels,
            effectiveSkillLevels
        });
    }
}
