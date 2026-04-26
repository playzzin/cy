import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFolderOpen, faFileCode, faInfoCircle, faChevronDown, faChevronRight, faSitemap, faSync } from '@fortawesome/free-solid-svg-icons';
import projectStructure from '../../data/projectStructure.json';

const FileStructureViewer: React.FC = () => {
    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
        'src': true,
        'components': true,
        'pages': true,
        'layout': true,
        'structure': true
    });

    const toggleNode = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getIcon = (type: string, isExpanded: boolean) => {
        if (type === 'folder') {
            return isExpanded ? faFolderOpen : faFolder;
        }
        return faFileCode;
    };

    const getColor = (type: string) => {
        if (type === 'folder') return 'text-yellow-500';
        return 'text-blue-500';
    };

    const renderTree = (node: any, level: number = 0) => {
        const isExpanded = expanded[node.id];
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.id} className="select-none">
                <div
                    className={`
                        flex items-center gap-3 p-2 mb-1 rounded hover:bg-slate-50 transition-colors
                        ${level > 0 ? 'ml-6' : ''}
                    `}
                    onClick={() => hasChildren && toggleNode(node.id)}
                    style={{ marginLeft: `${level * 24}px` }}
                >
                    <div className="w-5 flex justify-center text-slate-400 cursor-pointer">
                        {hasChildren && (
                            <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-xs" />
                        )}
                    </div>

                    <div className={`w-6 flex justify-center ${getColor(node.type)}`}>
                        <FontAwesomeIcon icon={getIcon(node.type, isExpanded)} />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{node.name}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{node.description}</p>
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <div className="relative border-l border-slate-200 ml-3">
                        {/* 재귀 렌더링 */}
                        {node.children.map((child: any) => renderTree(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 max-w-[1000px] mx-auto">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                        <FontAwesomeIcon icon={faSitemap} className="text-yellow-600" />
                        파일 구조도 (탐색기)
                    </h1>
                    <p className="text-slate-600 flex items-center gap-2">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        실제 프로젝트 폴더 구조를 보여줍니다.
                    </p>
                </div>

                <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3 border border-blue-100">
                    <FontAwesomeIcon icon={faSync} className="mt-1" />
                    <div>
                        <p className="font-bold mb-1">구조도 업데이트 방법</p>
                        <p>터미널에서 아래 명령어를 실행하면 최신 구조가 반영됩니다:</p>
                        <code className="block bg-white px-2 py-1 mt-1 rounded border border-blue-200 font-mono text-xs">
                            node scripts/generate-structure.js
                        </code>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="space-y-1">
                    {renderTree(projectStructure)}
                </div>
            </div>
        </div>
    );
};

export default FileStructureViewer;
