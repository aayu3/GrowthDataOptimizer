
import { useEffect } from 'react';

interface ConfirmationModalProps {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    danger?: boolean;
}

export function ConfirmationModal({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    danger = false
}: ConfirmationModalProps) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            className="modal-overlay"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 11000 }}
            onClick={onCancel}
        >
            <div
                className="card glassmorphism"
                style={{ width: '400px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', textAlign: 'center' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ margin: 0, color: danger ? '#ff4757' : 'var(--accent-color)' }}>{title}</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
                <div style={{ display: 'flex', width: '100%', gap: '1rem' }}>
                    <button
                        className="glow-btn"
                        style={{
                            flex: 1,
                            background: danger ? 'rgba(255, 60, 60, 0.1)' : 'rgba(242, 108, 21, 0.1)',
                            borderColor: danger ? '#ff4c4c' : 'var(--accent-color)',
                            color: danger ? '#ff4c4c' : 'var(--accent-color)'
                        }}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                    <button
                        className="glow-btn"
                        style={{ flex: 1 }}
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
}
