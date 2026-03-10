import { BACKUP_FILE_NAME, type AppBackupFile } from './backup';

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveBackupFileMetadata {
    id: string;
    name: string;
    modifiedTime: string;
}

function createAuthHeaders(accessToken: string) {
    return {
        Authorization: `Bearer ${accessToken}`
    };
}

async function parseDriveError(response: Response) {
    try {
        const payload = await response.json();
        const message = payload?.error?.message;
        return message || `Google Drive request failed with status ${response.status}.`;
    } catch {
        return `Google Drive request failed with status ${response.status}.`;
    }
}

export async function findDriveBackupFile(accessToken: string): Promise<DriveBackupFileMetadata | null> {
    const params = new URLSearchParams({
        spaces: 'appDataFolder',
        q: `name='${BACKUP_FILE_NAME}' and trashed=false`,
        fields: 'files(id,name,modifiedTime)',
        pageSize: '1'
    });

    const response = await fetch(`${DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
        headers: createAuthHeaders(accessToken)
    });

    if (!response.ok) {
        throw new Error(await parseDriveError(response));
    }

    const payload = await response.json() as { files?: DriveBackupFileMetadata[] };
    return payload.files?.[0] || null;
}

export async function downloadDriveBackup(accessToken: string, fileId: string): Promise<AppBackupFile> {
    const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`, {
        headers: createAuthHeaders(accessToken)
    });

    if (!response.ok) {
        throw new Error(await parseDriveError(response));
    }

    return response.json() as Promise<AppBackupFile>;
}

function createMultipartBody(backup: AppBackupFile) {
    const formData = new FormData();
    // Note: `parents` is not writable on update (PATCH). Only include it on create (POST).
    formData.append('metadata', new Blob([JSON.stringify({
        name: BACKUP_FILE_NAME
    })], { type: 'application/json' }));
    formData.append('file', new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    return formData;
}

function createMultipartBodyForCreate(backup: AppBackupFile) {
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify({
        name: BACKUP_FILE_NAME,
        parents: ['appDataFolder']
    })], { type: 'application/json' }));
    formData.append('file', new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    return formData;
}

export async function uploadDriveBackup(
    accessToken: string,
    backup: AppBackupFile,
    existingFileId?: string,
    opts?: { keepalive?: boolean }
): Promise<DriveBackupFileMetadata> {
    const targetUrl = existingFileId
        ? `${DRIVE_UPLOAD_ENDPOINT}/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime`
        : `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,modifiedTime`;

    const response = await fetch(targetUrl, {
        method: existingFileId ? 'PATCH' : 'POST',
        headers: createAuthHeaders(accessToken),
        body: existingFileId ? createMultipartBody(backup) : createMultipartBodyForCreate(backup),
        keepalive: !!opts?.keepalive
    });

    if (!response.ok) {
        throw new Error(await parseDriveError(response));
    }

    return response.json() as Promise<DriveBackupFileMetadata>;
}
