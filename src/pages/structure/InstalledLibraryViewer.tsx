import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxOpen, faCode, faCube, faExternalLinkAlt, faSearch } from '@fortawesome/free-solid-svg-icons';
import packageJson from '../../../package.json';

const InstalledLibraryViewer: React.FC = () => {
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    const renderLibraryList = (libs: { [key: string]: string }, title: string, icon: any, colorClass: string) => {
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className={`p-4 border-b border-slate-100 flex items-center gap-2 ${colorClass} bg-opacity-10`}>
                    <FontAwesomeIcon icon={icon} className={colorClass} />
                    <h2 className="font-bold text-lg text-slate-800">{title}</h2>
                    <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-white text-slate-500 border border-slate-200">
                        {Object.keys(libs).length}개
                    </span>
                </div>
                <div className="divide-y divide-slate-100">
                    {Object.entries(libs).map(([name, version]) => (
                        <div key={name} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                            <div>
                                <div className="font-bold text-slate-700 flex items-center gap-2">
                                    {name}
                                    <span className="text-xs font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {version}
                                    </span>
                                </div>
                            </div>
                            <a
                                href={`https://www.npmjs.com/package/${name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-all px-3 py-1.5 rounded-lg hover:bg-brand-50 text-sm font-medium flex items-center gap-1"
                            >
                                npm
                                <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faBoxOpen} className="text-brand-600" />
                    내 라이브러리 (Installed Libraries)
                </h1>
                <p className="text-slate-600">
                    현재 프로젝트에 설치되어 있는 모든 라이브러리 목록입니다.
                    <br />
                    <span className="text-sm text-slate-500">* package.json 파일을 실시간으로 읽어옵니다.</span>
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderLibraryList(dependencies, 'Production Dependencies (실제 운영용)', faCube, 'text-blue-600')}
                {renderLibraryList(devDependencies, 'Dev Dependencies (개발 도구용)', faCode, 'text-green-600')}
            </div>
        </div>
    );
};

export default InstalledLibraryViewer;
