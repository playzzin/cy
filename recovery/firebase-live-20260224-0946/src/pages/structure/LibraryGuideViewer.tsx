import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFilm, faChartPie, faClipboardCheck, faCalendarDays, faBell,
    faCode, faLightbulb, faCheckCircle, faQuoteLeft, faArrowRight, faThumbsUp,
    faDatabase, faNetworkWired, faPalette, faCloudUploadAlt, faMagic, faCamera, faExternalLinkAlt,
    faRobot, faBuilding, faSeedling, faBolt, faLayerGroup, faTable, faFileExcel
} from '@fortawesome/free-solid-svg-icons';

type LibraryId = 'framer' | 'recharts' | 'hook-form' | 'datepicker' | 'sweetalert' | 'zustand' | 'query' | 'tailwind-merge' | 'lottie' | 'dropzone' | 'html2canvas' | 'exceljs' | 'ag-grid';

const LIBRARY_DATA = {
    'framer': {
        name: 'Framer Motion',
        icon: faFilm,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        link: 'https://www.framer.com/motion/',
        summary: "화면을 스르륵~ 쫀득하게 움직이게 만드는 애니메이션 도구",
        analogy: {
            title: "인테리어 시공팀 🎨",
            desc: "건물의 뼈대(HTML)와 기능(JS)은 튼튼하지만, 뭔가 딱딱해 보일 때가 있죠? 이 팀이 들어오면 문이 부드럽게 열리고, 조명이 은은하게 켜지는 고급스러운 마감을 해줍니다."
        },
        benefits: [
            "메뉴가 열릴 때 '탁!' 하고 나오는 게 아니라 '스르륵' 나옵니다.",
            "버튼을 누르면 살짝 들어가는 느낌(인터랙션)을 줍니다.",
            "사용자가 '오, 이 사이트 고급진데?'라고 느끼게 합니다."
        ],
        example: `// 1. 이렇게 감싸주면
<motion.div 
    initial={{ opacity: 0 }} // 처음엔 투명하다가
    animate={{ opacity: 1 }} // 1초 만에 나타남!
>
    안녕하세요!
</motion.div>`
    },
    'recharts': {
        name: 'Recharts',
        icon: faChartPie,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        link: 'https://recharts.org/',
        summary: "복잡한 숫자를 한눈에 들어오는 그림(차트)으로 바꿔주는 도구",
        analogy: {
            title: "현황판 제작팀 📊",
            desc: "현장에 쌓인 수천 장의 일보를 사장님이 일일이 읽을 순 없죠. 이 팀은 그 데이터를 모아서 '이번 달 출력 인원 추이', '팀별 인건비 비중' 같은 멋진 그래프를 그려서 벽에 걸어줍니다."
        },
        benefits: [
            "엑셀 표보다 100배 더 빠르게 상황 파악이 가능합니다.",
            "마우스를 올리면 상세 숫자가 나오는 '살아있는 그래프'입니다.",
            "모바일에서도 예쁘게 크기가 조절됩니다."
        ],
        example: `// 막대 그래프 그리기
<BarChart width={500} height={300} data={data}>
    <XAxis dataKey="name" /> // X축: 이름
    <YAxis /> // Y축: 숫자
    <Bar dataKey="value" fill="#8884d8" /> // 막대
</BarChart>`
    },
    'hook-form': {
        name: 'React Hook Form',
        icon: faClipboardCheck,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50',
        borderColor: 'border-pink-200',
        link: 'https://react-hook-form.com/',
        summary: "입력창이 100개라도 끄떡없는 서류 관리의 달인",
        analogy: {
            title: "서류 검토팀 📝",
            desc: "작업자 등록할 때 이름, 주민번호, 주소, 계좌... 입력할 게 너무 많죠? 하나라도 빼먹으면 나중에 골치 아픕니다. 이 팀은 옆에서 지켜보다가 '어, 김씨 계좌번호 빠졌는데요?' 하고 바로 알려줍니다."
        },
        benefits: [
            "입력할 때마다 검사해서 실수를 미리 막아줍니다.",
            "입력창이 많아도 사이트가 느려지지 않습니다 (최적화).",
            "코드가 훨씬 깔끔해져서 개발자가 행복해집니다."
        ],
        example: `// 입력 관리하기
const { register, handleSubmit } = useForm();

<form onSubmit={handleSubmit(onSubmit)}>
    {/* 필수 입력 설정 */}
    <input {...register("name", { required: true })} />
    <button>제출</button>
</form>`
    },
    'datepicker': {
        name: 'React Datepicker',
        icon: faCalendarDays,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        link: 'https://reactdatepicker.com/',
        summary: "날짜 선택을 달력으로 편하게 할 수 있게 해주는 도구",
        analogy: {
            title: "스케줄 관리팀 📅",
            desc: "날짜를 '20231201' 이렇게 손으로 치면 오타가 나기 쉽죠. 이 팀은 예쁜 달력을 띄워줘서 마우스로 콕 찍기만 하면 정확한 날짜가 입력되게 도와줍니다."
        },
        benefits: [
            "오타 0% (13월 32일 같은 날짜 입력 불가).",
            "공사 기간(시작일~종료일) 선택이 매우 직관적입니다.",
            "디자인이 깔끔해서 어디에나 잘 어울립니다."
        ],
        example: `// 달력 띄우기
<DatePicker 
    selected={startDate} 
    onChange={(date) => setStartDate(date)} 
    dateFormat="yyyy/MM/dd"
/>`
    },
    'sweetalert': {
        name: 'SweetAlert2',
        icon: faBell,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        link: 'https://sweetalert2.github.io/',
        summary: "투박한 경고창 대신 예쁜 팝업을 띄워주는 도구",
        analogy: {
            title: "안내 방송팀 📢",
            desc: "브라우저 기본 경고창은 너무 딱딱하고 무섭죠. 이 팀은 '저장이 완료되었습니다! 🎉' 하고 폭죽도 터뜨려주고, 실수하면 부드럽게 알려주는 친절한 안내원입니다."
        },
        benefits: [
            "사용자 경험(UX)이 훨씬 좋아집니다.",
            "성공, 실패, 경고 아이콘이 자동으로 들어갑니다.",
            "버튼 색상이나 모양을 마음대로 꾸밀 수 있습니다."
        ],
        example: `// 예쁜 알림창 띄우기
Swal.fire({
  title: '저장 완료!',
  text: '작업자 정보가 안전하게 저장되었습니다.',
  icon: 'success',
  confirmButtonText: '확인'
})`
    },
    'zustand': {
        name: 'Zustand',
        icon: faDatabase,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        link: 'https://github.com/pmndrs/zustand',
        summary: "전역 상태 관리의 요정 (Redux보다 훨씬 쉬움)",
        analogy: {
            title: "중앙 상황실 📡",
            desc: "어떤 데이터(로그인 정보, 다크모드 여부 등)는 모든 페이지에서 다 알아야 하죠? 이걸 일일이 전달하면 힘듭니다. 이 도구는 '상황실'을 하나 만들어서 누구나 쉽게 정보를 꺼내 쓰고 업데이트할 수 있게 해줍니다."
        },
        benefits: [
            "설정이 거의 필요 없을 정도로 아주 간단합니다.",
            "코드가 짧아져서 유지보수가 쉽습니다.",
            "필요한 부분만 쏙쏙 골라 쓸 수 있어 성능이 좋습니다."
        ],
        example: `// 1. 창고(Store) 만들기
const useStore = create((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
}))

// 2. 사용하기
const bears = useStore((state) => state.bears)`
    },
    'query': {
        name: 'TanStack Query',
        icon: faNetworkWired,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        link: 'https://tanstack.com/query/latest',
        summary: "서버 데이터 배달부 (로딩/에러 처리 자동화)",
        analogy: {
            title: "물류 배송팀 🚚",
            desc: "서버에서 데이터를 가져올 때 '로딩 중...', '에러 발생!', '데이터 갱신' 같은 걸 매번 직접 짜기 귀찮죠? 이 팀은 데이터를 알아서 가져오고, 캐싱(임시 저장)해두었다가 필요할 때 바로바로 배달해줍니다."
        },
        benefits: [
            "로딩 스피너(Loading Spinner) 구현이 1초면 끝납니다.",
            "이미 가져온 데이터는 다시 안 가져와서 속도가 빠릅니다.",
            "창을 다시 켰을 때 자동으로 최신 데이터를 받아옵니다."
        ],
        example: `// 데이터 가져오기
const { isPending, error, data } = useQuery({
  queryKey: ['repoData'],
  queryFn: () =>
    fetch('https://api.github.com/repos/tannerlinsley/react-query').then((res) =>
      res.json(),
    ),
})`
    },
    'tailwind-merge': {
        name: 'Tailwind Merge',
        icon: faPalette,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        borderColor: 'border-cyan-200',
        link: 'https://github.com/dcastil/tailwind-merge',
        summary: "스타일 정리 정돈가 (클래스 충돌 해결)",
        analogy: {
            title: "교통 정리 경찰 👮",
            desc: "버튼 색상을 '빨강'으로 정했는데, 나중에 '파랑'을 덧입히면 둘이 싸우다가 엉뚱한 색이 나올 수 있습니다. 이 도구는 '나중에 온 파랑이 이겨!'라고 교통 정리를 해줘서 스타일이 꼬이는 걸 막아줍니다."
        },
        benefits: [
            "컴포넌트를 만들 때 스타일 덮어쓰기가 아주 쉬워집니다.",
            "조건부 스타일링(clsx)과 함께 쓰면 천하무적입니다.",
            "디자인 버그를 획기적으로 줄여줍니다."
        ],
        example: `// 빨강과 파랑이 싸우면?
twMerge('bg-red-500', 'bg-blue-500')
// 결과: 'bg-blue-500' (뒤에 온 게 이김!)`
    },
    'lottie': {
        name: 'Lottie',
        icon: faMagic,
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        borderColor: 'border-teal-200',
        link: 'https://lottiefiles.com/',
        summary: "움직이는 스티커 (고퀄리티 벡터 애니메이션)",
        analogy: {
            title: "디즈니 애니메이터 🎬",
            desc: "GIF는 용량이 크고 깨지기 쉽죠. 이 도구는 디자이너가 만든 고퀄리티 애니메이션을 코드로 변환해서, 아주 가볍고 선명하게 웹사이트에서 재생해줍니다."
        },
        benefits: [
            "용량이 매우 작으면서도 화질이 절대 깨지지 않습니다.",
            "재생, 멈춤, 속도 조절을 코드로 마음대로 할 수 있습니다.",
            "앱의 퀄리티가 순식간에 몇 단계 올라갑니다."
        ],
        example: `// 애니메이션 재생
<Lottie 
    animationData={animationJson} 
    loop={true} 
/>`
    },
    'dropzone': {
        name: 'React Dropzone',
        icon: faCloudUploadAlt,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        link: 'https://react-dropzone.js.org/',
        summary: "파일 던지기 놀이 (드래그 앤 드롭 업로드)",
        analogy: {
            title: "수하물 접수처 🛄",
            desc: "파일 찾기 버튼 누르고 폴더 뒤지는 건 너무 옛날 방식이죠. 이 도구는 '여기에 파일을 놓으세요'라는 영역을 만들어줘서, 바탕화면에서 파일을 슥 끌어다 놓기만 하면 업로드가 되게 해줍니다."
        },
        benefits: [
            "사용자가 파일을 올리기가 훨씬 편해집니다.",
            "이미지 미리보기 기능도 쉽게 만들 수 있습니다.",
            "여러 파일을 한 번에 올리는 것도 지원합니다."
        ],
        example: `// 드래그 앤 드롭 영역
<div {...getRootProps()}>
  <input {...getInputProps()} />
  <p>파일을 여기에 끌어다 놓으세요!</p>
</div>`
    },
    'html2canvas': {
        name: 'html2canvas',
        icon: faCamera,
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        link: 'https://html2canvas.hertzen.com/',
        summary: "화면을 찰칵! 찍어서 이미지로 저장해주는 도구",
        analogy: {
            title: "현장 사진 기사 📸",
            desc: "일보를 다 썼는데, 이걸 이미지로 저장해서 카톡으로 보내고 싶을 때가 있죠? 이 기사님은 화면에 보이는 그대로를 사진으로 찍어서 파일로 만들어줍니다."
        },
        benefits: [
            "복잡한 보고서도 버튼 하나로 이미지 저장이 가능합니다.",
            "화면에 보이는 그대로(WYSIWYG) 캡처됩니다.",
            "서버 없이 브라우저에서 바로 동작합니다."
        ],
        example: `// 화면 캡처하기
html2canvas(document.body).then(canvas => {
    document.body.appendChild(canvas);
});`
    },
    'exceljs': {
        name: 'ExcelJS',
        icon: faFileExcel,
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        link: 'https://github.com/exceljs/exceljs',
        summary: "엑셀 파일을 '진짜 엑셀처럼' 꾸며주는 도구",
        analogy: {
            title: "문서 편집 디자이너 🎨",
            desc: "SheetJS(XLSX)는 데이터만 띡 넣는 느낌이라면, 이 친구는 '폰트 굵게', '배경색 노랑', '테두리 두껍게' 같은 디자인을 입혀줍니다. 사장님이 원하시는 '깔끔한 보고서 양식'을 그대로 엑셀로 만들어낼 수 있습니다."
        },
        benefits: [
            "엑셀 셀에 색깔 넣고, 글자 크기 조절이 가능합니다.",
            "이미지를 엑셀 안에 삽입할 수 있습니다.",
            "칸 합치기(Merge) 같은 복잡한 양식도 완벽하게 지원합니다.",
            "💡 꿀팁: SheetJS와 같이 써도 전혀 문제없습니다! (읽기는 SheetJS, 꾸미기는 ExcelJS)"
        ],
        example: `// 엑셀 꾸미기
const worksheet = workbook.addWorksheet('내역서');
worksheet.getCell('A1').value = '총 공사비';
worksheet.getCell('A1').font = { 
    name: '맑은 고딕', 
    bold: true, 
    size: 14 
};
worksheet.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF00' } // 노란색 배경
};`
    },
    'ag-grid': {
        name: 'AG Grid',
        icon: faTable,
        color: 'text-blue-800',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        link: 'https://www.ag-grid.com/',
        summary: "웹에서 엑셀 기능을 그대로 쓰는 끝판왕 그리드",
        analogy: {
            title: "슈퍼 엑셀 머신 🤖",
            desc: "그냥 표(Table)가 아닙니다. 웹사이트 안에서 엑셀처럼 필터 걸고, 정렬하고, 컬럼 순서 바꾸고, 심지어 복사/붙여넣기까지 다 되는 엄청난 녀석입니다. 데이터가 10만 개라도 버벅이지 않습니다."
        },
        benefits: [
            "엑셀처럼 드래그해서 선택하고 복사/붙여넣기가 됩니다.",
            "컬럼을 내 맘대로 숨기거나 순서를 바꿀 수 있습니다.",
            "엄청난 양의 데이터도 순식간에 보여줍니다.",
            "💡 꿀팁: ExcelJS와 함께 쓰면, 화면에 보이는 그대로 엑셀 다운로드가 가능합니다."
        ],
        example: `// 슈퍼 그리드
<AgGridReact
    rowData={rowData}
    columnDefs={[
        { field: "name", sortable: true, filter: true },
        { field: "role", sortable: true, filter: true },
        { field: "price", valueFormatter: currencyFormatter }
    ]}
    pagination={true}
    enableRangeSelection={true} // 엑셀처럼 범위 선택
/>`
    }
};



