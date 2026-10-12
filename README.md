# StyleLens

웹사이트 URL에서 공개 HTML·CSS 스타일을 추출해 편집 가능한 가이드로 정리하는 도구입니다.

## 배포 구성

- GitHub Pages: https://leejinho970715-star.github.io/style_lens/
- 분석 API: https://stylelens-design-guide.leejinho970715.chatgpt.site/api/analyze
- 같은 React 화면을 Pages 정적 빌드와 Sites 서버 빌드가 공유합니다.
- `main`에 push하면 GitHub Actions가 타입 검사·테스트·정적 빌드 후 Pages를 업데이트합니다.
- 분석 서버의 변경은 Sites 워크플로를 통해 별도로 배포해야 합니다. GitHub Pages는 서버 코드를 실행하지 않습니다.

## 개발

```sh
npm ci
npm run dev
npm test
npm run build:pages
npm run build
```

Node 24를 사용합니다. `app/page.tsx`는 화면, `lib/analyzer.ts`는 분석 엔진, `app/api/analyze/route.ts`는 공개 분석 API입니다. `vite.pages.config.ts`에서 Pages base 경로와 공개 API 주소를 설정합니다.

## 기능

색상·HEX·Typography·SVG 아이콘·컴포넌트 선언값·간격·Radius·Shadow·Media Query·CSS Custom Properties 추출, 색상 역할/이름/값 편집, 원본 복원, JSON/CSS/Markdown/HTML/PDF(인쇄)/PNG 내보내기.

## 분석 범위

공개 HTML/CSS **선언값** 분석이며, JavaScript를 실행하는 브라우저 렌더링 분석이 아닙니다. 발견 횟수는 선언값의 출현 횟수이며 화면 사용량이 아닙니다. 폰트의 실제 로딩, 동적 화면, 이미지 스프라이트, hover 실행 결과, 완전한 CSS cascade는 확인하지 않습니다. 역할 추천은 초안입니다. 각 결과에 원본 source·selector·조건을 보관합니다.

최대 8개 외부 CSS 및 일부 @import, 16,000개 선언, 제한된 SVG를 읽습니다. 일부 자료가 읽히지 않으면 보고서에 표시합니다. 사설·루프백 주소, 인증 정보 포함 주소, 비표준 포트 및 비웹 프로토콜을 거부하고 DNS/리다이렉트·응답 크기를 확인합니다. SVG의 스크립트·이벤트·외부 참조를 제거합니다. 분석 결과는 서버 DB에 저장하지 않습니다. API 요청은 분당 한도를 적용합니다.

Pretendard: OFL-1.1, 라이선스 `public/fonts/LICENSE.txt`. 원본 사이트의 폰트/아이콘은 자동 재배포하지 않으며 이용 조건은 별도로 확인해야 합니다.
