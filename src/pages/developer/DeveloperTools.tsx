import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTools,
    faSearch,
    faFileCode,
    faCubes,
    faServer,
    faList
} from '@fortawesome/free-solid-svg-icons';
import FileCard from '../../components/developer/FileCard';
import { projectFiles, FileInfo } from '../../data/projectFiles';

type CategoryFilter = 'all' | 'page' | 'component' | 'service' | 'hook' | 'util';

const DeveloperTools: React.FC = () => {
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

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 헤더 */}
            <div className="bg-white border-b border-slate-200 p-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faTools} className="text-indigo-600" />
                        <span>개발자 도구</span>
                    </h2>
                    <div className="text-sm text-slate-500">
                        {filteredFiles.length}개 파일
                    </div>
                </div>

                {/* 검색 */}
                <div className="relative">
                    <FontAwesomeIcon
                        icon={faSearch}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                    />
                    <input
                        type="text"
                        placeholder="파일명, 설명, 태그로 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* 카테고리 필터 탭 */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
                <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'all'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    <FontAwesomeIcon icon={faList} className="mr-2" />
                    전체 ({categoryCounts.all})
                </button>
                <button
                    onClick={() => setCategoryFilter('page')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'page'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    <FontAwesomeIcon icon={faFileCode} className="mr-2" />
                    Pages ({categoryCounts.page})
                </button>
                <button
                    onClick={() => setCategoryFilter('component')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'component'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    <FontAwesomeIcon icon={faCubes} className="mr-2" />
                    Components ({categoryCounts.component})
                </button>
                <button
                    onClick={() => setCategoryFilter('service')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'service'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    <FontAwesomeIcon icon={faServer} className="mr-2" />
                    Services ({categoryCounts.service})
                </button>
            </div>

            {/* 파일 목록 */}
            <div className="flex-1 overflow-auto p-6">
                {filteredFiles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredFiles.map(file => (
                            <FileCard key={file.id} file={file} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <FontAwesomeIcon icon={faSearch} className="text-6xl mb-4" />
                        <p>검색 결과가 없습니다</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeveloperTools;
