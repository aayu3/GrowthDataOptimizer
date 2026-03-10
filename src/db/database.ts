import Dexie, { type EntityTable } from 'dexie';
import { Relic, OptimizerConstraints } from '../optimizer/types';
import { markDirty } from '../utils/dirtyState';

export interface CharacterLoadout {
    dollName: string;
    targetConstraints?: any;
    // Potentially specific saved builds
    savedBuilds?: Relic[][];
    isFavorite?: boolean;
    favoriteOrder?: number;
}

export interface DollSettings {
    dollName: string;
    constraints?: OptimizerConstraints;
    activeSkillFilters?: string[];
    simStats?: { ATK: number; DEF: number; HP: number; CRIT_RATE: number; CRIT_DMG: number; EnemyDEF: number };
    simIgnoredSkills?: string[];
    includeOtherEquipped?: boolean;
}

export const db = new Dexie('GrowthDataOptimizerDB') as Dexie & {
    relics: EntityTable<Relic, 'id'>;
    characters: EntityTable<CharacterLoadout, 'dollName'>;
    dollSettings: EntityTable<DollSettings, 'dollName'>;
};

db.version(1).stores({
    relics: '++id, type, rarity, main_skill.name, equipped', // Primary key and indexed props
    characters: 'dollName' // Primary key
});

db.version(2).stores({
    dollSettings: 'dollName'
});

function hookDirty(table: { hook: any }) {
    table.hook('creating', markDirty);
    table.hook('updating', markDirty);
    table.hook('deleting', markDirty);
}

hookDirty(db.relics);
hookDirty(db.characters);
hookDirty(db.dollSettings);
