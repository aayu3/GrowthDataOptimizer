import { createPortal } from 'react-dom';
import { Relic } from '../../optimizer/types';

interface ExportInventoryModalProps {
    relics: Relic[];
    onClose: () => void;
}

export function ExportInventoryModal({ relics, onClose }: ExportInventoryModalProps) {
    const handleExportInventory = async () => {
        // Full export from the passed 'relics' or db
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(relics, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "relic_inventory.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        onClose();
    };

    const handleExportEquipped = () => {
        const equippedRelics = relics.filter(r => r.equipped);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(equippedRelics, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "equipped_relics_all.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
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
                <h3 style={{ margin: 0 }}>Export Relics</h3>
                <p>What would you like to export?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button className="glow-btn" onClick={handleExportInventory}>
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
