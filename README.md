# InvestView - 투자 도우미 앱

10일 이동평균선 교차 전략을 기반으로 매수/매도 신호를 자동 감지하는 투자 도우미 PWA 앱입니다.

## 주요 기능

- **관심종목 선택** — 앱 시작 시 추적할 종목을 검색하고 선택
- **포트폴리오 대시보드** — 총 평가금액, 수익률, 보유종목 현황
- **차트 분석** — 종가 + 10일 이동평균선 차트, 매매 신호 표시
- **매매 신호** — MA 교차 시 자동 매수/매도 알림
- **PWA** — 홈 화면 설치, 오프라인 지원, 전체화면 앱 모드
- **모바일 최적화** — iPhone/Android에서 네이티브 앱처럼 사용

## 로컬 실행

```bash
npm install
npm run dev
# → http://localhost:3000
```

## 배포 (친구에게 공유하기)

### GitHub + Vercel (추천)

1. GitHub에 코드를 push합니다
2. [vercel.com](https://vercel.com) 접속 → "New Project" → GitHub 저장소 연결
3. "Deploy" 클릭 → 완료!
4. `your-app.vercel.app` URL을 친구에게 공유

### Vercel CLI

```bash
npm install -g vercel
vercel
```

## iPhone에 앱 설치하기

1. 배포된 URL을 iPhone Safari에서 열기
2. 하단 공유 버튼(⬆️) 탭
3. "홈 화면에 추가" 선택
4. 네이티브 앱처럼 전체화면으로 사용!

## 기술 스택

- React 18 + Vite
- Recharts (차트 라이브러리)
- PWA (Service Worker + Web App Manifest)
- 반응형 디자인 (모바일 우선)

## 프로젝트 구조

```
investment-helper/
├── index.html            # PWA 등록 포함 진입 HTML
├── package.json
├── vite.config.js
├── public/
│   ├── favicon.svg
│   ├── manifest.json     # PWA 매니페스트
│   ├── sw.js             # Service Worker (오프라인)
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── src/
    ├── main.jsx
    └── App.jsx           # 메인 앱 (관심종목 + 대시보드 + 차트)
```