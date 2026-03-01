import React from 'react';
import { createPortal } from 'react-dom';
import { Relic } from '../optimizer/types';
import { RelicInspector } from './RelicInspector';

interface RelicModalProps {
    relic: Relic;
    onClose: () => void;
    onEdit?: (relic: Relic) => void;
    onDelete?: (relic: Relic) => void;
}

export const RelicModal: React.FC<RelicModalProps> = ({ relic, onClose, onEdit, onDelete }) => {
    const modalContent = (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
            <aside className="card glassmorphism" style={{ position: 'relative', width: '400px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,0,0,0.2)', color: '#ff4c4c', border: '1px solid rgba(255,0,0,0.4)', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '3px' }}
                >×</button>
                <div style={{ marginTop: '20px' }}>
                    <RelicInspector
                        selectedRelic={relic}
                        onClose={onClose}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                </div>
            </aside>
        </div>
    );

    return createPortal(modalContent, document.body);
};
