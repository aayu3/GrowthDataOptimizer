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
        <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <aside
                className="card glassmorphism"
                style={{ position: 'relative', width: '400px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                <RelicInspector
                    selectedRelic={relic}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            </aside>
        </div>
    );

    return createPortal(modalContent, document.body);
};
