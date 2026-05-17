import { useState, useEffect } from 'react';

/**
 * Animates a number from 0 to the target value over a specified duration.
 * @param target The target number to animate to.
 * @param duration The duration of the animation in milliseconds. Default: 1000ms.
 */
export const useCountAnimation = (target: number, duration: number = 1000, precision: number = 0) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTimestamp: number | null = null;
        let animationFrameId: number;

        const startValue = count; // Start from current count to handle changes smoothly
        const diff = target - startValue;

        if (diff === 0) return;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            // Ease-out expo function for smoother landing
            // 1 - Math.pow(2, -10 * progress)

            const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            setCount(startValue + (diff * easedProgress));

            if (progress < 1) {
                animationFrameId = window.requestAnimationFrame(step);
            }
        };

        animationFrameId = window.requestAnimationFrame(step);

        return () => window.cancelAnimationFrame(animationFrameId);
    }, [target, duration]);

    const factor = Math.pow(10, precision);
    return Math.round(count * factor) / factor;
};
