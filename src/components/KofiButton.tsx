export function KofiButton() {
    return (
        <a
            href="https://ko-fi.com/N4N51V6NN9"
            target="_blank"
            rel="noopener noreferrer"
            className="kofi-button-cta"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: '#e25b0d',
                color: '#ffffff',
                padding: '1.2rem 2rem',
                borderRadius: 'var(--radius-button)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '1.1rem',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                zIndex: 5
            }}
        >
            <img
                src="https://storage.ko-fi.com/cdn/cup-border.png"
                alt="Ko-fi"
                style={{ width: '24px', height: '16px', filter: 'brightness(0) invert(1)' }}
            />
            <span>Support me on Ko-fi</span>
        </a>
    );
}
