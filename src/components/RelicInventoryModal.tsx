import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { DollDefinition } from '../optimizer/types';
import dollsData from '../data/dolls.json';
import { RelicDatabaseViewer } from './RelicDatabaseViewer';

interface RelicInventoryModalProps {
    selectedDoll: string;
    onClose: () => void;
}

export const RelicInventoryModal: React.FC<RelicInventoryModalProps> = ({ selectedDoll, onClose }) => {
    const [equipError, setEquipError] = useState<string | null>(null);
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];

    const handleSelect = async (r: any) => {
        if (r.id && selectedDoll && dollsData) {
            const dollData = (dollsData as Record<string, DollDefinition>)[selectedDoll];
            if (dollData && dollData.allowed_slots) {
                const maxAllowed = dollData.allowed_slots[r.type] || 0;
                const currentEquippedTyped = relics.filter(er => er.equipped === selectedDoll && er.type === r.type).length;

                if (currentEquippedTyped >= maxAllowed) {
                    setEquipError(`Cannot equip. ${selectedDoll} can only hold ${maxAllowed} ${r.type} relics.`);
                    return;
                }
            }
            await db.relics.update(r.id, { equipped: selectedDoll });
            setEquipError(null);
            onClose();
        }
    };

    const modalContent = (
        <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <div
                className="card glassmorphism"
                style={{ position: 'relative', width: '90vw', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,0,0,0.2)', color: '#ff4c4c', border: '1px solid rgba(255,0,0,0.4)', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '3px' }}
                >×</button>

                <h3 style={{ marginTop: '0', marginBottom: '1rem', paddingRight: '2rem' }}>Equip Relic to {selectedDoll}</h3>

                {equipError && (
                    <div style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(255,0,0,0.1)', borderRadius: '4px' }}>
                        {equipError}
                    </div>
                )}

                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <RelicDatabaseViewer
                        mode="select"
                        excludeEquippedBy={selectedDoll}
                        onSelect={handleSelect}
                    />
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
