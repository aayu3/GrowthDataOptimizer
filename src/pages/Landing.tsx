import { useState, useRef, MouseEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gfl2Logo from '../assets/gfl2-logo.png';
import gfl2LogoLight from '../assets/gfl2-logo-light.png';

const SAMPLE_DOLLS = ['Qiongjiu', 'Peritya', 'Sabrina', 'Colphne', 'Groza', 'Nemesis', 'Klukai', 'Suomi'];

function FloatingCard({ dollName, initialPos, mouseX, mouseY }: { dollName: string, initialPos: { top: string, left: string, delay: number }, mouseX: number, mouseY: number }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState('perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    const imgPath = new URL(`../assets/doll_images/${dollName}.png`, import.meta.url).href;

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
        >
            <div className="doll-img-container" style={{ width: '60px', height: '60px' }}>
                <img src={imgPath} alt={dollName} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dollName}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>+24% CRIT DMG</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Optimized Build</span>
            </div>
        </div>
    );
}

export function Landing() {
    const navigate = useNavigate();
    const [mouseX, setMouseX] = useState(window.innerWidth / 2);
    const [mouseY, setMouseY] = useState(window.innerHeight / 2);
    const [isExiting, setIsExiting] = useState(false);

    const handleExit = () => {
        if (isExiting) return;
        setIsExiting(true);
        setTimeout(() => {
            navigate('/characters');
        }, 500);
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
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

            {SAMPLE_DOLLS.map((doll, idx) => (
                <FloatingCard key={doll} dollName={doll} initialPos={cardPositions[idx]} mouseX={mouseX} mouseY={mouseY} />
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

            <button
                className="high-contrast-btn"
                onClick={handleExit}
                style={{ zIndex: 5, fontSize: '1.25rem', padding: '1.2rem 4rem' }}
            >
                Start Building
            </button>
        </div>
    );
}
