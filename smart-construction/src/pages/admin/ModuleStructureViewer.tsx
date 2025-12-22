import React, { useState } from 'react';
import packageJson from '../../../package.json';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faSearch, faTimes, faBookOpen, faCode, faLayerGroup, faLink } from '@fortawesome/free-solid-svg-icons';

interface ModuleDescription {
    category: string;
    korName: string;
    summary: string;
    detail: string;
    usage: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
}

const MODULE_DESCRIPTIONS: { [key: string]: ModuleDescription } = {
    // Core
    'react': {
        category: 'Core',
        korName: '리액트 (React)',
        summary: '화면을 만드는 레고 블록',
        detail: '페이스북(Meta)에서 만든 웹 프레임워크입니다. 레고 블록을 조립하듯이 "컴포넌트"라는 단위로 화면을 쪼개서 개발할 수 있게 해줍니다. 현재 전 세계에서 가장 많이 쓰이는 도구 중 하나입니다.',
        usage: '모든 페이지와 버튼, 입력창 등 눈에 보이는 모든 것을 만들 때 사용합니다.',
        difficulty: 'Medium'
    },
    'react-dom': {
        category: 'Core',
        korName: '리액트 돔',
        summary: '리액트와 웹 브라우저의 연결고리',
        detail: '리액트로 만든 가상의 화면(Virtual DOM)을 실제 웹 브라우저(Chrome, Edge 등)가 이해할 수 있는 HTML로 변환해서 그려주는 역할을 합니다.',
        usage: '앱이 처음 시작될 때 `index.tsx` 파일에서 딱 한 번 주로 사용됩니다.',
        difficulty: 'Hard'
    },
    'react-scripts': {
        category: 'Core',
        korName: '리액트 스크립트',
        summary: '개발 편의 도구 모음',
        detail: '복잡한 웹팩(Webpack) 설정 없이도 바로 리액트 개발을 시작할 수 있게 도와주는 도구입니다. `npm start`로 개발 서버를 띄우거나 `npm run build`로 배포 파일을 만들 때 작동합니다.',
        usage: '터미널에서 명령어를 입력할 때 자동으로 실행됩니다.',
        difficulty: 'Easy'
    },
    'typescript': {
        category: 'Language',
        korName: '타입스크립트',
        summary: '자바스크립트의 엄격한 선생님',
        detail: '자유분방한 자바스크립트에 "타입(Type)"이라는 규칙을 부여합니다. 숫자가 들어갈 곳에 문자를 넣으면 빨간 줄로 경고해줘서, 실행하기 전에 미리 오류를 잡을 수 있게 해줍니다.',
        usage: '`.tsx`나 `.ts` 파일을 작성할 때 항상 사용됩니다.',
        difficulty: 'Medium'
    },

    // Backend (Firebase)
    'firebase': {
        category: 'Backend',
        korName: '파이어베이스',
        summary: '구글이 빌려주는 서버',
        detail: '서버를 직접 구축하지 않아도 데이터베이스, 로그인, 파일 저장소 등을 사용할 수 있게 해주는 구글의 서비스입니다. 프론트엔드 개발자 혼자서도 풀스택 앱을 만들 수 있게 해줍니다.',
        usage: '앱 전반의 데이터 처리와 설정에 사용됩니다.',
        difficulty: 'Medium'
    },
    '@firebase/auth': {
        category: 'Backend',
        korName: '파이어베이스 인증',
        summary: '로그인/회원가입 담당',
        detail: '이메일 로그인, 구글 로그인 같은 복잡한 인증 기능을 아주 쉽게 구현할 수 있게 해줍니다. 보안 문제도 알아서 처리해줍니다.',
        usage: '로그인 페이지, 회원가입, 로그아웃 기능에 사용됩니다.',
        difficulty: 'Easy'
    },
    '@firebase/firestore': {
        category: 'Backend',
        korName: '파이어베이스 DB (Firestore)',
        summary: '실시간 데이터베이스',
        detail: '데이터를 문서(Document)와 컬렉션(Collection) 형태로 저장하는 NoSQL 데이터베이스입니다. 데이터가 바뀌면 앱에도 실시간으로 반영되는 것이 특징입니다.',
        usage: '작업자 정보, 일보 데이터, 현장 정보 등을 저장하고 불러올 때 사용합니다.',
        difficulty: 'Medium'
    },
    '@firebase/storage': {
        category: 'Backend',
        korName: '파이어베이스 스토리지',
        summary: '파일 저장소',
        detail: '사진, 동영상, 엑셀 파일 등을 저장하는 클라우드 공간입니다. 구글 드라이브와 비슷하다고 생각하면 됩니다.',
        usage: '작업자 프로필 사진, 신분증 사본 등을 업로드할 때 사용합니다.',
        difficulty: 'Easy'
    },

    // UI & Styling
    'styled-components': {
        category: 'UI',
        korName: '스타일드 컴포넌트',
        summary: 'JS 안에 쓰는 CSS',
        detail: '자바스크립트 파일 안에서 CSS를 직접 작성해서 컴포넌트를 꾸밀 수 있게 해줍니다. 스타일이 컴포넌트에 종속되어서 관리가 편합니다.',
        usage: '`const Button = styled.button...` 처럼 버튼이나 박스를 꾸밀 때 사용합니다.',
        difficulty: 'Easy'
    },
    '@fortawesome/react-fontawesome': {
        category: 'UI',
        korName: '폰트어썸 아이콘',
        summary: '아이콘 자판기',
        detail: '수천 개의 예쁜 아이콘(집, 사람, 화살표 등)을 무료로 사용할 수 있게 해주는 라이브러리입니다.',
        usage: '메뉴 아이콘, 버튼 아이콘 등을 넣을 때 사용합니다.',
        difficulty: 'Easy'
    },
    'sweetalert2': {
        category: 'UI',
        korName: '스위트 알림창',
        summary: '예쁜 팝업창',
        detail: '브라우저 기본 `alert()` 창은 못생겼지만, 이것을 쓰면 아주 예쁘고 애니메이션이 들어간 알림창을 띄울 수 있습니다.',
        usage: '저장 완료 메시지, 삭제 확인 창 등을 띄울 때 사용합니다.',
        difficulty: 'Easy'
    },
    'ag-grid-react': {
        category: 'UI',
        korName: 'AG 그리드',
        summary: '엑셀 같은 표',
        detail: '데이터를 엑셀처럼 보여주고, 정렬, 필터링, 편집까지 할 수 있는 강력한 표 라이브러리입니다.',
        usage: '작업자 목록, 일보 내역 등 많은 데이터를 표로 보여줄 때 사용합니다.',
        difficulty: 'Hard'
    },
    'handsontable': {
        category: 'UI',
        korName: '핸즈온테이블',
        summary: '웹 엑셀',
        detail: '웹 브라우저 상에서 진짜 엑셀처럼 복사/붙여넣기, 드래그 등이 가능한 스프레드시트를 구현해줍니다.',
        usage: '일보 작성 화면에서 엑셀처럼 입력받을 때 사용합니다.',
        difficulty: 'Hard'
    },

    // Utility
    'react-router-dom': {
        category: 'Utility',
        korName: '리액트 라우터',
        summary: '페이지 이동 내비게이션',
        detail: '새로고침 없이 페이지를 부드럽게 이동시켜주는 도구입니다. 주소창의 URL에 따라 다른 화면을 보여줍니다.',
        usage: '메뉴를 클릭해서 다른 페이지로 이동할 때 사용합니다.',
        difficulty: 'Medium'
    },
    'xlsx': {
        category: 'Utility',
        korName: 'SheetJS (xlsx)',
        summary: '엑셀 파일 번역기',
        detail: '엑셀 파일을 읽어서 자바스크립트 데이터로 바꾸거나, 반대로 데이터를 엑셀 파일로 만들어줍니다.',
        usage: '엑셀 업로드/다운로드 기능에 사용됩니다.',
        difficulty: 'Medium'
    },
    'file-saver': {
        category: 'Utility',
        korName: '파일 세이버',
        summary: '다운로드 도우미',
        detail: '브라우저에서 만든 데이터를 실제 파일로 컴퓨터에 저장(다운로드)할 수 있게 해줍니다.',
        usage: '엑셀 다운로드 버튼을 눌렀을 때 파일을 저장해주는 역할을 합니다.',
        difficulty: 'Easy'
    },
    'mermaid': {
        category: 'Utility',
        korName: '머메이드',
        summary: '코드 다이어그램',
        detail: '복잡한 그림판 작업 없이, 글로만 적으면 자동으로 흐름도나 구조도를 그려주는 도구입니다.',
        usage: '시스템 구조도, DB 설계도 등을 보여줄 때 사용합니다.',
        difficulty: 'Medium'
    },
    '@dnd-kit/core': {
        category: 'UI',
        korName: 'DnD 키트',
        summary: '드래그 앤 드롭',
        detail: '마우스로 요소를 잡아서 다른 곳으로 옮기는 기능을 쉽게 만들 수 있게 도와줍니다.',
        usage: '작업자를 팀으로 배정하거나 순서를 바꿀 때 사용합니다.',
        difficulty: 'Hard'
    }
};

