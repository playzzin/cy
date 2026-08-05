
import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { componentService, ComponentConfig } from '../../services/componentService';
import { userMenuPositionService } from '../../services/userMenuPositionService';
import type { UserData } from '../../services/userService';
import { canAccessAllowedRoles, uniqueAccessRoles } from '../../utils/accessRoles';

interface ComponentGuardProps {
    id: string; // Component ID registered in Service
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

type ComponentGuardUserProfile = UserData & {
    systemRole?: unknown;
};

const ComponentGuard: React.FC<ComponentGuardProps> = ({ id, children, fallback = null }) => {
    const { currentUser } = useAuth();
    const [config, setConfig] = useState<ComponentConfig | undefined>(componentService.getConfig(id));
    const [userProfile, setUserProfile] = useState<ComponentGuardUserProfile | null>(null);
    const [additionalMenuPositions, setAdditionalMenuPositions] = useState<string[]>([]);
    const [linkedEntityRoles, setLinkedEntityRoles] = useState<string[]>([]);

    const userAccessRoles = useMemo(() => uniqueAccessRoles([
        linkedEntityRoles.length > 0 ? linkedEntityRoles : userProfile?.position,
        userProfile?.role,
        userProfile?.systemRole,
        userProfile?.accountType,
        userProfile?.additionalPositions,
        additionalMenuPositions,
        'user'
    ]), [additionalMenuPositions, linkedEntityRoles, userProfile]);

    useEffect(() => {
        const updateConfig = () => {
            setConfig(componentService.getConfig(id));
        };

        updateConfig();

        const unsubscribe = componentService.subscribe(() => {
            updateConfig();
        });

        return () => unsubscribe();
    }, [id]);

    useEffect(() => {
        let cancelled = false;
        let userUnsubscribe: (() => void) | undefined;
        let positionUnsubscribe: (() => void) | undefined;

        if (!currentUser?.uid) {
            setUserProfile(null);
            setAdditionalMenuPositions([]);
            setLinkedEntityRoles([]);
            return () => {
                cancelled = true;
            };
        }

        const uid = currentUser.uid;

        userUnsubscribe = onSnapshot(
            doc(db, 'users', uid),
            (docSnap) => {
                if (cancelled) return;
                setUserProfile(docSnap.exists() ? ({ ...(docSnap.data() as ComponentGuardUserProfile), uid }) : null);
            },
            (error) => {
                console.error('[ComponentGuard] Failed to subscribe user profile:', error);
                if (!cancelled) setUserProfile(null);
            }
        );

        positionUnsubscribe = userMenuPositionService.subscribe((map) => {
            if (!cancelled) setAdditionalMenuPositions(map[uid] || []);
        });

        void (async () => {
            try {
                const [{ manpowerService }, { officeStaffService }] = await Promise.all([
                    import('../../services/manpowerService'),
                    import('../../services/officeStaffService')
                ]);
                const [linkedWorker, linkedOfficeStaff] = await Promise.all([
                    manpowerService.getWorkerByUid(uid).catch(() => null),
                    officeStaffService.getOfficeStaffByUid(uid).catch(() => null)
                ]);

                if (!cancelled) {
                    setLinkedEntityRoles(uniqueAccessRoles([linkedWorker?.role, linkedOfficeStaff?.role]));
                }
            } catch (error) {
                console.error('[ComponentGuard] Failed to load linked entity roles:', error);
                if (!cancelled) setLinkedEntityRoles([]);
            }
        })();

        return () => {
            cancelled = true;
            userUnsubscribe?.();
            positionUnsubscribe?.();
        };
    }, [currentUser?.uid]);

    const isEnabled = config ? config.isEnabled : componentService.isEnabled(id);
    const isVisible = isEnabled && canAccessAllowedRoles(userAccessRoles, config?.allowedRoles);

    if (!isVisible) return <>{fallback}</>;

    return <>{children}</>;
};

export default ComponentGuard;
