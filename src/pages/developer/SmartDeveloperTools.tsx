import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTools,
    faSearch,
    faFileCode,
    faCubes,
    faServer,
    faList,
    faTag,
    faCode,
    faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons';
import { projectFiles, FileInfo } from '../../data/projectFiles';

type CategoryFilter = 'all' | 'page' | 'component' | 'service' | 'hook' | 'util';

const SmartDeveloperTools: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

    // 필터링된 파일 목록
    const filteredFiles = useMemo(() => {
        let files = projectFiles;

        // 카테고리 필터
        if (categoryFilter !== 'all') {
            files = files.filter(file => file.category === categoryFilter);
        }

        // 검색 필터
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            files = files.filter(file =>
                file.name.toLowerCase().includes(query) ||
                file.description?.toLowerCase().includes(query) ||
                file.tags?.some(tag => tag.toLowerCase().includes(query))
            );
        }

        return files;
    }, [searchQuery, categoryFilter]);

    // 카테고리별 개수
    const categoryCounts = useMemo(() => {
        return {
            all: projectFiles.length,
            page: projectFiles.filter(f => f.category === 'page').length,
            component: projectFiles.filter(f => f.category === 'component').length,
            service: projectFiles.filter(f => f.category === 'service').length,
            hook: projectFiles.filter(f => f.category === 'hook').length,
            util: projectFiles.filter(f => f.category === 'util').length
        };
    }, []);

    // VSCode 링크 생성
    const openInVSCode = (file: FileInfo) => {
        window.open(`vscode://file/c:/Users/playz/cy/${file.path}`);
    };

    // GitHub 링크 생성
    const openInGitHub = (file: FileInfo) => {
        const githubUrl = `https://github.com/playzzin/cy/blob/main/${file.path}`;
        window.open(githubUrl, '_blank');
    };

    // 카테고리별 색상
    const getCategoryStyle = (category: FileInfo['category']) => {
        switch (category) {
            case 'page': return { bg: 'bg-blue-100', text: 'text-blue-700', label: '페이지' };
            case 'component': return { bg: 'bg-purple-100', text: 'text-purple-700', label: '컴포넌트' };
            case 'service': return { bg: 'bg-green-100', text: 'text-green-700', label: '서비스' };
            case 'hook': return { bg: 'bg-orange-100', text: 'text-orange-700', label: '훅' };
            case 'util': return { bg: 'bg-slate-100', text: 'text-slate-700', label: '유틸' };
            default: return { bg: 'bg-slate-100', text: 'text-slate-700', label: '기타' };
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                {/* 헤더 */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faTools} className="text-indigo-600" />
                            프로젝트 파일 관리
                        </h1>
                        <p className="text-slate-500 mt-1">
                            프로젝트의 모든 페이지와 컴포넌트를 한눈에 관리하세요.
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-500">총 {projectFiles.length}개 파일</div>
                        <div className="text-xs text-slate-400">{filteredFiles.length}개 표시 중</div>
                    </div>
                </div>

                {/* 안내 */}
                <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h3 className="font-bold text-indigo-800 mb-2">💡 기능</h3>
                    <ul className="list-disc list-inside text-sm text-indigo-700 space-y-1">
                        <li><strong>VSCode에서 열기:</strong> 파일을 바로 에디터에서 열 수 있습니다</li>
                        <li><strong>GitHub 보기:</strong> 온라인에서 파일을 확인할 수 있습니다</li>
                        <li><strong>검색 & 필터:</strong> 파일명, 설명, 태그로 빠르게 찾을 수 있습니다</li>
                    </ul>
                </div>

                {/* 검색 */}
                <div className="relative mb-4">
                    <FontAwesomeIcon
                        icon={faSearch}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                    />
                    <input
                        type="text"
                        placeholder="파일명, 설명, 태그로 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {/* 카테고리 필터 */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <button
                        onClick={() => setCategoryFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'all'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        <FontAwesomeIcon icon={faList} className="mr-2" />
                        전체 ({categoryCounts.all})
                    </button>
                    <button
                        onClick={() => setCategoryFilter('page')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'page'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        <FontAwesomeIcon icon={faFileCode} className="mr-2" />
                        Pages ({categoryCounts.page})
                    </button>
                    <button
                        onClick={() => setCategoryFilter('component')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'component'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        <FontAwesomeIcon icon={faCubes} className="mr-2" />
                        Components ({categoryCounts.component})
                    </button>
                    <button
                        onClick={() => setCategoryFilter('service')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'service'
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        <FontAwesomeIcon icon={faServer} className="mr-2" />
                        Services ({categoryCounts.service})
                    </button>
                </div>

                {/* 파일 목록 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-auto">
                    {filteredFiles.length > 0 ? (
                        filteredFiles.map(file => {
                            const style = getCategoryStyle(file.category);
                            return (
                                <div key={file.id} className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow">
                                    {/* 헤더 */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2 flex-1">
                                            <FontAwesomeIcon icon={faFileCode} className="text-slate-400" />
                                            <h3 className="font-bold text-slate-800 text-sm">{file.name}</h3>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${style.bg} ${style.text}`}>
                                            {style.label}
                                        </span>
                                    </div>

                                    {/* 설명 */}
                                    {file.description && (
                                        <p className="text-sm text-slate-600 mb-3">
                                            {file.description}
                                        </p>
                                    )}

                                    {/* 태그 */}
                                    {file.tags && file.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {file.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs flex items-center gap-1"
                                                >
                                                    <FontAwesomeIcon icon={faTag} className="text-xs" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* 정보 */}
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                                        <span className="truncate">{file.path}</span>
                                        {file.lines && (
                                            <>
                                                <span>•</span>
                                                <span>{file.lines} lines</span>
                                            </>
                                        )}
                                    </div>

                                    {/* 액션 버튼 */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openInVSCode(file)}
                                            className="flex-1 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <FontAwesomeIcon icon={faCode} />
                                            <span>VSCode</span>
                                        </button>
                                        <button
                                            onClick={() => openInGitHub(file)}
                                            className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                                            <span>GitHub</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
                            <FontAwesomeIcon icon={faSearch} className="text-6xl mb-4 opacity-20" />
                            <p>검색 결과가 없습니다</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartDeveloperTools;