const ModuleStructureViewer: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModule, setSelectedModule] = useState<string | null>(null);

    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const sortedKeys = Object.keys(allDeps).sort();

    const filteredKeys = sortedKeys.filter(key => {
        const info = MODULE_DESCRIPTIONS[key];
        const searchLower = searchTerm.toLowerCase();
        return key.toLowerCase().includes(searchLower) ||
            (info && info.korName.toLowerCase().includes(searchLower)) ||
            (info && info.summary.toLowerCase().includes(searchLower));
    });

    const handleModuleClick = (key: string) => {
        setSelectedModule(key);
    };

    const closeDetail = () => {
        setSelectedModule(null);
    };

    return (
        <div className="w-full h-full bg-slate-50 flex flex-col relative">
            {/* Header */}
            <div className="p-6 bg-white border-b flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-10 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faCube} className="text-blue-500" />
                        모듈 탐색기
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        프로젝트에 사용된 {Object.keys(allDeps).length}개의 도구들을 초보자 눈높이에서 설명합니다.
                    </p>
                </div>
                <div className="relative w-full md:w-96">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="모듈 이름, 설명으로 검색..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredKeys.map((key) => {
                        const version = allDeps[key as keyof typeof allDeps];
                        const info = MODULE_DESCRIPTIONS[key] || {
                            category: 'Other',
                            korName: key,
                            summary: '추가 설명이 준비중입니다.',
                            detail: '아직 상세 설명이 등록되지 않은 모듈입니다.',
                            usage: '',
                            difficulty: 'Medium'
                        };
                        const isDev = packageJson.devDependencies && key in packageJson.devDependencies;

                        return (
                            <div
                                key={key}
                                onClick={() => handleModuleClick(key)}
                                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 hover:-translate-y-1 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${info.category === 'Core' ? 'bg-blue-100 text-blue-700' :
                                            info.category === 'Backend' ? 'bg-orange-100 text-orange-700' :
                                                info.category === 'UI' ? 'bg-pink-100 text-pink-700' :
                                                    info.category === 'Utility' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-slate-100 text-slate-600'
                                        }`}>
                                        {info.category}
                                    </span>
                                    {isDev && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full">DevTool</span>}
                                </div>

                                <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-blue-600 transition-colors">
                                    {info.korName}
                                </h3>
                                <p className="text-xs text-slate-400 font-mono mb-3">{key}</p>

                                <p className="text-sm text-slate-600 line-clamp-2 mb-4 h-10">
                                    {info.summary}
                                </p>

                                <div className="flex justify-between items-center pt-3 border-t border-slate-50 text-xs">
                                    <span className="text-slate-400 font-mono">v{version.replace('^', '')}</span>
                                    <span className="text-blue-500 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        자세히 보기 <FontAwesomeIcon icon={faLink} />
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredKeys.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <FontAwesomeIcon icon={faCube} className="text-4xl mb-4 opacity-20" />
                        <p>검색 결과가 없습니다.</p>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedModule && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={closeDetail}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {(() => {
                            const key = selectedModule;
                            const version = allDeps[key as keyof typeof allDeps];
                            const info = MODULE_DESCRIPTIONS[key] || {
                                category: 'Other',
                                korName: key,
                                summary: '설명 준비중',
                                detail: '상세 설명이 아직 등록되지 않았습니다.',
                                usage: '정보 없음',
                                difficulty: 'Medium'
                            };

                            return (
                                <>
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 rounded-t-2xl">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-md font-bold">
                                                    {info.category}
                                                </span>
                                                <h2 className="text-2xl font-bold text-slate-800">{info.korName}</h2>
                                            </div>
                                            <p className="text-slate-500 font-mono text-sm">{key} <span className="mx-2">•</span> v{version}</p>
                                        </div>
                                        <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
                                            <FontAwesomeIcon icon={faTimes} className="text-xl" />
                                        </button>
                                    </div>

                                    <div className="p-8 space-y-8">
                                        <section>
                                            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <FontAwesomeIcon icon={faBookOpen} className="text-blue-500" />
                                                이게 뭔가요?
                                            </h3>
                                            <p className="text-slate-600 leading-relaxed bg-blue-50 p-4 rounded-xl border border-blue-100">
                                                {info.detail}
                                            </p>
                                        </section>

                                        <section>
                                            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <FontAwesomeIcon icon={faLayerGroup} className="text-orange-500" />
                                                우리 프로젝트에서 어떻게 쓰이나요?
                                            </h3>
                                            <p className="text-slate-600 leading-relaxed">
                                                {info.usage || '일반적인 라이브러리 용도로 사용됩니다.'}
                                            </p>
                                        </section>

                                        <section>
                                            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <FontAwesomeIcon icon={faCode} className="text-purple-500" />
                                                난이도
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className={`w-8 h-2 rounded-full ${(info.difficulty === 'Easy' && i === 1) ||
                                                                (info.difficulty === 'Medium' && i <= 2) ||
                                                                (info.difficulty === 'Hard' && i <= 3)
                                                                ? 'bg-purple-500'
                                                                : 'bg-slate-200'
                                                            }`} />
                                                    ))}
                                                </div>
                                                <span className="text-sm font-medium text-slate-600 ml-2">
                                                    {info.difficulty === 'Easy' ? '쉬움' : info.difficulty === 'Medium' ? '보통' : '어려움'}
                                                </span>
                                            </div>
                                        </section>
                                    </div>

                                    <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
                                        <button
                                            onClick={closeDetail}
                                            className="px-6 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                                        >
                                            닫기
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModuleStructureViewer;
