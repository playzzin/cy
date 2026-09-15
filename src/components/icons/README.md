# CY 업무 아이콘

청연ENG ERP의 현장·인력, 급여·정산, 자원·업무, 공통 동작을 위한 자체 제작 SVG 32종입니다.
24 × 24 좌표, 1.75 두께, 둥근 선 끝을 공유합니다. `outline`과 `duotone` 두 가지 스타일을 제공합니다.

## 미리보기 및 파일

- 개발 서버에서 `/icons/cy/index.html`을 열거나 `public/icons/cy/index.html`을 직접 엽니다.
- 아이콘만 미리 보려면 `node scripts/preview-cy-icons.cjs` 실행 후 `http://127.0.0.1:4187`을 엽니다.
- 검색, 16/20/24/32/48px, 밝은/어두운 배경, SVG 저장 및 복사를 지원합니다.
- 개별 SVG: `public/icons/cy/{outline,duotone}/{name}.svg`
- 스프라이트: `public/icons/cy/sprite-{outline,duotone}.svg`
- 원본: `src/components/icons/cy-icon-catalog.json`
- 원본이나 미리보기 템플릿 수정 후 `node scripts/generate-cy-icons.cjs`로 정적 파일을 재생성합니다.

## React 사용

```tsx
import { CyIcon } from './components/icons';

// 글자색 상속. 옆에 레이블이 있으면 기본 장식용 아이콘을 사용합니다.
<button type="button">
  <CyIcon name="daily-report" size={20} />
  일보 작성
</button>

// 청연 컬러를 적용한 듀오톤
<CyIcon name="site" size={32} color="#2563eb" accent="#0891b2" />

// 단색 / 독립적인 의미가 있는 아이콘
<CyIcon name="approval" variant="outline" title="승인 완료" />

// 아이콘만 있는 버튼에는 버튼 자체에 이름을 붙입니다.
<button type="button" aria-label="검색">
  <CyIcon name="search" size={20} />
</button>
```

`name`은 타입 검사로 검증됩니다. `className`, `style`, `aria-label`, `ref` 등의 SVG 속성을 지원합니다.
기본적으로 부모의 `currentColor`를 사용하며, 듀오톤 강조색은 `accent` 또는 CSS의 `--cy-icon-accent`로 지정합니다.
선택/비활성 상태는 부모의 `color`, `opacity`로 표현할 수 있습니다.

## 일반 HTML 사용

```html
<!-- 외부 이미지의 색상은 부모의 CSS color를 상속하지 않습니다. 기본은 검정입니다. -->
<img src="/icons/cy/outline/site.svg" width="24" height="24" alt="현장 관리">

<!-- 같은 출처의 스프라이트를 사용하면 부모 색상과 강조색을 적용할 수 있습니다. -->
<svg width="24" height="24" viewBox="0 0 24 24"
     style="color:#2563eb; --cy-icon-accent:#0891b2" aria-hidden="true">
  <use href="/icons/cy/sprite-duotone.svg#cy-site"></use>
</svg>
```

스프라이트 사용은 HTTP 개발 서버에서 확인합니다. SVG 복사·저장은 재사용할 수 있도록 현재 테마의 색상을 굳히지 않고 `currentColor`를 유지합니다.
기존 Font Awesome/Lucide 아이콘과 파비콘은 자동으로 교체하지 않습니다. 필요한 화면에서 `CyIcon`을 가져와 사용합니다.
