import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faMagic, faSave, faUndo, faTimes, faDice, faEraser, faStar, faFeather, faPaintBrush } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { signatureService } from '../../services/signatureService';

interface SignatureGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    workerId: string;
    workerName: string;
    onSaveComplete: (newUrl: string) => void;
}

type TabMode = 'manual' | 'auto';
type AutoStyle = 'celebrity' | 'korean_handwriting' | 'korean_calligraphy' | 'abstract_artistic' | 'initials_fancy';

// 한글 자모 분리 함수
const getKoreanJamo = (char: string): { cho: string; jung: string; jong: string } | null => {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return null;

    const cho = Math.floor(code / 588);
    const jung = Math.floor((code % 588) / 28);
    const jong = code % 28;

    const choList = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const jungList = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
    const jongList = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

    return {
        cho: choList[cho],
        jung: jungList[jung],
        jong: jongList[jong]
    };
};

// 성씨 로마자 변환
const KOREAN_SURNAME_MAP: { [key: string]: string } = {
    '김': 'Kim', '이': 'Lee', '박': 'Park', '최': 'Choi', '정': 'Jung',
    '강': 'Kang', '조': 'Cho', '윤': 'Yoon', '장': 'Jang', '임': 'Lim',
    '한': 'Han', '오': 'Oh', '서': 'Seo', '신': 'Shin', '권': 'Kwon',
    '황': 'Hwang', '안': 'Ahn', '송': 'Song', '류': 'Ryu', '전': 'Jeon',
    '홍': 'Hong', '고': 'Ko', '문': 'Moon', '양': 'Yang', '손': 'Son',
    '배': 'Bae', '백': 'Baek', '허': 'Heo', '유': 'Yoo', '남': 'Nam',
    '심': 'Shim', '노': 'Noh', '하': 'Ha', '곽': 'Kwak', '성': 'Sung',
    '차': 'Cha', '주': 'Joo', '우': 'Woo', '구': 'Koo', '민': 'Min'
};

