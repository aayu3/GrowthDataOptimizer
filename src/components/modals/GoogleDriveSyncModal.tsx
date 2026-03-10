import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDriveSync } from '../../contexts/DriveSyncContext';
import { ConfirmationModal } from './ConfirmationModal';

interface GoogleDriveSyncModalProps {
    onClose: () => void;
}

export function GoogleDriveSyncModal({ onClose }: GoogleDriveSyncModalProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const { configured, connected, isBusy, backupFile, localBaselineAt, dirtySince, connect, disconnect, backupNow, restoreNow } = useDriveSync();

    const driveModifiedAt = backupFile ? Date.parse(backupFile.modifiedTime) : 0;
    const driveIsNewerThanLocal = !!backupFile && (!localBaselineAt || (Number.isFinite(driveModifiedAt) && driveModifiedAt > localBaselineAt));
    const localHasUnsyncedChanges = dirtySince > 0;
    const driveIsOlderThanLocal = connected && localHasUnsyncedChanges && !!backupFile;
    const likelyConflict = connected && localHasUnsyncedChanges && driveIsNewerThanLocal;

    const handleConnect = async () => {
        if (!configured) {
            setErrorMsg('Google Drive sync is not configured. Set VITE_GOOGLE_CLIENT_ID first.');
            return;
        }

        setIsConnecting(true);
        setErrorMsg('');

        try {
            await connect();
        } catch (error) {
            console.error('Failed to connect to Google Drive', error);
            setErrorMsg(error instanceof Error ? error.message : 'Failed to connect to Google Drive.');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        await disconnect();
        setErrorMsg('');
    };

    const handleBackup = async () => {
        setErrorMsg('');

        try {
            await backupNow();
        } catch (error) {
            console.error('Failed to upload Drive backup', error);
            setErrorMsg(error instanceof Error ? error.message : 'Failed to upload backup.');
        }
    };

    const handleRestore = async () => {
        setErrorMsg('');

        if (localHasUnsyncedChanges) {
            setShowRestoreConfirm(true);
            return;
        }

        try {
            await restoreNow();
            onClose();
        } catch (error) {
            console.error('Failed to restore Drive backup', error);
            setErrorMsg(error instanceof Error ? error.message : 'Failed to restore backup.');
        }
    };

    return createPortal(
        <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <div
                className="card glassmorphism"
                style={{ width: '480px', maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ margin: 0 }}>Google Drive Sync</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    Connect with Google OAuth, then upload or restore a single hidden backup file stored in your Drive app data folder.
                </p>

                {!configured && (
                    <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius)', background: 'rgba(252, 129, 129, 0.08)', border: '1px solid rgba(252, 129, 129, 0.24)' }}>
                        <p style={{ margin: 0, color: 'var(--danger)', fontWeight: 600 }}>Missing Google client ID</p>
                        <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Add <code>VITE_GOOGLE_CLIENT_ID</code> to your local env before using Drive sync.
                        </p>
                    </div>
                )}

                <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                        Status: <span style={{ color: connected ? 'var(--success)' : 'var(--text-secondary)' }}>{connected ? 'Connected' : 'Not connected'}</span>
                    </p>
                    <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {backupFile
                            ? `Drive backup last updated ${new Date(backupFile.modifiedTime).toLocaleString()}.`
                            : 'No existing Drive backup found yet.'}
                    </p>
                </div>

                {connected && likelyConflict && (
                    <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius)', background: 'rgba(252, 129, 129, 0.10)', border: '1px solid rgba(252, 129, 129, 0.30)' }}>
                        <p style={{ margin: 0, fontWeight: 800 }}>Potential conflict detected</p>
                        <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Drive backup is newer, and this device also has unsynced changes. Restore will overwrite local data; Backup will overwrite newer Drive data.
                        </p>
                    </div>
                )}

                {connected && !likelyConflict && driveIsNewerThanLocal && (
                    <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius)', background: 'rgba(246, 224, 94, 0.10)', border: '1px solid rgba(246, 224, 94, 0.30)' }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>Drive backup is newer than this device</p>
                        <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Consider restoring before making changes here to avoid overwriting newer Drive data.
                        </p>
                    </div>
                )}

                {connected && !likelyConflict && driveIsOlderThanLocal && (
                    <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius)', background: 'rgba(246, 224, 94, 0.10)', border: '1px solid rgba(246, 224, 94, 0.30)' }}>
                        <p style={{ margin: 0, fontWeight: 700 }}>This device has newer data than Drive</p>
                        <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            You have local changes that have not been uploaded yet. Use Backup to update Drive.
                        </p>
                    </div>
                )}

                <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Drive restore replaces your current local Dexie data. Upload writes a single file named <code>growth-data-optimizer-backup.json</code> into Google Drive <code>appDataFolder</code>.
                    </p>
                </div>

                {errorMsg && (
                    <p style={{ margin: 0, color: 'var(--danger)' }}>{errorMsg}</p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                    {!connected ? (
                        <button className="glow-btn" disabled={!configured || isConnecting} onClick={handleConnect}>
                            {isConnecting ? 'Connecting...' : 'Connect Google Drive'}
                        </button>
                    ) : (
                        <>
                            <button className="glow-btn" disabled={isBusy} onClick={handleBackup}>
                                {isBusy ? 'Working...' : 'Backup To Google Drive'}
                            </button>
                            <button
                                className="glow-btn"
                                disabled={isBusy}
                                style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--success)', color: 'var(--success)' }}
                                onClick={handleRestore}
                            >
                                {isBusy ? 'Working...' : 'Restore From Google Drive'}
                            </button>
                            <button
                                className="glow-btn"
                                disabled={isBusy}
                                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text-secondary)' }}
                                onClick={handleDisconnect}
                            >
                                Disconnect
                            </button>
                        </>
                    )}
                    <button
                        className="glow-btn"
                        style={{ background: 'rgba(255, 60, 60, 0.1)', borderColor: '#ff4c4c', color: '#ff4c4c' }}
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>

            {showRestoreConfirm && (
                <ConfirmationModal
                    title={likelyConflict ? 'Restore will overwrite local changes' : 'Restore will overwrite local data'}
                    message={
                        likelyConflict
                            ? 'Your Drive backup is newer, and this device also has unsynced changes.\n\nRestoring will replace your local data with the Drive backup. Continue?'
                            : 'This device has changes that have not been uploaded.\n\nRestoring will replace your local data with the Drive backup. Continue?'
                    }
                    confirmText="Restore"
                    cancelText="Cancel"
                    danger={true}
                    onCancel={() => setShowRestoreConfirm(false)}
                    onConfirm={async () => {
                        setErrorMsg('');
                        try {
                            await restoreNow();
                            setShowRestoreConfirm(false);
                            onClose();
                        } catch (error) {
                            console.error('Failed to restore Drive backup', error);
                            setErrorMsg(error instanceof Error ? error.message : 'Failed to restore backup.');
                            setShowRestoreConfirm(false);
                        }
                    }}
                />
            )}
        </div>,
        document.body
    );
}
