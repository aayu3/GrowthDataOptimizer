import { useState, useRef, MouseEvent, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import gfl2Logo from '../assets/gfl2-logo.webp';
import gfl2LogoLight from '../assets/gfl2-logo-light.webp';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { GoogleDriveSyncModal } from '../components/modals/GoogleDriveSyncModal';

const SAMPLE_DOLLS = ['Qiongjiu', 'Peritya', 'Sabrina', 'Colphne', 'Groza', 'Nemesis', 'Klukai', 'Suomi'];

function FloatingCard({ dollName, initialPos, mouseX, mouseY, onClick }: { dollName: string, initialPos: { top: string, left: string, delay: number }, mouseX: number, mouseY: number, onClick: () => void }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState('perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    const imgPath = new URL(`../assets/doll_images/${dollName}.webp`, import.meta.url).href;
    const buildsFound = useMemo(() => Math.floor(Math.random() * (90000 - 30000 + 1) + 30000).toLocaleString(), []);

    // Calculate distance and angle relative to the global mouse position
    useEffect(() => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();

        // Find the center of this specific card
        const cardCenterX = rect.left + rect.width / 2;
        const cardCenterY = rect.top + rect.height / 2;

        // Calculate distance from mouse to the center of the card
        const deltaX = mouseX - cardCenterX;
        const deltaY = mouseY - cardCenterY;

        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = Math.max(window.innerWidth, window.innerHeight); // Max possible distance

        // If mouse is at center, angle is sharpest. If far away, angle softens.
        // We invert the rotation so it tilts *towards* the mouse (like a trampoline dipping).
        // 1 = mouse is directly on top of card, 0 = far away
        const proximity = Math.max(0, 1 - (distance / maxDistance));

        // Rotation (Tilt): Halve the intensity (from 35 to ~15) to reduce overall movement
        const tiltIntensity = 15 * proximity;
        const rotateX = (deltaY / window.innerHeight) * tiltIntensity * -1;
        const rotateY = (deltaX / window.innerWidth) * tiltIntensity;

        // Translation (Shift): Opposite to the mouse's relative direction.
        // We multiply by proximity cubed so that the shift is highest closer to the mouse 
        // and drops off completely (inversely correlated to distance) for distant cards.
        // Magic number 150 gives us a peak shift of ~15px just off-center from the mouse.
        const shiftIntensity = 150 * Math.pow(proximity, 3);
        const translateX = (deltaX / window.innerWidth) * -shiftIntensity;
        const translateY = (deltaY / window.innerHeight) * -shiftIntensity;

        setTransform(`perspective(1200px) translateX(${translateX}px) translateY(${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1, 1, 1)`);

    }, [mouseX, mouseY]);

    return (
        <div
            ref={cardRef}
            className="floating-card glass-panel"
            style={{
                position: 'absolute',
                top: initialPos.top,
                left: initialPos.left,
                transform,
                transition: 'transform 0.1s ease-out',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                zIndex: 1
            }}
            onClick={onClick}
        >
            <div className="doll-img-container" style={{ width: '60px', height: '60px' }}>
                <img src={imgPath} alt={dollName} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dollName}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>{buildsFound} Builds Found</span>
                {/*<span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Optimized Build</span>*/}
            </div>
        </div>
    );
}

