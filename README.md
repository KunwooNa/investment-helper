# InvestView - 투자 도우미 앱

10일 이동평균선 교차 전략을 기반으로 매수/매도 신호를 자동 감지하는 투자 도우미 앱입니다.

## 주요 기능

- **관심종목 선택** — 앱 시작 시 추적할 종목을 검색하고 선택
- **포트폴리오 대시보드** — 총 평가금액, 수익률, 보유종목 현황
- **차트 분석** — 종가 + 10일 이동평균선 차트, 매매 신호 표시
- **매매 신호** — MA 교차 시 자동 매수/매도 알림
- **모바일 최적화** — iPhone/Android에서 네이티브 앱처럼 사용 가능

## 로컬 실행 방법

Node.js (18+)가 설치되어 있어야 합니다.

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행
npm run dev

# 3. 브라우저에서 열기
# http://localhost:3000
```

## Vercel 배포 (친구에게 공유하기)

### 방법 1: Vercel CLI (가장 빠름)

```bash
# 1. Vercel CLI 설치
npm install -g vercel

# 2. 배포
vercel

# 3. 완료! URL이 생성됩니다 (예: investview-abc123.vercel.app)
```

### 방법 2: GitHub + Vercel (추천)

```bash
# 1. GitHub 저장소 생성 후 코드 푸시
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/investview.git
git push -u origin main

# 2. vercel.com 접속 → "New Project" → GitHub 저장소 연결
# 3. "Deploy" 클릭 → 완료!
```

### 방법 3: Netlify

```bash
# 1. 빌드
npm run build

# 2. netlify.com 접속 → dist 폴더를 드래그 앤 드롭
```

## iPhone 홈 화면에 추가하기

배포 후 iPhone Safari에서 URL 접속 → 공유 버튼(⬆️) → "홈 화면에 추가" → 네이티브 앱처럼 사용!

## 기술 스택

- React 18 + Vite
- Recharts (차트)
- 반응형 디자인 (모바일 우선)

## 프로젝트 구조

```
investview/
├── index.html          # 진입 HTML
├── package.json        # 의존성
├── vite.config.js      # Vite 설정
├── public/
│   └── favicon.svg     # 앱 아이콘
└── src/
    ├── main.jsx        # React 진입점
    └── App.jsx         # 메인 앱 컴포넌트
```