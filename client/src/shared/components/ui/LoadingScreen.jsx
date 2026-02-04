import React, { useState, useEffect } from 'react';

const LoadingScreen = ({ onComplete }) => {
    const [text, setText] = useState('');
    const fullText = 'Chttrix';
    const [isTyping, setIsTyping] = useState(false);
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        // Sequence:
        // 1. Initial delay (cursor blinks)
        // 2. Typing starts
        // 3. Typing ends
        // 4. Hold
        // 5. Fade out
        // 6. onComplete

        const runSequence = async () => {
            // 1. Initial Delay (500ms)
            await new Promise(r => setTimeout(r, 500));
            setIsTyping(true);

            // 2. Typing Loop
            for (let i = 0; i <= fullText.length; i++) {
                setText(fullText.slice(0, i));
                // Random typing speed for "human" feel (50ms - 150ms)
                await new Promise(r => setTimeout(r, Math.random() * 100 + 50));
            }

            setIsTyping(false);

            // 3. Hold (1.5s as requested)
            await new Promise(r => setTimeout(r, 1500));

            // 4. Fade Out
            setOpacity(0);

            // 5. Wait for transition (700ms matches duration-700)
            await new Promise(r => setTimeout(r, 700));

            // 6. Complete
            if (onComplete) onComplete();
        };

        runSequence();

        return () => { }; // Cleanup not strictly necessary for this linear sequence but good practice
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once - onComplete is stable and called at the end

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-[#030712] transition-opacity duration-700 ease-in-out"
            style={{ opacity: opacity }}
        >
            <div className="flex items-end select-none">
                <span className="text-5xl md:text-7xl font-sans font-black text-gray-900 dark:text-white tracking-tighter leading-none">
                    {text}
                </span>
                <span
                    className={`ml-1 md:ml-3 w-[8px] md:w-[12px] h-10 md:h-16 bg-indigo-600 dark:bg-indigo-400 align-baseline ${isTyping ? 'opacity-100' : 'animate-[blink_1s_infinite]'}`}
                ></span>
            </div>
        </div>
    );
};

export default LoadingScreen;