const STACK_DATA = [
    {
        id: 'vibe',
        name: '바이브 코딩 (Vibe Coding)',
        icon: faRobot,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        summary: "AI와 함께 춤추듯 코딩하는 최강 효율 조합",
        components: [
            { name: 'React', desc: 'AI 학습 데이터 1위' },
            { name: 'Tailwind CSS', desc: '스타일링 자동화' },
            { name: 'Firebase', desc: '서버 구축 0초' }
        ],
        bestFor: "1인 개발자, 스타트업, 빠른 프로토타이핑"
    },
    {
        id: 'enterprise',
        name: '엔터프라이즈 (Enterprise)',
        icon: faBuilding,
        color: 'text-blue-800',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        summary: "대규모 팀과 안정성이 최우선인 조합",
        components: [
            { name: 'Next.js', desc: '서버 사이드 렌더링' },
            { name: 'TypeScript', desc: '완벽한 타입 안정성' },
            { name: 'PostgreSQL', desc: '관계형 데이터베이스' }
        ],
        bestFor: "대기업, 금융권, 대규모 프로젝트"
    },
    {
        id: 'easy',
        name: '입문자 추천 (Easy Start)',
        icon: faSeedling,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        summary: "가장 배우기 쉽고 직관적인 조합",
        components: [
            { name: 'Vue.js', desc: 'HTML/CSS와 유사' },
            { name: 'Nuxt', desc: '설정이 필요 없는 프레임워크' },
            { name: 'Supabase', desc: '쉬운 오픈소스 파이어베이스' }
        ],
        bestFor: "코딩 입문자, 비전공자, 퍼블리셔 출신"
    },
    {
        id: 'speed',
        name: '속도광 (Performance)',
        icon: faBolt,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        summary: "극한의 성능과 가벼움을 추구하는 조합",
        components: [
            { name: 'Svelte', desc: '가상 돔 없는 리얼 DOM' },
            { name: 'SvelteKit', desc: '초경량 프레임워크' },
            { name: 'EdgeDB', desc: '차세대 그래프 DB' }
        ],
        bestFor: "고성능 대시보드, 인터랙티브 웹"
    }
];

