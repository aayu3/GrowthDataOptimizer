export interface RelicSkill {
    name: string;
    level: number;
}

export interface Relic {
    id?: string;
    type: string; // "Bulwark", "Vanguard", etc.
    total_level: number;
    rarity: string;
    main_skill: RelicSkill;
    aux_skills: RelicSkill[];
    equipped: string | null;
}

export interface OptimizerConstraints {
    targetCategoryLevels: Record<string, number>; // e.g. { "Bulwark": 12, "Support": 8 }
    targetSkillLevels: Record<string, number>;    // e.g. { "HP Boost": 6 }
    allowedSlots?: Record<string, number>;        // e.g. { "Support": 4, "Bulwark": 2 }
}

export interface BuildResult {
    relics: Relic[];
    rawCategoryLevels: Record<string, number>;
    rawSkillLevels: Record<string, number>;
    effectiveSkillLevels: Record<string, number>;
}

export interface SkillDefinition {
    type: string;
    maxlevel: number;
    description?: string;
}

export interface DollBonus {
    tier: number;
    description: string;
    [category: string]: number | string; // E.g., "Bulwark": 2
}

export interface DollDefinition {
    allowed_slots: Record<string, number>;
    bonuses: DollBonus[];
}
