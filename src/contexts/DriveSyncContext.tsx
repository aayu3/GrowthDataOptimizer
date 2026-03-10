import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from './ToastContext';
import { clearDirty, getDirtySince, isDirty, subscribeDirty } from '../utils/dirtyState';
import { createAppBackup, isAppBackupFile, restoreAppBackup } from '../utils/backup';
import { downloadDriveBackup, findDriveBackupFile, uploadDriveBackup, type DriveBackupFileMetadata } from '../utils/googleDrive';
import { isGoogleDriveConfigured, requestGoogleAccessToken, revokeGoogleAccessToken } from '../utils/googleIdentity';

const LOCAL_BASELINE_AT_KEY = 'gdo_drive_local_baseline_at';

interface DriveSyncContextType {
    configured: boolean;
    connected: boolean;
    isBusy: boolean;
    backupFile: DriveBackupFileMetadata | null;
    localBaselineAt: number;
    dirtySince: number;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    backupNow: (opts?: { silent?: boolean; keepalive?: boolean }) => Promise<void>;
    restoreNow: () => Promise<void>;
}

const DriveSyncContext = createContext<DriveSyncContextType | undefined>(undefined);

export function useDriveSync() {
    const ctx = useContext(DriveSyncContext);
    if (!ctx) {
        throw new Error('useDriveSync must be used within a DriveSyncProvider');
    }
    return ctx;
}

export function DriveSyncProvider({ children }: { children: ReactNode }) {
    const { showNotification } = useToast();
    const [accessToken, setAccessToken] = useState('');
    const [backupFile, setBackupFile] = useState<DriveBackupFileMetadata | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [localBaselineAt, setLocalBaselineAt] = useState<number>(() => {
        const raw = localStorage.getItem(LOCAL_BASELINE_AT_KEY);
        const parsed = raw ? Number(raw) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
    });
    const [dirtySince, setDirtySince] = useState(() => getDirtySince());
    const configured = isGoogleDriveConfigured();

    const accessTokenRef = useRef(accessToken);
    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

    const refreshBackupFile = async (token: string) => {
        const file = await findDriveBackupFile(token);
        setBackupFile(file);
        return file;
    };

    const connect = async () => {
        if (!configured) {
            throw new Error('Google Drive sync is not configured. Set VITE_GOOGLE_CLIENT_ID first.');
        }

        const response = await requestGoogleAccessToken('consent');
        setAccessToken(response.access_token);
        await refreshBackupFile(response.access_token);
        showNotification({ type: 'success', message: 'Connected to Google Drive.' });
    };

    const disconnect = async () => {
        const token = accessTokenRef.current;
        if (token) {
            await revokeGoogleAccessToken(token);
        }
        setAccessToken('');
        setBackupFile(null);
    };

    useEffect(() => {
        const unsubscribe = subscribeDirty(() => setDirtySince(getDirtySince()));
        return unsubscribe;
    }, []);

    const backupNow = async (opts?: { silent?: boolean; keepalive?: boolean }) => {
        const token = accessTokenRef.current;
        if (!token) return;

        setIsBusy(true);
        try {
            const backup = await createAppBackup();
            const existingFile = backupFile || await refreshBackupFile(token);
            const uploadedFile = await uploadDriveBackup(token, backup, existingFile?.id, { keepalive: !!opts?.keepalive });
            setBackupFile(uploadedFile);
            clearDirty();
            const now = Date.now();
            localStorage.setItem(LOCAL_BASELINE_AT_KEY, String(now));
            setLocalBaselineAt(now);
            if (!opts?.silent) {
                showNotification({ type: 'success', message: 'Uploaded backup to Google Drive.' });
            }
        } finally {
            setIsBusy(false);
        }
    };

    const restoreNow = async () => {
        const token = accessTokenRef.current;
        if (!token) return;

        setIsBusy(true);
        try {
            const existingFile = backupFile || await refreshBackupFile(token);
            if (!existingFile) {
                throw new Error('No Drive backup file was found.');
            }

            const backup = await downloadDriveBackup(token, existingFile.id);
            if (!isAppBackupFile(backup)) {
                throw new Error('Drive backup file is not a valid GrowthDataOptimizer backup.');
            }

            await restoreAppBackup(backup);
            clearDirty();
            const now = Date.now();
            localStorage.setItem(LOCAL_BASELINE_AT_KEY, String(now));
            setLocalBaselineAt(now);
            showNotification({ type: 'success', message: 'Restored app data from Google Drive.' });
        } finally {
            setIsBusy(false);
        }
    };

    const value = useMemo<DriveSyncContextType>(() => ({
        configured,
        connected: accessToken.length > 0,
        isBusy,
        backupFile,
        localBaselineAt,
        dirtySince,
        connect,
        disconnect,
        backupNow,
        restoreNow
    }), [accessToken.length, backupFile, configured, dirtySince, isBusy, localBaselineAt]);

    // Best-effort: when the tab is backgrounded/closed, try to upload if dirty.
    useEffect(() => {
        if (!accessToken) return;

        let ran = false;
        const tryFlush = () => {
            if (ran) return;
            ran = true;
            if (!isDirty()) return;
            backupNow({ silent: true, keepalive: true }).catch(() => undefined);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                tryFlush();
            }
        };

        window.addEventListener('pagehide', tryFlush);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('pagehide', tryFlush);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [accessToken]);

    return (
        <DriveSyncContext.Provider value={value}>
            {children}
        </DriveSyncContext.Provider>
    );
}