const LibraryGuideViewer: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'library' | 'stack'>('library');
    const [selectedId, setSelectedId] = useState<LibraryId>('framer');
    const data = LIBRARY_DATA[selectedId];

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50">
            {/* Top Tabs */}
            <div className="bg-white border-b border-slate-200 px-6 pt-4 flex gap-4 shrink-0">
                <button
                    onClick={() => setActiveTab('library')}
                    className={`pb-4 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'library'
                        ? 'text-brand-600 border-brand-600'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                        }`}
                >
                    <FontAwesomeIcon icon={faThumbsUp} className="mr-2" />
                    추천 라이브러리
                </button>
                <button
                    onClick={() => setActiveTab('stack')}
                    className={`pb-4 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'stack'
                        ? 'text-brand-600 border-brand-600'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                        }`}
                >
                    <FontAwesomeIcon icon={faLayerGroup} className="mr-2" />
                    추천 조합 (Tech Stacks)
                </button>
            </div>

            {activeTab === 'library' ? (
                <div className="flex flex-1 overflow-hidden">
                    {/* 왼쪽 사이드바 (메뉴) */}
                    <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {(Object.keys(LIBRARY_DATA) as LibraryId[]).map((id) => (
                                <button
                                    key={id}
                                    onClick={() => setSelectedId(id)}
                                    className={`w-full text-left p-4 rounded-xl transition-all flex items-center gap-4 ${selectedId === id
                                        ? `${LIBRARY_DATA[id].bgColor} ${LIBRARY_DATA[id].color} ring-1 ring-inset ${LIBRARY_DATA[id].borderColor} shadow-sm`
                                        : 'hover:bg-slate-50 text-slate-600'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${selectedId === id ? 'bg-white/50' : 'bg-slate-100'
                                        }`}>
                                        <FontAwesomeIcon icon={LIBRARY_DATA[id].icon as any} />
                                    </div>
                                    <div>
                                        <div className="font-bold">{LIBRARY_DATA[id].name}</div>
                                        <div className="text-xs opacity-80 truncate w-40">
                                            {LIBRARY_DATA[id].analogy.title}
                                        </div>
                                    </div>
                                    {selectedId === id && (
                                        <FontAwesomeIcon icon={faArrowRight} className="ml-auto opacity-50" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 오른쪽 콘텐츠 영역 */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-10">
                        <div className="max-w-4xl mx-auto">
                            {/* 헤더 */}
                            <div className={`mb-8 p-8 rounded-2xl border ${data.bgColor} ${data.borderColor} text-center relative overflow-hidden`}>
                                <div className="absolute top-0 right-0 opacity-10 text-9xl transform translate-x-10 -translate-y-10">
                                    <FontAwesomeIcon icon={data.icon as any} />
                                </div>

                                <div className={`w-20 h-20 mx-auto mb-4 rounded-full bg-white flex items-center justify-center shadow-sm text-4xl ${data.color} relative z-10`}>
                                    <FontAwesomeIcon icon={data.icon as any} />
                                </div>
                                <h1 className="text-3xl font-bold text-slate-800 mb-2 relative z-10">{data.name}</h1>
                                <p className="text-lg text-slate-600 font-medium relative z-10">{data.summary}</p>

                                {/* 공식 사이트 링크 버튼 */}
                                {(data as any).link && (
                                    <a
                                        href={(data as any).link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-slate-700 text-sm font-bold shadow-sm hover:shadow-md transition-all relative z-10 border border-slate-200 hover:text-brand-600 hover:border-brand-200"
                                    >
                                        공식 사이트 구경하기
                                        <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
                                    </a>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* 1. 비유 (Analogy) */}
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500" />
                                        쉬운 비유 (Analogy)
                                    </h2>
                                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 h-full">
                                        <h3 className="font-bold text-lg text-slate-700 mb-2">{data.analogy.title}</h3>
                                        <p className="text-slate-600 leading-relaxed">
                                            <FontAwesomeIcon icon={faQuoteLeft} className="text-slate-300 mr-2" />
                                            {data.analogy.desc}
                                        </p>
                                    </div>
                                </div>

                                {/* 2. 장점 (Benefits) */}
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faCheckCircle as any} className="text-green-500" />
                                        왜 써야 할까요?
                                    </h2>
                                    <ul className="space-y-3">
                                        {data.benefits.map((benefit, index) => (
                                            <li key={index} className="flex items-start gap-3">
                                                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <span className="text-xs font-bold">{index + 1}</span>
                                                </div>
                                                <span className="text-slate-600">{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* 3. 코드 예시 (Example) */}
                                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-xl shadow-lg text-white">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-200">
                                        <FontAwesomeIcon icon={faCode} />
                                        어떻게 쓰나요? (Code Example)
                                    </h2>
                                    <pre className="bg-slate-800 p-4 rounded-lg overflow-x-auto font-mono text-sm text-blue-300 leading-relaxed">
                                        {data.example}
                                    </pre>
                                    <p className="mt-4 text-slate-400 text-sm text-center">
                                        * 실제로는 이것보다 조금 더 복잡하지만, 기본 원리는 이렇습니다!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-6 md:p-10">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-bold text-slate-800 mb-3">상황별 최적의 기술 조합</h2>
                            <p className="text-slate-600">어떤 기술을 써야 할지 고민되시나요? 상황에 딱 맞는 정답지를 드립니다.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {STACK_DATA.map((stack) => (
                                <div key={stack.id} className={`bg-white rounded-2xl border ${stack.borderColor} shadow-sm hover:shadow-lg transition-all overflow-hidden group`}>
                                    <div className={`p-6 ${stack.bgColor} border-b ${stack.borderColor}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl ${stack.color} shadow-sm`}>
                                                <FontAwesomeIcon icon={stack.icon as any} />
                                            </div>
                                            {stack.id === 'vibe' && (
                                                <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                                                    Best Choice
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-1">{stack.name}</h3>
                                        <p className="text-sm text-slate-600">{stack.summary}</p>
                                    </div>
                                    <div className="p-6">
                                        <div className="mb-6">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Components</h4>
                                            <div className="space-y-3">
                                                {stack.components.map((comp, idx) => (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <FontAwesomeIcon icon={faCheckCircle as any} className={`${stack.color} opacity-60`} />
                                                        <div>
                                                            <span className="font-bold text-slate-700 mr-2">{comp.name}</span>
                                                            <span className="text-xs text-slate-500">{comp.desc}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Best For</h4>
                                            <p className="text-slate-700 font-medium">{stack.bestFor}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LibraryGuideViewer;
