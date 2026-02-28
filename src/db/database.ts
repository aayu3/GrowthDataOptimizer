import Dexie, { type EntityTable } from 'dexie';
import { Relic } from '../optimizer/types';

export interface CharacterLoadout {
    dollName: string;
    targetConstraints?: any;
    // Potentially specific saved builds
    savedBuilds?: Relic[][];
}

export const db = new Dexie('GrowthDataOptimizerDB') as Dexie & {
    relics: EntityTable<Relic, 'id'>;
    characters: EntityTable<CharacterLoadout, 'dollName'>;
};

db.version(1).stores({
    relics: '++id, type, rarity, main_skill.name, equipped', // Primary key and indexed props
    characters: 'dollName' // Primary key
});
