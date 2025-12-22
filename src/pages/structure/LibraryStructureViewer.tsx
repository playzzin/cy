import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLayerGroup, faInfoCircle, faChevronDown, faChevronRight, faCopy, faCheck, faTag } from '@fortawesome/free-solid-svg-icons';

// 2. 라이브러리 트리 데이터 정의 (상세 버전 포함)
const LIBRARY_TREE = {
    id: 'Libraries',
    name: 'External Libraries (외부 라이브러리)',
    type: 'root',
    description: '프로젝트에 사용된 모든 외부 라이브러리와 버전 정보입니다.',
    children: [
        {
            id: 'CoreLib',
            name: 'Core & Framework (핵심)',
            type: 'library',
            description: '애플리케이션의 기반이 되는 핵심 라이브러리입니다.',
            children: [
                { id: 'React', name: 'React', version: '18.2.0', type: 'library', description: 'UI 렌더링을 위한 핵심 라이브러리' },
                { id: 'ReactDOM', name: 'React DOM', version: '18.2.0', type: 'library', description: 'React를 웹 브라우저에 표시하기 위한 도구' },
                { id: 'TypeScript', name: 'TypeScript', version: '4.9.5', type: 'library', description: '정적 타입을 지원하는 JavaScript 상위 집합 언어' },
                { id: 'ReactRouter', name: 'React Router DOM', version: '6.22.3', type: 'library', description: 'SPA(Single Page Application) 라우팅 처리' }
            ]
        },
        {
            id: 'DataLib',
            name: 'Data & Backend (데이터/백엔드)',
            type: 'library',
            description: '데이터 저장, 인증, 상태 관리를 위한 라이브러리입니다.',
            children: [
                { id: 'Firebase', name: 'Firebase', version: '10.8.1', type: 'library', description: '구글의 BaaS 플랫폼 (Auth, Firestore, Storage 등)' },
                { id: 'FirebaseAuth', name: '@firebase/auth', version: '1.x', type: 'library', description: 'Firebase 인증 모듈' },
                { id: 'Firestore', name: '@firebase/firestore', version: '4.x', type: 'library', description: 'Firebase NoSQL 데이터베이스' }
            ]
        },
        {
            id: 'UILib',
            name: 'UI & Styling (디자인)',
            type: 'library',
            description: '화면 디자인과 UI 컴포넌트를 위한 라이브러리입니다.',
            children: [
                { id: 'TailwindCSS', name: 'TailwindCSS', version: '3.4.1', type: 'library', description: '유틸리티 퍼스트 CSS 프레임워크 (추가됨)' },
                { id: 'FontAwesome', name: 'FontAwesome', version: '6.5.1', type: 'library', description: '벡터 아이콘 라이브러리' },
                { id: 'StyledComponents', name: 'Styled Components', version: '6.1.8', type: 'library', description: 'CSS-in-JS 스타일링 도구' },
                { id: 'DndKit', name: 'Dnd Kit', version: '6.1.0', type: 'library', description: '모던하고 가벼운 드래그 앤 드롭 라이브러리' }
            ]
        },
        {
            id: 'UtilLib',
            name: 'Utilities (기능/도구)',
            type: 'library',
            description: '엑셀 처리, 인쇄 등 부가 기능을 위한 라이브러리입니다.',
            children: [
                { id: 'XLSX', name: 'SheetJS (XLSX)', version: '0.18.5', type: 'library', description: '엑셀 파일 읽기/쓰기' },
                { id: 'ExcelJS', name: 'ExcelJS', version: '4.4.0', type: 'library', description: '고급 엑셀 기능 (스타일링 등) 지원' },
                { id: 'FileSaver', name: 'File Saver', version: '2.0.5', type: 'library', description: '클라이언트 측 파일 저장 지원' },
                { id: 'ReactToPrint', name: 'ReactToPrint', version: '3.2.0', type: 'library', description: 'React 컴포넌트 인쇄 기능' },
                { id: 'JSZip', name: 'JSZip', version: '3.10.1', type: 'library', description: 'ZIP 파일 생성 및 압축 해제' }
            ]
        },
        {
            id: 'TestLib',
            name: 'Testing (테스트)',
            type: 'library',
            description: '코드 품질 보증을 위한 테스트 도구입니다.',
            children: [
                { id: 'Jest', name: 'Jest', version: '27.5.2', type: 'library', description: 'JavaScript 테스트 프레임워크' },
                { id: 'RTL', name: 'React Testing Library', version: '13.4.0', type: 'library', description: 'React 컴포넌트 테스트 유틸리티' }
            ]
        }
    ]
};

