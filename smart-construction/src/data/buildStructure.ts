export interface BuildNode {
    id: string;
    name: string;
    type: 'folder' | 'file';
    path: string;
    extension?: string;
    size?: string;
    description?: string;
    children?: BuildNode[];
    isOpen?: boolean;
}

export const BUILD_STRUCTURE_DATA: BuildNode = {
    id: 'libraries-root',
    name: 'External Libraries (외부 라이브러리)',
    type: 'folder',
    path: 'libraries',
    description: '프로젝트에 사용된 모든 외부 라이브러리와 버전 정보입니다.',
    isOpen: true,
    children: [
        {
            id: 'libraries-core',
            name: 'Core & Framework (핵심)',
            type: 'folder',
            path: 'libraries/core',
            description: '애플리케이션의 기반이 되는 핵심 라이브러리입니다.',
            children: [
                {
                    id: 'lib-react',
                    name: 'React',
                    type: 'file',
                    path: 'libraries/core/react',
                    extension: 'lib',
                    size: '18.2.0',
                    description: 'UI 렌더링을 위한 핵심 라이브러리'
                },
                {
                    id: 'lib-react-dom',
                    name: 'React DOM',
                    type: 'file',
                    path: 'libraries/core/react-dom',
                    extension: 'lib',
                    size: '18.2.0',
                    description: 'React를 웹 브라우저에 표시하기 위한 도구'
                }
            ]
        },
        {
            id: 'build-root',
            name: 'build',
            type: 'folder',
            path: 'build',
            description: '배포용 빌드 폴더',
            isOpen: true,
            children: [
                {
                    id: 'build-static',
                    name: 'static',
                    type: 'folder',
                    path: 'build/static',
                    description: '정적 자원 (JS, CSS, Media) 폴더',
                    children: [
                        {
                            id: 'build-js',
                            name: 'js',
                            type: 'folder',
                            path: 'build/static/js',
                            description: '컴파일된 자바스크립트 파일들',
                            children: [
                                {
                                    id: 'build-main-js',
                                    name: 'main.5d8f2a1e.js',
                                    type: 'file',
                                    path: 'build/static/js/main.5d8f2a1e.js',
                                    extension: 'js',
                                    size: '350KB',
                                    description: '코드 분할(Code Splitting)된 청크 파일 (Vendor/Lib)'
                                },
                                {
                                    id: 'build-js-map',
                                    name: 'main.5d8f2a1e.js.map',
                                    type: 'file',
                                    path: 'build/static/js/main.5d8f2a1e.js.map',
                                    extension: 'map',
                                    size: '4.5MB',
                                    description: 'JS 디버깅을 위한 소스 맵'
                                }
                            ]
                        },
                        {
                            id: 'build-media',
                            name: 'media',
                            type: 'folder',
                            path: 'build/static/media',
                            description: '이미지 및 폰트 파일',
                            children: [
                                {
                                    id: 'build-logo',
                                    name: 'logo.6ce24c58.svg',
                                    type: 'file',
                                    path: 'build/static/media/logo.6ce24c58.svg',
                                    extension: 'svg',
                                    size: '2.5KB',
                                    description: '리액트 로고 이미지'
                                },
                                {
                                    id: 'build-font',
                                    name: 'fa-solid-900.322a553f.woff2',
                                    type: 'file',
                                    path: 'build/static/media/fa-solid-900.322a553f.woff2',
                                    extension: 'woff2',
                                    size: '80KB',
                                    description: 'FontAwesome 폰트 파일'
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'build-manifest',
                    name: 'asset-manifest.json',
                    type: 'file',
                    path: 'build/asset-manifest.json',
                    extension: 'json',
                    size: '1.2KB',
                    description: '생성된 파일들의 경로 매핑 정보'
                },
                {
                    id: 'build-robots',
                    name: 'robots.txt',
                    type: 'file',
                    path: 'build/robots.txt',
                    extension: 'txt',
                    size: '102B',
                    description: '검색 엔진 크롤링 설정 파일'
                },
                {
                    id: 'build-favicon',
                    name: 'favicon.ico',
                    type: 'file',
                    path: 'build/favicon.ico',
                    extension: 'ico',
                    size: '4KB',
                    description: '브라우저 탭 아이콘'
                }
            ]
        }
    ]
};
