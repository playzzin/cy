import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileCode,
    faExternalLinkAlt,
    faCode,
    faTag
} from '@fortawesome/free-solid-svg-icons';
import { FileInfo } from '../../data/projectFiles';

interface FileCardProps {
    file: FileInfo;
}

const FileCard: React.FC<FileCardProps> = ({ file }) => {
    // VSCode 링크 생성
    const openInVSCode = () => {
        window.open(`vscode://file/c:/Users/playz/cy/${file.path}`);
    };

    // GitHub 링크 생성 (저장소 URL은 환경에 맞게 수정)
    const openInGitHub = () => {
        const githubUrl = `https://github.com/YOUR_USERNAME/cy/blob/main/${file.path}`;
        window.open(githubUrl, '_blank');
    };

    // 카테고리별 색상
    const getCategoryColor = () => {
        switch (file.category) {
            case 'page': return 'bg-blue-100 text-blue-700';
            case 'component': return 'bg-purple-100 text-purple-700';
            case 'service': return 'bg-green-100 text-green-700';
            case 'hook': return 'bg-orange-100 text-orange-700';
            case 'util': return 'bg-slate-100 text-slate-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    // 카테고리 한글명
    const getCategoryLabel = () => {
        switch (file.category) {
            case 'page': return '페이지';
            case 'component': return '컴포넌트';
            case 'service': return '서비스';
            case 'hook': return '훅';
            case 'util': return '유틸';
            default: return '기타';
        }
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow">
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                    <FontAwesomeIcon icon={faFileCode} className="text-slate-400" />
                    <h3 className="font-bold text-slate-800">{file.name}</h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getCategoryColor()}`}>
                    {getCategoryLabel()}
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
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                <span>{file.path}</span>
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
                    onClick={openInVSCode}
                    className="flex-1 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faCode} />
                    <span>VSCode</span>
                </button>
                <button
                    onClick={openInGitHub}
                    className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                    <span>GitHub</span>
                </button>
            </div>
        </div>
    );
};

export default FileCard;
