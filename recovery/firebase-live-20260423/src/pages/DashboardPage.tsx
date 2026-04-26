import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { manpowerService } from '../services/manpowerService';
import { storage } from '../config/firebase';
import { ref, getDownloadURL, getMetadata } from 'firebase/storage';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardExecutiveView } from '../components/dashboard/DashboardExecutiveView';
import { DashboardFieldView } from '../components/dashboard/DashboardFieldView';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileSetup from '../components/auth/ProfileSetup';

type ViewMode = 'executive' | 'field';

const DashboardPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [linkedWorker, setLinkedWorker] = useState<any>(null);
    const [logoUrl, setLogoUrl] = useState<string>('');
    const [logoIsVideo, setLogoIsVideo] = useState<boolean>(false);
    const [viewMode, setViewMode] = useState<ViewMode>('executive');

    useEffect(() => {
        const initDashboard = async () => {
            if (!currentUser?.uid) {
                setLoading(false);
                return;
            }

            try {
                // 1. Load Logo Video/Image
                try {
                    const customLogoRef = ref(storage, 'settings/company_logo');
                    const customUrl = await getDownloadURL(customLogoRef);

                    try {
                        const metadata = await getMetadata(customLogoRef);
                        setLogoIsVideo(metadata.contentType?.startsWith('video/') || false);
                    } catch (metaError) {
                        setLogoIsVideo(customUrl.toLowerCase().includes('.mp4'));
                    }
                    setLogoUrl(customUrl);
                } catch (error) {
                    try {
                        const logoRef = ref(storage, 'logo_cy.mp4');
                        const url = await getDownloadURL(logoRef);
                        setLogoUrl(url);
                        setLogoIsVideo(true);
                    } catch (defaultError) {
                        console.log("Default logo not found.");
                        setLogoUrl('');
                    }
                }

                // 2. Fetch Linked Worker
                const worker = await manpowerService.getWorkerByUid(currentUser.uid);
                setLinkedWorker(worker);

                // 3. Set Default View based on Role (Optional Logic)
                if (worker) {
                    // For example, if role is 'field_manager', default to 'field'
                    // For now, default to 'executive' but maybe switch if user prefers?
                    // We can save preference in localStorage
                    const savedView = localStorage.getItem('dashboard_view_mode') as ViewMode;
                    if (savedView) {
                        setViewMode(savedView);
                    } else if (['소장', '반장'].includes(worker.role || '')) {
                        setViewMode('field');
                    }
                }

            } catch (error) {
                console.error("Dashboard initialization failed", error);
            } finally {
                setLoading(false);
            }
        };

        initDashboard();
    }, [currentUser]);

    const handleToggleView = () => {
        const newMode = viewMode === 'executive' ? 'field' : 'executive';
        setViewMode(newMode);
        localStorage.setItem('dashboard_view_mode', newMode);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-brand-600 mb-4" />
                    <p className="text-slate-500 font-medium">시스템 데이터를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    // Optional: Profile Setup Check
    // if (!linkedWorker) {
    //     return (
    //         <div className="p-8 bg-slate-50 min-h-screen">
    //             <ProfileSetup onComplete={() => window.location.reload()} />
    //         </div>
    //     );
    // }

    return (
        <div className="min-h-screen bg-slate-50 font-['Pretendard']">
            <DashboardHeader
                user={linkedWorker || { name: '관리자', role: '최고관리자' }}
                logoUrl={logoUrl}
                logoIsVideo={logoIsVideo}
                viewMode={viewMode}
                onToggleView={handleToggleView}
            />

            <main className="max-w-7xl mx-auto px-6 -mt-16 pb-12 relative z-10 w-full overflow-hidden">
                <AnimatePresence mode="wait">
                    {viewMode === 'executive' ? (
                        <motion.div
                            key="executive"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <DashboardExecutiveView />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="field"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <DashboardFieldView />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default DashboardPage;
