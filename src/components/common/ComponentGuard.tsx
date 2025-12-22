
import React, { useEffect, useState } from 'react';
import { componentService, ComponentConfig } from '../../services/componentService';

interface ComponentGuardProps {
    id: string; // Component ID registered in Service
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

const ComponentGuard: React.FC<ComponentGuardProps> = ({ id, children, fallback = null }) => {
    const [config, setConfig] = useState<ComponentConfig | undefined>(componentService.getConfig(id));
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Initial Check
        updateVisibility();

        const unsubscribe = componentService.subscribe(() => {
            setConfig(componentService.getConfig(id));
            updateVisibility();
        });

        return () => unsubscribe();
    }, [id]);

    const updateVisibility = () => {
        // If config requires roles, check them (TODO: Import user role)
        // For now, simple Enabled toggle
        const isEnabled = componentService.isEnabled(id);
        setIsVisible(isEnabled);
    };

    if (!isVisible) return <>{fallback}</>;

    return <>{children}</>;
};

export default ComponentGuard;
