const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const OUTPUT_FILE = path.join(__dirname, '../src/data/projectStructure.json');

// Files/Folders to ignore
const IGNORE_LIST = [
    'node_modules',
    '.git',
    '.DS_Store',
    'dist',
    'build',
    'coverage',
    'projectStructure.json' // Avoid self-reference loop if it were in the scan path
];

// Helper to get file description (simple mapping based on extension or name)
const getDescription = (name, type) => {
    if (type === 'folder') {
        if (name === 'components') return '재사용 가능한 컴포넌트들이 모여있는 폴더입니다.';
        if (name === 'pages') return '애플리케이션의 각 페이지 컴포넌트들이 있습니다.';
        if (name === 'services') return 'API 호출 및 비즈니스 로직을 담당하는 파일들입니다.';
        if (name === 'utils') return '공통적으로 사용되는 유틸리티 함수들입니다.';
        if (name === 'hooks') return '커스텀 React Hooks가 있습니다.';
        if (name === 'types') return 'TypeScript 타입 정의 파일들입니다.';
        if (name === 'assets') return '이미지, 폰트 등 정적 리소스입니다.';
        if (name === 'layout') return '페이지 레이아웃 관련 컴포넌트입니다.';
        return '폴더';
    } else {
        if (name.endsWith('.tsx')) return 'React 컴포넌트 파일입니다.';
        if (name.endsWith('.ts')) return 'TypeScript 로직 파일입니다.';
        if (name.endsWith('.css')) return '스타일 시트 파일입니다.';
        if (name === 'App.tsx') return '애플리케이션의 메인 진입점 및 라우팅 설정입니다.';
        if (name === 'index.tsx') return 'React 앱을 DOM에 렌더링하는 파일입니다.';
        return '파일';
    }
};

const scanDirectory = (dirPath) => {
    const name = path.basename(dirPath);
    const stats = fs.statSync(dirPath);

    const node = {
        id: path.relative(SRC_DIR, dirPath) || 'src',
        name: name,
        type: stats.isDirectory() ? 'folder' : 'file',
        description: getDescription(name, stats.isDirectory() ? 'folder' : 'file'),
    };

    if (stats.isDirectory()) {
        const children = fs.readdirSync(dirPath)
            .filter(child => !IGNORE_LIST.includes(child))
            .map(child => scanDirectory(path.join(dirPath, child)));

        // Sort: folders first, then files
        children.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        node.children = children;
    }

    return node;
};

try {
    console.log('Scanning src directory...');
    const tree = scanDirectory(SRC_DIR);

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tree, null, 2));
    console.log(`Successfully generated structure to: ${OUTPUT_FILE}`);
} catch (error) {
    console.error('Error generating structure:', error);
    process.exit(1);
}