const LibraryStructureViewer: React.FC = () => {
    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
        'Libraries': true,
        'CoreLib': true,
        'DataLib': true,
        'UILib': true,
        'UtilLib': true
    });
    const [copied, setCopied] = useState(false);

    const toggleNode = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderTree = (node: any, level: number = 0) => {
        const isExpanded = expanded[node.id];
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.id} className="select-none">
                <div
                    className={`
                        flex items-center gap-3 p-3 mb-2 rounded-lg border transition-all duration-200
                        text-slate-600 bg-slate-50 border-slate-200
                        ${hasChildren ? 'cursor-pointer hover:shadow-md' : ''}
                        ${level > 0 ? 'ml-8' : ''}
                    `}
                    onClick={() => hasChildren && toggleNode(node.id)}
                    style={{ marginLeft: `${level * 24}px` }}
                >
                    <div className="w-6 flex justify-center text-slate-400">
                        {hasChildren && (
                            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-xs" />
                        )}
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm relative">
                        <FontAwesomeIcon icon={faLayerGroup} className="text-sm" />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{node.name}</span>

                            {/* 버전 뱃지 */}
                            {node.version && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-1">
                                    <FontAwesomeIcon icon={faTag} className="text-[8px]" />
                                    v{node.version}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">
                            {node.description}
                        </p>
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className="relative">
                        {/* 연결선 (옵션) */}
                        <div
                            className="absolute left-0 top-0 bottom-4 border-l-2 border-slate-200 border-dashed"
                            style={{ left: `${(level * 24) + 27}px` }}
                        />
                        {node.children.map((child: any) => renderTree(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    // 프롬프트 생성 함수
    const generatePromptText = () => {
        const generateNodeText = (node: any, level: number = 0): string => {
            const indent = '  '.repeat(level);
            let text = `${indent}- ${node.name} (${node.type || 'item'})`;
            if (node.version) text += ` [v${node.version}]`;
            if (node.description) text += `: ${node.description}`;
            text += '\n';

            if (node.children && node.children.length > 0) {
                node.children.forEach((child: any) => {
                    text += generateNodeText(child, level + 1);
                });
            }
            return text;
        };

        let prompt = "## External Libraries\n\n";
        prompt += generateNodeText(LIBRARY_TREE);

        return prompt;
    };

    const handleCopyPrompt = () => {
        const text = generatePromptText();
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="p-6 max-w-[1200px] mx-auto">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                        <FontAwesomeIcon icon={faLayerGroup} className="text-brand-600" />
                        라이브러리 구조도
                    </h1>
                    <p className="text-slate-600 flex items-center gap-2">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        프로젝트에 사용된 외부 라이브러리와 버전 정보를 확인합니다.
                    </p>
                </div>
                <button
                    onClick={handleCopyPrompt}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-sm
                        ${copied
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-slate-800 text-white hover:bg-slate-900'}
                    `}
                >
                    <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                    {copied ? '복사 완료!' : 'AI 프롬프트 복사'}
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="space-y-1">
                    {renderTree(LIBRARY_TREE)}
                </div>
            </div>
        </div>
    );
};

export default LibraryStructureViewer;
