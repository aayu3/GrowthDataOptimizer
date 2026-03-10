import { createPortal } from 'react-dom';
import { Relic } from '../../optimizer/types';
import { BACKUP_FILE_NAME, createAppBackup, downloadJsonFile } from '../../utils/backup';

interface ExportInventoryModalProps {
    relics: Relic[];
    onClose: () => void;
}

export function ExportInventoryModal({ relics, onClose }: ExportInventoryModalProps) {
    const handleExportBackup = async () => {
        const backup = await createAppBackup();
        downloadJsonFile(BACKUP_FILE_NAME, backup);
        onClose();
    };

    const handleExportEquipped = () => {
        const equippedRelics = relics.filter(r => r.equipped);
        downloadJsonFile('equipped_relics_all.json', equippedRelics);
        onClose();
    };

    const handleExportRelics = () => {
        downloadJsonFile('relic_inventory.json', relics);
        onClose();
    };

    return createPortal(
        <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <div
                className="card glassmorphism"
                style={{ width: '400px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ margin: 0 }}>Export Data</h3>
                <p>Choose a full backup for device transfer, or export relic-only JSON for the existing inventory flow.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button className="glow-btn" onClick={handleExportBackup}>
                        Export Full Backup
                    </button>
                    <button className="glow-btn" onClick={handleExportRelics}>
                        Export All Relics
                    </button>
                    <button className="glow-btn" onClick={handleExportEquipped}>
                        Export All Equipped Relics
                    </button>
                    <button className="glow-btn" style={{ background: 'rgba(255, 60, 60, 0.1)', borderColor: '#ff4c4c', color: '#ff4c4c' }} onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