const SignatureGeneratorModal: React.FC<SignatureGeneratorModalProps> = ({
    isOpen,
    onClose,
    workerId,
    workerName,
    onSaveComplete
}) => {
    const [activeTab, setActiveTab] = useState<TabMode>('auto');
    const [saving, setSaving] = useState(false);

    // Manual Canvas Refs
    const sigCanvas = useRef<SignatureCanvas>(null);

    // Auto Gen State
    const [autoStyle, setAutoStyle] = useState<AutoStyle>('celebrity');
    const autoCanvasRef = useRef<HTMLCanvasElement>(null);
    const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null);

    // Manual Canvas Sizing
    const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
    const manualContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab === 'manual') {
            // Small delay to allow layout to stabilize
            const timer = setTimeout(() => {
                if (manualContainerRef.current) {
                    setCanvasSize({
                        width: manualContainerRef.current.offsetWidth,
                        height: manualContainerRef.current.offsetHeight
                    });
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [activeTab]);

    useEffect(() => {
        if (isOpen && activeTab === 'auto') {
            // 폰트 로드 대기 후 생성
            setTimeout(() => generateSignature(), 100);
        }
    }, [isOpen, activeTab, autoStyle]);

    if (!isOpen) return null;

    // === 연예인 스타일 서명 (Celebrity Style) ===
    const drawCelebrityStyle = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const firstName = workerName.charAt(0);
        const jamo = getKoreanJamo(firstName);

        const centerX = w / 2;
        const centerY = h / 2;

        // 시작점 - 왼쪽에서 시작
        const startX = w * 0.15;
        const startY = centerY + 10;

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        // 첫 글자 초성을 화려하게 표현
        if (jamo) {
            // 큰 원형 루프로 시작 (연예인 사인 특징)
            ctx.bezierCurveTo(
                startX + 30, startY - 60,
                startX + 80, startY - 70,
                startX + 100, startY - 20
            );

            // 작은 루프들
            for (let i = 0; i < 2; i++) {
                const loopX = startX + 100 + i * 50;
                ctx.bezierCurveTo(
                    loopX + 20, startY - 40 - Math.random() * 20,
                    loopX + 40, startY + 20 + Math.random() * 15,
                    loopX + 60, startY - 10
                );
            }
        }

        // 중간 연결부 - 물결치듯
        const midX = centerX + 20;
        ctx.bezierCurveTo(
            midX - 30, startY + 30,
            midX + 30, startY - 40,
            midX + 60, startY
        );

        // 마무리 - 화려한 꼬리
        ctx.bezierCurveTo(
            w * 0.75, startY - 50,
            w * 0.85, startY + 40,
            w * 0.9, startY - 30
        );

        // 마지막 위로 치솟는 획
        ctx.bezierCurveTo(
            w * 0.92, startY - 60,
            w * 0.88, startY - 80,
            w * 0.95, startY - 50
        );

        ctx.stroke();

        // 장식용 점 추가
        ctx.beginPath();
        ctx.arc(w * 0.3, startY - 30, 3, 0, Math.PI * 2);
        ctx.fill();
    };

    // === 한글 필기체 (손글씨) ===
    const drawKoreanHandwriting = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const text = workerName;

        // 손글씨 느낌 설정
        ctx.fillStyle = '#2d3436';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        // 각 글자마다 약간씩 다른 스타일 적용
        const charWidth = w / (text.length + 1);
        let currentX = charWidth;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // 랜덤 크기와 회전
            const fontSize = 45 + Math.random() * 15;
            const rotation = (Math.random() - 0.5) * 0.15;
            const yOffset = (Math.random() - 0.5) * 15;

            // 폰트 랜덤 선택 (손글씨 느낌)
            const fonts = ['Nanum Pen Script', 'Hi Melody', 'Gowun Dodum'];
            const font = fonts[Math.floor(Math.random() * fonts.length)];

            ctx.save();
            ctx.font = `${fontSize}px "${font}"`;
            ctx.translate(currentX, h / 2 + yOffset);
            ctx.rotate(rotation);

            // 여러 번 겹쳐 그려서 잉크 번짐 효과
            for (let j = 0; j < 2; j++) {
                ctx.globalAlpha = 0.6 + Math.random() * 0.3;
                const jitterX = (Math.random() - 0.5) * 2;
                const jitterY = (Math.random() - 0.5) * 2;
                ctx.fillText(char, jitterX, jitterY);
            }

            ctx.restore();
            currentX += charWidth * (0.9 + Math.random() * 0.2);
        }

        // 밑줄 또는 장식선
        if (Math.random() > 0.4) {
            ctx.beginPath();
            ctx.strokeStyle = '#2d3436';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.5;
            const lineY = h / 2 + 35;
            ctx.moveTo(w * 0.15, lineY);
            ctx.bezierCurveTo(
                w * 0.4, lineY + 10,
                w * 0.6, lineY - 5,
                w * 0.85, lineY + 5
            );
            ctx.stroke();
        }
    };

    // === 한글 서예/붓글씨 스타일 ===
    const drawKoreanCalligraphy = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const text = workerName;

        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        // 붓글씨 효과를 위한 그라데이션
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.5, '#333333');
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;

        // 굵은 폰트로 한 글자씩
        const fonts = ['Gowun Dodum', 'Nanum Gothic'];
        const font = fonts[Math.floor(Math.random() * fonts.length)];

        const baseFontSize = text.length <= 2 ? 80 : text.length <= 3 ? 65 : 55;

        // 첫 글자는 더 크게
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const fontSize = i === 0 ? baseFontSize * 1.2 : baseFontSize;
            const xPos = w * (0.2 + (i * 0.25));
            const yPos = h / 2 + (i === 0 ? -5 : 5);

            ctx.save();
            ctx.font = `bold ${fontSize}px "${font}"`;
            ctx.translate(xPos, yPos);

            // 붓터치 효과 - 시작 굵고 끝이 가는 느낌
            for (let pass = 0; pass < 3; pass++) {
                ctx.globalAlpha = 0.4 + pass * 0.2;
                const scale = 1 - pass * 0.02;
                ctx.scale(scale, scale);
                ctx.fillText(char, 0, 0);
            }

            ctx.restore();
        }

        // 낙관(도장) 느낌의 작은 마크
        ctx.beginPath();
        ctx.strokeStyle = '#8b0000';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        const stampX = w * 0.88;
        const stampY = h * 0.75;
        const stampSize = 18;
        ctx.rect(stampX - stampSize / 2, stampY - stampSize / 2, stampSize, stampSize);
        ctx.stroke();

        // 낙관 안에 첫 글자 초성
        const jamo = getKoreanJamo(text[0]);
        if (jamo) {
            ctx.fillStyle = '#8b0000';
            ctx.font = `bold 12px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(jamo.cho, stampX, stampY);
        }
    };

    // === 추상 예술적 스타일 ===
    const drawAbstractArtistic = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const firstName = workerName.charAt(0);
        const jamo = getKoreanJamo(firstName);

        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        const centerX = w / 2;
        const centerY = h / 2;

        // 이름의 자모를 기반으로 추상적 패턴 생성
        const seed = workerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const pseudoRandom = (n: number) => ((seed * (n + 1) * 9301 + 49297) % 233280) / 233280;

        // 주요 곡선 - 이름에 따라 다른 패턴
        ctx.beginPath();
        const startX = w * 0.1;
        const startY = centerY + (pseudoRandom(1) - 0.5) * 40;
        ctx.moveTo(startX, startY);

        // 베지어 곡선으로 복잡한 패턴
        const curves = 4 + Math.floor(pseudoRandom(2) * 3);
        let curX = startX;

        for (let i = 0; i < curves; i++) {
            const nextX = curX + (w * 0.8) / curves;
            const amplitude = 30 + pseudoRandom(i + 3) * 50;
            const direction = i % 2 === 0 ? -1 : 1;

            ctx.bezierCurveTo(
                curX + 30, centerY + direction * amplitude,
                nextX - 30, centerY - direction * amplitude * 0.7,
                nextX, centerY + (pseudoRandom(i + 4) - 0.5) * 30
            );

            curX = nextX;
        }

        ctx.stroke();

        // 장식적 요소들
        if (jamo) {
            // 루프와 소용돌이
            ctx.beginPath();
            ctx.lineWidth = 1.5;
            const loopX = w * 0.3;
            const loopY = centerY - 20;

            for (let angle = 0; angle < Math.PI * 3; angle += 0.1) {
                const radius = 10 + angle * 3;
                const x = loopX + Math.cos(angle) * radius * 0.5;
                const y = loopY + Math.sin(angle) * radius * 0.3;

                if (angle === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // 마무리 점
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.arc(
                w * (0.4 + pseudoRandom(i + 10) * 0.4),
                centerY + (pseudoRandom(i + 11) - 0.5) * 50,
                2 + pseudoRandom(i + 12) * 2,
                0, Math.PI * 2
            );
            ctx.fill();
        }
    };

    // === 이니셜 팬시 스타일 ===
    const drawInitialsFancy = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const firstName = workerName.charAt(0);
        const surname = KOREAN_SURNAME_MAP[firstName] || firstName;
        const initial = surname.charAt(0).toUpperCase();

        ctx.fillStyle = '#1a1a2e';
        ctx.strokeStyle = '#1a1a2e';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        const centerX = w / 2;
        const centerY = h / 2;

        // 큰 이니셜
        ctx.font = `bold italic 90px "Times New Roman", serif`;
        ctx.globalAlpha = 0.9;
        ctx.fillText(initial, centerX - 20, centerY);

        // 장식적인 곡선
        ctx.beginPath();
        ctx.lineWidth = 2.5;

        // 이니셜 주변을 감싸는 곡선
        ctx.moveTo(centerX - 70, centerY - 40);
        ctx.bezierCurveTo(
            centerX - 80, centerY - 70,
            centerX + 60, centerY - 80,
            centerX + 80, centerY - 30
        );
        ctx.bezierCurveTo(
            centerX + 100, centerY + 20,
            centerX + 120, centerY + 50,
            centerX + 60, centerY + 60
        );
        ctx.stroke();

        // 밑에 작은 이름 추가
        ctx.font = `italic 18px "Times New Roman", serif`;
        ctx.globalAlpha = 0.6;
        ctx.fillText(surname, centerX + 20, centerY + 45);

        // 화려한 밑줄
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.moveTo(centerX - 50, centerY + 55);
        ctx.bezierCurveTo(
            centerX, centerY + 65,
            centerX + 50, centerY + 55,
            centerX + 90, centerY + 60
        );
        ctx.stroke();
    };

    // === 메인 생성 함수 ===
    const generateSignature = () => {
        const canvas = autoCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;

        const width = canvas.width;
        const height = canvas.height;

        switch (autoStyle) {
            case 'celebrity':
                drawCelebrityStyle(ctx, width, height);
                break;
            case 'korean_handwriting':
                drawKoreanHandwriting(ctx, width, height);
                break;
            case 'korean_calligraphy':
                drawKoreanCalligraphy(ctx, width, height);
                break;
            case 'abstract_artistic':
                drawAbstractArtistic(ctx, width, height);
                break;
            case 'initials_fancy':
                drawInitialsFancy(ctx, width, height);
                break;
        }

        setGeneratedPreviewUrl(canvas.toDataURL('image/png'));
    };



    // === Manual Trim Helper (Safe Replacement for getTrimmedCanvas) ===
    const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        const w = canvas.width;
        const h = canvas.height;
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        let top = -1, bottom = -1, left = -1, right = -1;

        // Scan for pixels
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const alpha = data[(y * w + x) * 4 + 3];
                if (alpha > 0) {
                    if (top === -1) top = y;
                    bottom = y;
                    if (left === -1 || x < left) left = x;
                    if (right === -1 || x > right) right = x;
                }
            }
        }

        if (top === -1) return canvas; // Empty

        // Add some padding
        const padding = 10;
        const trimX = Math.max(0, left - padding);
        const trimY = Math.max(0, top - padding);
        const trimW = Math.min(w - trimX, (right - left) + padding * 2);
        const trimH = Math.min(h - trimY, (bottom - top) + padding * 2);

        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = trimW;
        trimmedCanvas.height = trimH;

        const trimmedCtx = trimmedCanvas.getContext('2d');
        if (trimmedCtx) {
            trimmedCtx.drawImage(canvas, trimX, trimY, trimW, trimH, 0, 0, trimW, trimH);
            return trimmedCanvas;
        }

        return canvas;
    };

    // === 저장 ===
    const handleSave = async () => {
        let finalDataUrl = '';

        if (activeTab === 'manual') {
            if (sigCanvas.current?.isEmpty()) {
                Swal.fire('알림', '서명을 그려주세요.', 'warning');
                return;
            }
            const rawCanvas = sigCanvas.current!.getCanvas();
            const trimmed = trimCanvas(rawCanvas);
            finalDataUrl = trimmed.toDataURL('image/png');
        } else {
            if (!generatedPreviewUrl) return;
            finalDataUrl = generatedPreviewUrl;
        }

        setSaving(true);
        try {
            const url = await signatureService.saveSignature(workerId, finalDataUrl);
            onSaveComplete(url);
            onClose();
            Swal.fire({
                icon: 'success',
                title: '서명 저장 완료',
                text: '성공적으로 저장되었습니다.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('오류', '저장에 실패했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const styleOptions: { key: AutoStyle; label: string; icon: typeof faStar }[] = [
        { key: 'celebrity', label: '연예인 사인', icon: faStar },
        { key: 'korean_handwriting', label: '손글씨체', icon: faPen },
        { key: 'korean_calligraphy', label: '붓글씨', icon: faPaintBrush },
        { key: 'abstract_artistic', label: '추상 아트', icon: faFeather },
        { key: 'initials_fancy', label: '이니셜', icon: faMagic },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <FontAwesomeIcon icon={faPen} />
                        서명 생성 - {workerName}
                    </h3>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('auto')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2
                            ${activeTab === 'auto' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <FontAwesomeIcon icon={faMagic} />
                        자동 생성
                    </button>
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2
                            ${activeTab === 'manual' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <FontAwesomeIcon icon={faPen} />
                        직접 그리기
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'auto' ? (
                        <div className="space-y-4">
                            {/* Style Selector */}
                            <div className="flex flex-wrap justify-center gap-2 mb-4">
                                {styleOptions.map((option) => (
                                    <button
                                        key={option.key}
                                        onClick={() => setAutoStyle(option.key)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5
                                            ${autoStyle === option.key
                                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-indigo-500 shadow-lg shadow-indigo-200'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}
                                    >
                                        <FontAwesomeIcon icon={option.icon} className="text-[10px]" />
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {/* Preview Canvas */}
                            <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-gradient-to-br from-slate-50 to-white flex items-center justify-center h-48 overflow-hidden group shadow-inner">
                                <canvas
                                    ref={autoCanvasRef}
                                    width={400}
                                    height={180}
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                                    <span className="text-xs text-white font-medium">클릭하여 다시 생성</span>
                                </div>
                            </div>

                            {/* Regenerate Button */}
                            <button
                                onClick={generateSignature}
                                className="w-full py-3 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 font-bold rounded-xl hover:from-slate-200 hover:to-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <FontAwesomeIcon icon={faDice} className="text-indigo-500" />
                                다른 스타일로 다시 생성
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div
                                ref={manualContainerRef}
                                className="border-2 border-slate-300 rounded-xl bg-slate-50 h-48 overflow-hidden relative"
                            >
                                {canvasSize && (
                                    <SignatureCanvas
                                        ref={sigCanvas}
                                        canvasProps={{
                                            className: 'w-full h-full',
                                            style: { width: '100%', height: '100%' },
                                            width: canvasSize.width,
                                            height: canvasSize.height
                                        }}
                                        velocityFilterWeight={0.7}
                                        minWidth={1.0}
                                        maxWidth={3.0}
                                        clearOnResize={false}
                                    />
                                )}
                                <div className="absolute top-2 right-2 text-xs text-slate-300 pointer-events-none select-none">
                                    여기에 서명하세요
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => sigCanvas.current?.clear()}
                                    className="flex-1 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
                                >
                                    <FontAwesomeIcon icon={faEraser} className="mr-1" />
                                    지우기
                                </button>
                                <button
                                    onClick={() => {
                                        const data = sigCanvas.current?.toData();
                                        if (data && data.length > 0) {
                                            sigCanvas.current?.fromData(data.slice(0, -1));
                                        }
                                    }}
                                    className="flex-1 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
                                >
                                    <FontAwesomeIcon icon={faUndo} className="mr-1" />
                                    실행취소
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {saving ? '저장 중...' : '서명 저장하기'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignatureGeneratorModal;
