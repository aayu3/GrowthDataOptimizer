import { db, type CharacterLoadout, type DollSettings } from '../db/database';
import type { Relic } from '../optimizer/types';

export interface AppBackupData {
    relics: Relic[];
    characters: CharacterLoadout[];
    dollSettings: DollSettings[];
}

export interface AppBackupFile {
    schemaVersion: 1;
    app: 'GrowthDataOptimizer';
    exportedAt: string;
    data: AppBackupData;
}

export const BACKUP_FILE_NAME = 'growth-data-optimizer-backup.json';

export function isAppBackupFile(value: unknown): value is AppBackupFile {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AppBackupFile>;
    const data = candidate.data as Partial<AppBackupData> | undefined;

    return (
        candidate.schemaVersion === 1 &&
        candidate.app === 'GrowthDataOptimizer' &&
        typeof candidate.exportedAt === 'string' &&
        !!data &&
        Array.isArray(data.relics) &&
        Array.isArray(data.characters) &&
        Array.isArray(data.dollSettings)
    );
}

export async function createAppBackup(): Promise<AppBackupFile> {
    const [relics, characters, dollSettings] = await Promise.all([
        db.relics.toArray(),
        db.characters.toArray(),
        db.dollSettings.toArray()
    ]);

    return {
        schemaVersion: 1,
        app: 'GrowthDataOptimizer',
        exportedAt: new Date().toISOString(),
        data: {
            relics,
            characters,
            dollSettings
        }
    };
}

export async function restoreAppBackup(backup: AppBackupFile) {
    await db.transaction('rw', db.relics, db.characters, db.dollSettings, async () => {
        await db.relics.clear();
        await db.characters.clear();
        await db.dollSettings.clear();

        if (backup.data.relics.length > 0) {
            await db.relics.bulkAdd(backup.data.relics);
        }
        if (backup.data.characters.length > 0) {
            await db.characters.bulkAdd(backup.data.characters);
        }
        if (backup.data.dollSettings.length > 0) {
            await db.dollSettings.bulkAdd(backup.data.dollSettings);
        }
    });
}

export function downloadJsonFile(fileName: string, payload: unknown) {
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}
