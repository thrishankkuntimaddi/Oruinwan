import { useState, useCallback } from 'react';

export const useResizablePanel = (initialWidth, minWidth, maxWidth) => {
    const [width, setWidth] = useState(initialWidth);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isResizing) return;

        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setWidth(newWidth);
        }
    }, [isResizing, minWidth, maxWidth]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    return {
        width,
        isResizing,
        startResizing,
        handleMouseMove,
        handleMouseUp
    };
};

export const useLeftPanelResize = (initialWidth, minWidth, maxWidth) => {
    const [width, setWidth] = useState(initialWidth);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isResizing) return;

        const newWidth = e.clientX;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setWidth(newWidth);
        }
    }, [isResizing, minWidth, maxWidth]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    return {
        width,
        isResizing,
        startResizing,
        handleMouseMove,
        handleMouseUp
    };
};
