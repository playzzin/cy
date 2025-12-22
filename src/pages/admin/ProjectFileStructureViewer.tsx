import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBook,
    faBoxArchive,
    faCheck,
    faChevronDown,
    faChevronRight,
    faCopy,
    faCube,
    faDatabase,
    faFileCode,
    faFolder,
    faProjectDiagram,
    faRobot,
    faSearch,
    faSitemap
} from '@fortawesome/free-solid-svg-icons';
import { BUILD_STRUCTURE_DATA, BuildNode as BuildStructureNode } from '../../data/buildStructure';
import FileStructureViewer from '../structure/FileStructureViewer';
import FirestoreStructureViewer from '../database/FirestoreStructureViewer';
import LibraryStructureViewer from '../structure/LibraryStructureViewer';
import MenuManagementDesignViewer from '../structure/MenuManagementDesignViewer';

type TopTab = 'file' | 'menu' | 'db' | 'library' | 'build' | 'userBuild' | 'logic' | 'ai';

const ProjectFileStructureViewer: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TopTab>('file');
    const [userBuildSearchTerm, setUserBuildSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [expandedUserBuildNodes, setExpandedUserBuildNodes] = useState<Set<string>>(
        new Set([BUILD_STRUCTURE_DATA.id, 'libraries-core', 'build-root'])
    );

    const normalizedUserBuildSearch = useMemo(
        () => userBuildSearchTerm.trim().toLowerCase(),
        [userBuildSearchTerm]
    );
    const isUserBuildSearching = normalizedUserBuildSearch.length > 0;

    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            window.setTimeout(() => setCopiedId(null), 1500);
        } catch {
            setCopiedId(null);
        }
    };

    const toggleUserBuildNode = (id: string) => {
        setExpandedUserBuildNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const userBuildRoot = useMemo<BuildStructureNode>(() => BUILD_STRUCTURE_DATA, []);

    const filteredUserBuildRoot = useMemo<BuildStructureNode>(() => {
        if (!isUserBuildSearching) return userBuildRoot;

        const filterNode = (node: BuildStructureNode): BuildStructureNode | null => {
            const matches =
                node.name.toLowerCase().includes(normalizedUserBuildSearch) ||
                node.path.toLowerCase().includes(normalizedUserBuildSearch) ||
                (node.description ? node.description.toLowerCase().includes(normalizedUserBuildSearch) : false);

            const filteredChildren = node.children
                ? node.children
                    .map(filterNode)
                    .filter((child): child is BuildStructureNode => child !== null)
                : undefined;

            if (!matches && (!filteredChildren || filteredChildren.length === 0)) return null;

            return {
                ...node,
                children: filteredChildren
            };
        };

        const filtered = filterNode(userBuildRoot);
        return filtered ?? userBuildRoot;
    }, [userBuildRoot, isUserBuildSearching, normalizedUserBuildSearch]);

    const generateUserBuildPrompt = (node: BuildStructureNode) => {
        return `[Build Structure Context]\nName: ${node.name}\nPath: ${node.path}\nType: ${node.type}\nSize: ${node.size ?? 'N/A'}\nDescription: ${node.description ?? 'N/A'}`;
    };

    const renderUserBuildNode = (node: BuildStructureNode, depth: number = 0) => {
        const hasChildren = !!node.children && node.children.length > 0;
        const isExpanded = isUserBuildSearching ? true : expandedUserBuildNodes.has(node.id);

        return (
            <div key={node.id} className="select-none">
                <div
                    className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors
                        ${isExpanded && node.type === 'folder' ? 'bg-slate-100' : 'hover:bg-slate-50'}
                        ${depth === 0 && node.type === 'folder' ? 'bg-slate-50 mb-2 mt-2' : ''}
                    `}
                    style={{ marginLeft: `${depth * 20}px` }}
                    onClick={() => {
                        if (!hasChildren) return;
                        if (isUserBuildSearching) return;
                        toggleUserBuildNode(node.id);
                    }}
                >
                    <div className="w-6 flex justify-center text-slate-400">
                        {hasChildren && (
                            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} size="xs" />
                        )}
                    </div>

                    <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3
                            ${node.type === 'folder' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-500'}
                        `}
                    >
                        <FontAwesomeIcon icon={node.type === 'folder' ? faFolder : faFileCode} size="sm" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700 truncate">{node.name}</span>
                            {node.size && (
                                <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded">{node.size}</span>
                            )}
                        </div>
                        {node.description && <p className="text-xs text-slate-400 truncate">{node.description}</p>}
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleCopy(generateUserBuildPrompt(node), node.id);
                        }}
                        className="p-2 text-slate-400 hover:text-teal-600 transition-colors relative group"
                        title="AI 프롬프트 복사"
                    >
                        <FontAwesomeIcon icon={copiedId === node.id ? faCheck : faCopy} />
                    </button>
                </div>

                {hasChildren && isExpanded && (
                    <div>
                        {node.children?.map(child => renderUserBuildNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                            <FontAwesomeIcon icon={faSitemap} size="lg" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">통합 프로젝트 구조도</h1>
                            <p className="text-slate-500">전체 파일/메뉴/DB/빌드 구조를 한눈에 확인하세요.</p>
                        </div>
                    </div>
                    {activeTab === 'userBuild' && (
                        <div className="relative w-64">
                            <input
                                type="text"
                                placeholder="검색어 입력..."
                                value={userBuildSearchTerm}
                                onChange={(e) => setUserBuildSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-slate-200 mb-4 flex-wrap">
                    <button
                        onClick={() => setActiveTab('file')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'file'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faFolder} />
                        파일 구조
                    </button>
                    <button
                        onClick={() => setActiveTab('menu')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'menu'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faSitemap} />
                        메뉴 구조
                    </button>
                    <button
                        onClick={() => setActiveTab('db')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'db'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faDatabase} />
                        DB 구조
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'library'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faBook} />
                        라이브러리
                    </button>
                    <button
                        onClick={() => setActiveTab('build')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'build'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faCube} />
                        라이브러리 구조도
                    </button>
                    <button
                        onClick={() => setActiveTab('userBuild')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'userBuild'
                            ? 'border-teal-500 text-teal-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faBoxArchive} />
                        빌드 구조도
                    </button>
                    <button
                        onClick={() => setActiveTab('logic')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'logic'
                            ? 'border-yellow-500 text-yellow-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faProjectDiagram} />
                        로직 기록
                    </button>
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ai'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FontAwesomeIcon icon={faRobot} />
                        AI 구조도
                    </button>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {activeTab === 'userBuild' && (
                        <>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div>폴더</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>파일</div>
                            <div className="flex items-center gap-1"><span className="bg-slate-200 text-slate-600 px-1 rounded text-[8px]">Size</span>크기/버전</div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
                    {activeTab === 'file' && <FileStructureViewer />}
                    {activeTab === 'menu' && <MenuManagementDesignViewer />}
                    {activeTab === 'db' && <FirestoreStructureViewer />}
                    {activeTab === 'library' && <LibraryStructureViewer />}
                    {activeTab === 'build' && <LibraryStructureViewer />}
                    {activeTab === 'userBuild' && (
                        <div className="space-y-1">
                            {renderUserBuildNode(filteredUserBuildRoot)}
                        </div>
                    )}
                    {activeTab === 'logic' && (
                        <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">
                            로직 기록 탭은 정리 중입니다.
                        </div>
                    )}
                    {activeTab === 'ai' && (
                        <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">
                            AI 구조도 탭은 정리 중입니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectFileStructureViewer;
