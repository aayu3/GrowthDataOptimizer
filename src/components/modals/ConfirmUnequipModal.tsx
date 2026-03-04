
import { Relic } from '../../optimizer/types';

interface ConfirmUnequipModalProps {
    relic: Relic;
    onConfirm: (relic: Relic) => void | Promise<void>;
    onCancel: () => void;
}

export function ConfirmUnequipModal({ relic, onConfirm, onCancel }: ConfirmUnequipModalProps) {
    return (
        <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onCancel}
        >
            <div
                className="card glassmorphism"
                style={{ width: '350px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', textAlign: 'center' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ margin: 0, color: '#ff4757' }}>Unequip Relic?</h3>
                <p>Are you sure you want to unequip this relic?</p>
                <div style={{ display: 'flex', width: '100%', gap: '1rem' }}>
                    <button
                        className="glow-btn"
                        style={{ flex: 1, background: 'rgba(255, 60, 60, 0.1)', borderColor: '#ff4c4c', color: '#ff4c4c' }}
                        onClick={() => onConfirm(relic)}
                    >
                        Confirm
                    </button>
                    <button
                        className="glow-btn"
                        style={{ flex: 1 }}
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