export function Landing() {
    const navigate = useNavigate();
    const [mouseX, setMouseX] = useState(window.innerWidth / 2);
    const [mouseY, setMouseY] = useState(window.innerHeight / 2);
    const [isExiting, setIsExiting] = useState(false);
    const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);

    const handleExit = (path?: string) => {
        if (isExiting) return;
        setIsExiting(true);
        setTimeout(() => {
            navigate(path || '/characters');
        }, 500);
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (showGoogleDriveModal) return;
        if (e.deltaY > 50) {
            handleExit();
        }
    };

    const handleGlobalMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        // Request animation frame for performance if needed, but standard state update should be fine for 8 cards
        setMouseX(e.clientX);
        setMouseY(e.clientY);
    };

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const cached = localStorage.getItem('theme');
        if (cached === 'light' || cached === 'dark') return cached;
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'dark';
    });

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const cardPositions = [
        { top: '15%', left: '10%', delay: 0 },
        { top: '65%', left: '15%', delay: 2 },
        { top: '20%', left: '75%', delay: 1 },
        { top: '70%', left: '80%', delay: 3 },
        { top: '10%', left: '40%', delay: 1.5 },
        { top: '80%', left: '45%', delay: 0.5 },
        { top: '40%', left: '5%', delay: 2.5 },
        { top: '45%', left: '85%', delay: 1.2 }
    ];

    const characters = useLiveQuery(() => db.characters.toArray(), []) || [];
    const displayDolls = useMemo(() => {
        const topDolls = characters
            .filter(c => c.isFavorite)
            .sort((a, b) => {
                const af = a.favoriteOrder ?? 999999;
                const bf = b.favoriteOrder ?? 999999;
                return af - bf;
            })
            .map(c => c.dollName);

        const result = [...topDolls];
        for (let i = 0; result.length < 8 && i < SAMPLE_DOLLS.length; i++) {
            if (!result.includes(SAMPLE_DOLLS[i])) {
                result.push(SAMPLE_DOLLS[i]);
            }
        }
        return result.slice(0, 8);
    }, [characters]);

    return (
        <div
            onMouseMove={handleGlobalMouseMove}
            onWheel={handleWheel}
            className={isExiting ? 'page-exit-up' : 'page-enter-up'}
            style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
            <button
                onClick={toggleTheme}
                style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', zIndex: 10, fontSize: '1.5rem' }}
                aria-label="Toggle Theme"
            >
                {theme === 'light' ? '☾' : '☀'}
            </button>

            {displayDolls.map((doll, idx) => (
                <FloatingCard
                    key={doll}
                    dollName={doll}
                    initialPos={cardPositions[idx]}
                    mouseX={mouseX}
                    mouseY={mouseY}
                    onClick={() => handleExit(`/doll/${doll}`)}
                />
            ))}

            <style>{`
                @keyframes float-up {
                    0% { margin-top: 0px; }
                    50% { margin-top: -15px; }
                    100% { margin-top: 0px; }
                }
                .landing-title {
                    font-size: 5rem;
                    font-weight: 800;
                    letter-spacing: -2px;
                    line-height: 1.1;
                    text-align: center;
                    max-width: 800px;
                    margin-bottom: 3rem;
                    z-index: 5;
                    color: var(--text-primary);
                }
                @media (max-width: 768px) {
                    .landing-title { font-size: 3rem; }
                    .floating-card { display: none !important; }
                    .landing-cta-row { flex-direction: column; width: min(90vw, 360px); }
                    .landing-cta-row button { width: 100%; justify-content: center; }
                }
                .page-exit-up {
                    animation: slide-up-fade 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                .page-enter-up {
                    animation: slide-down-fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                @keyframes slide-up-fade {
                    0% { transform: translateY(0); opacity: 1; }
                    100% { transform: translateY(-20vh); opacity: 0; filter: blur(10px); }
                }
                @keyframes slide-down-fade-in {
                    0% { transform: translateY(-20vh); opacity: 0; filter: blur(10px); }
                    100% { transform: translateY(0); opacity: 1; filter: blur(0px); }
                }
            `}</style>

            <img
                src={theme === 'dark' ? gfl2Logo : gfl2LogoLight}
                alt="Girls' Frontline 2: Exilium"
                style={{
                    maxWidth: '600px',
                    width: '90%',
                    marginBottom: '1rem',
                    zIndex: 5,
                    animation: 'slide-down-fade-in 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
                }}
            />
            <h1 className="landing-title" style={{ marginTop: '0' }}>
                Optimize without the spreadsheet.
            </h1>

            <div className="landing-cta-row" style={{ display: 'flex', gap: '1rem', zIndex: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                    className="high-contrast-btn"
                    onClick={() => handleExit()}
                    style={{ fontSize: '1.25rem', padding: '1.2rem 4rem' }}
                >
                    Start Building
                </button>
                <button
                    className="glow-btn"
                    onClick={() => setShowGoogleDriveModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.85rem', fontSize: '1rem', padding: '1.05rem 1.6rem' }}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M21.35 11.1H12v2.98h5.33c-.23 1.5-1.88 4.4-5.33 4.4-3.21 0-5.83-2.66-5.83-5.94s2.62-5.94 5.83-5.94c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.69 4.05 14.58 3 12 3 6.92 3 2.8 7.12 2.8 12.2S6.92 21.4 12 21.4c6.92 0 8.62-6.07 8.62-8.96 0-.6-.06-1.03-.14-1.34Z" />
                        <path fill="#34A853" d="M3.87 7.02l2.45 1.8C6.98 7.22 9.27 5.6 12 5.6c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.69 4.05 14.58 3 12 3 8.48 3 5.43 5.01 3.87 7.02Z" opacity="0" />
                        <path fill="#FBBC05" d="M3 12.2c0 1.64.39 3.19 1.08 4.56l2.85-2.2c-.17-.5-.26-1.04-.26-1.6 0-.56.09-1.1.26-1.6l-2.85-2.2C3.39 9.01 3 10.56 3 12.2Z" />
                        <path fill="#34A853" d="M12 21.4c2.52 0 4.64-.83 6.19-2.25l-3.03-2.35c-.81.56-1.85.95-3.16.95-3.44 0-5.1-2.9-5.33-4.39l-2.83 2.18C5.38 18.78 8.42 21.4 12 21.4Z" />
                        <path fill="#EA4335" d="M21.35 11.1H12v2.98h5.33c-.11.72-.54 1.81-1.5 2.72l3.03 2.35c1.82-1.68 2.76-4.16 2.76-7.11 0-.6-.06-1.03-.14-1.34Z" />
                    </svg>
                    Sync
                </button>
            </div>

            {showGoogleDriveModal && (
                <GoogleDriveSyncModal onClose={() => setShowGoogleDriveModal(false)} />
            )}
        </div>
    );
}
