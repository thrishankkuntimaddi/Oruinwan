import React, { useState, useEffect } from 'react';

const LoadingScreen = ({ onComplete }) => {
    // Phases: 'initial' | 'center-icon' | 'center-text' | 'moving' | 'done'
    const [phase, setPhase] = useState('initial');
    const [text, setText] = useState('');
    const fullText = 'Chttrix';

    useEffect(() => {
        let isMounted = true;

        const runSequence = async () => {
            // 0. Wait for mount (100ms)
            await new Promise(r => setTimeout(r, 100));
            if (!isMounted) return;
            setPhase('center-icon'); // Icon fades in at center

            // 1. Hold Icon Center (800ms)
            await new Promise(r => setTimeout(r, 800));
            if (!isMounted) return;

            // 2. Icon shifts left (visually due to expansion), prepare for text
            setPhase('center-text');

            // 3. Type "Chttrix"
            // Wait a moment for layout shift (100ms)
            await new Promise(r => setTimeout(r, 100));
            if (!isMounted) return;

            for (let i = 0; i <= fullText.length; i++) {
                if (!isMounted) return;
                setText(fullText.slice(0, i));
                await new Promise(r => setTimeout(r, 80)); // Typing speed
            }

            // 4. Hold full text in center (1000ms)
            await new Promise(r => setTimeout(r, 800));
            if (!isMounted) return;

            // 5. Move to Top Left & Fade Bg
            setPhase('moving');

            // 6. Wait for movement transition (e.g. 1000ms for smooth glide)
            await new Promise(r => setTimeout(r, 1000));
            if (!isMounted) return;

            // 7. Done / Unmount
            if (onComplete) onComplete();
        };

        runSequence();

        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Positioning State
    const isCentered = phase === 'initial' || phase === 'center-icon' || phase === 'center-text';
    const isMoving = phase === 'moving';

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Background Layer - White/Dark - Fades OUT when moving starts */}
            <div
                className={`absolute inset-0 bg-white dark:bg-[#030712] transition-opacity duration-[1000ms] ease-in-out ${isMoving ? 'opacity-0' : 'opacity-100'}`}
            ></div>

            {/* Content Container - Animates Position & Scale */}
            {/* 
                Center: top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                Scale: 5x -> 1x
                Origin: Center (Default) - This ensures robust centering regardless of width changes.
                
                Destiation (Left Alignment):
                - Navbar uses: max-w-7xl mx-auto px-6.
                - Max Width = 80rem (1280px).
                - Gap on one side = (100vw - 80rem) / 2.
                - Padding = 1.5rem (24px).
                - Total Left = max(24px, (100vw - 1280px)/2 + 24px).
                - We use Tailwind calc for this using md/xl breakpoints to approximate.
                
                Breakpoints:
                - xl (1280px): Start using calculated left.
                - Before xl: just left-[24px]. (md:px-6 matches).
                
                Vertical:
                - Top 20px (matches manual alignment).
            */}
            <div
                className={`absolute flex items-center gap-3 transition-all duration-[1000ms] ease-[cubic-bezier(0.76,0,0.24,1)]
                    ${isCentered ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[3] md:scale-[5]' : ''}
                    ${isMoving ? 'scale-100 translate-0 top-[20px] left-[24px] xl:left-[calc((100vw-80rem)/2+24px)]' : ''}
                `}
            >
                {/* Logo Image */}
                <div className={`relative transition-all duration-500 ${phase === 'initial' ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                    <img
                        src="/chttrix-logo.jpg"
                        alt="Chttrix"
                        className="w-10 h-10 rounded-xl shadow-md object-cover"
                    />
                </div>

                {/* Text "Chttrix" */}
                <span
                    className={`font-exul font-black text-2xl tracking-tighter text-slate-900 dark:text-white leading-none whitespace-nowrap overflow-hidden transition-all duration-300
                        ${(phase === 'initial' || phase === 'center-icon') ? 'w-0 opacity-0' : 'w-auto opacity-100'}
                    `}
                >
                    {text}
                </span>
            </div>
        </div>
    );
};

export default LoadingScreen;
