import React, { useEffect, useRef, useState } from 'react';
import './BusinessConstructionFilm.css';

type Props = {
    paused: boolean;
    reducedMotion: boolean;
    fallback: React.ReactElement;
};

const BusinessConstructionFilm: React.FC<Props> = ({ paused, reducedMotion, fallback }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (reducedMotion) setReady(false);
    }, [reducedMotion]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !ready || failed || reducedMotion) return;
        let current = true;
        if (paused) video.pause();
        else video.play()?.catch(error => {
            // A pause/unmount can interrupt an otherwise successful play request.
            if (current && error?.name !== 'AbortError') setFailed(true);
        });
        return () => { current = false; video.pause(); };
    }, [paused, reducedMotion, ready, failed]);

    if (reducedMotion || failed) return fallback;

    return <div
        className="cy-construction-film cy-cinematic-scene"
        data-ready={ready}
        role={ready ? 'img' : undefined}
        aria-label={ready ? '시스템 동바리비계 시공 · 프레임 조립 모션 그래픽' : undefined}
    >
        <div className="cy-construction-film-fallback" aria-hidden={ready || undefined}>{fallback}</div>
        <video
            ref={videoRef}
            data-testid="construction-film-video"
            className="cy-construction-film-video"
            src={`${process.env.PUBLIC_URL || ''}/media/business-motion/construction-assembly-higgsfield.mp4`}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            disablePictureInPicture
            onLoadedData={() => setReady(true)}
            onError={() => setFailed(true)}
        />
    </div>;
};

export default BusinessConstructionFilm;
