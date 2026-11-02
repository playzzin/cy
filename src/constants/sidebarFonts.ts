export const SIDEBAR_FONT_GROUPS = ['고딕', '명조', '둥근 글씨', '손글씨', '제목용'] as const;
type FontGroup = typeof SIDEBAR_FONT_GROUPS[number];
interface FontPreset {
    label: string;
    group: FontGroup;
    family: string;
    stylesheet?: string;
}

const sansFallback = '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const serifFallback = '"AppleMyungjo", "Batang", serif';
function font(label: string, name: string, group: FontGroup, stylesheet?: string): FontPreset {
    return { label, group, family: `"${name}", ${group === '명조' ? serifFallback : sansFallback}`, stylesheet };
}

function googleFont(label: string, name: string, group: FontGroup, weights = '400'): FontPreset {
    return font(label, name, group, `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@${weights}&display=swap`);
}

export const SIDEBAR_FONTS = {
    pretendard: font('프리텐다드', 'CY Sidebar Pretendard', '고딕'),
    'noto-sans-kr': font('본고딕 (Noto Sans KR)', 'Noto Sans KR Variable', '고딕', 'https://cdn.jsdelivr.net/npm/@fontsource-variable/noto-sans-kr@5.3.1/wght.css'),
    'nanum-gothic': googleFont('나눔고딕', 'Nanum Gothic', '고딕', '400;700'),
    suit: font('수트 (SUIT)', 'CY Sidebar SUIT', '고딕'),
    'spoqa-neo': font('스포카 한 산스 네오', 'CY Sidebar Spoqa Han Sans Neo', '고딕'),
    'wanted-sans': font('원티드 산스', 'Wanted Sans Variable', '고딕', 'https://cdn.jsdelivr.net/npm/wanted-sans@1.0.3/fonts/webfonts/variable/split/WantedSansVariable.min.css'),
    'nanum-square-neo': font('나눔스퀘어 네오', 'CY Sidebar NanumSquare Neo', '고딕'),
    'nanum-square': font('나눔스퀘어', 'CY Sidebar NanumSquare', '고딕'),
    'nanum-barun-gothic': font('나눔바른고딕', 'CY Sidebar NanumBarunGothic', '고딕'),
    'ibm-plex-sans-kr': googleFont('IBM 플렉스 산스 KR', 'IBM Plex Sans KR', '고딕', '400;700'),
    'gothic-a1': googleFont('고딕 A1', 'Gothic A1', '고딕', '400;700'),
    'nanum-gothic-coding': googleFont('나눔고딕코딩', 'Nanum Gothic Coding', '고딕', '400;700'),

    'nanum-myeongjo': googleFont('나눔명조', 'Nanum Myeongjo', '명조', '400;700'),
    'gowun-batang': googleFont('고운바탕', 'Gowun Batang', '명조', '400;700'),
    'noto-serif-kr': googleFont('본명조 (Noto Serif KR)', 'Noto Serif KR', '명조', '400;700'),
    'maru-buri': font('마루 부리', 'CY Sidebar MaruBuri', '명조'),
    hahmlet: googleFont('함렛', 'Hahmlet', '명조', '400;700'),
    'song-myung': googleFont('송명', 'Song Myung', '명조'),
    diphylleia: googleFont('디필레이아', 'Diphylleia', '명조'),
    'grandiflora-one': googleFont('그란디플로라 원', 'Grandiflora One', '명조'),

    'gowun-dodum': googleFont('고운돋움', 'Gowun Dodum', '둥근 글씨'),
    'baemin-jua': font('배민 주아체', 'CY BM Jua', '둥근 글씨'),
    'nanum-square-round': font('나눔스퀘어라운드', 'CY Sidebar NanumSquareRound', '둥근 글씨'),
    dongle: googleFont('동글', 'Dongle', '둥근 글씨', '400;700'),
    sunflower: googleFont('해바라기', 'Sunflower', '둥근 글씨', '500;700'),

    'nanum-pen': googleFont('나눔손글씨 펜', 'Nanum Pen Script', '손글씨'),
    'nanum-brush': googleFont('나눔손글씨 붓', 'Nanum Brush Script', '손글씨'),
    'gamja-flower': googleFont('감자꽃 (Gamja Flower)', 'Gamja Flower', '손글씨'),
    'nanum-barun-pen': font('나눔바른펜', 'CY Sidebar NanumBarunpen', '손글씨'),
    gaegu: googleFont('개구', 'Gaegu', '손글씨', '400;700'),
    'yeon-sung': googleFont('배민 연성체', 'Yeon Sung', '손글씨'),
    'hi-melody': googleFont('하이 멜로디', 'Hi Melody', '손글씨'),
    'single-day': googleFont('싱글 데이', 'Single Day', '손글씨'),
    'poor-story': googleFont('푸어 스토리', 'Poor Story', '손글씨'),

    'black-han-sans': googleFont('검은고딕', 'Black Han Sans', '제목용'),
    'baemin-dohyeon': font('배민 도현체', 'CY BM Dohyeon', '제목용'),
    'baemin-hanna': font('배민 한나는열한살체', 'CY BM Hanna', '제목용'),
    orbit: googleFont('오르빗', 'Orbit', '제목용'),
    gugi: googleFont('구기', 'Gugi', '제목용'),
    'bagel-fat-one': googleFont('베이글 팻 원', 'Bagel Fat One', '제목용'),
    'moirai-one': googleFont('모이라 원', 'Moirai One', '제목용'),
    stylish: googleFont('스타일리시', 'Stylish', '제목용'),
    'kirang-haerang': googleFont('배민 기랑해랑체', 'Kirang Haerang', '제목용')
};
export type SidebarFontId = keyof typeof SIDEBAR_FONTS;
export const SIDEBAR_FONT_IDS = Object.keys(SIDEBAR_FONTS) as [SidebarFontId, ...SidebarFontId[]];

export const isSidebarFont = (value: unknown): value is SidebarFontId =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(SIDEBAR_FONTS, value);

export const sidebarFontFamily = (font?: SidebarFontId) => isSidebarFont(font) ? SIDEBAR_FONTS[font].family : undefined;
