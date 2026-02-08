# InvestView - 투자 도우미 앱

10일 이동평균선 교차 전략을 기반으로 매수/매도 신호를 자동 감지하는 투자 도우미 PWA 앱입니다.

## 주요 기능

- **실시간 주가 데이터** — Yahoo Finance API 연동 (3중 폴백 지원)
- **관심종목 선택** — 앱 시작 시 추적할 종목을 검색하고 선택
- **포트폴리오 대시보드** — 총 평가금액, 수익률, 보유종목 현황
- **차트 분석** — 종가 + 10일 이동평균선 차트, 매매 신호 표시
- **매매 신호** — MA 교차 시 자동 매수/매도 알림
- **PWA** — 홈 화면 설치, 오프라인 지원, 전체화면 앱 모드
- **모바일 최적화** — iPhone/Android에서 네이티브 앱처럼 사용

## 데이터 소스 (3중 폴백)

| 우선순위 | API | 무료 제한 | 유료 가격 | 비고 |
|---------|-----|----------|----------|------|
| 1순위 | Yahoo Finance | 무제한 | 무료 | API 키 불필요 |
| 2순위 | Alpha Vantage | 25건/일 | $50/월 | API 키 필요 |
| 3순위 | Financial Modeling Prep | 250건/일 | $19/월 | API 키 필요 |

Yahoo가 정상이면 다른 API는 사용되지 않습니다. Yahoo가 차단되면 자동으로 다음 API로 전환됩니다.

## 로컬 실행

```bash
npm install
npm run dev
# → http://localhost:3000
```

## 배포 (Vercel)

```bash
# 1. GitHub에 push 후
# 2. vercel.com → New Project → GitHub 연동 → Deploy

# 3. (선택) API 키 설정: Vercel 대시보드 → Settings → Environment Variables
#    ALPHA_VANTAGE_KEY=your_key_here
#    FMP_KEY=your_key_here
```

## API 키 발급 방법 (선택사항)

Yahoo Finance만으로 충분하지만, 백업용으로 설정해두면 안정적입니다.

**Alpha Vantage:**
1. https://www.alphavantage.co/support/#api-key 접속
2. 무료 API 키 발급 (이메일만 필요)
3. Vercel 환경변수에 `ALPHA_VANTAGE_KEY` 추가

**Financial Modeling Prep:**
1. https://site.financialmodelingprep.com/developer/docs 접속
2. 회원가입 후 무료 API 키 발급
3. Vercel 환경변수에 `FMP_KEY` 추가

## iPhone에 앱 설치하기

1. 배포된 URL을 iPhone Safari에서 열기
2. 하단 공유 버튼 탭
3. "홈 화면에 추가" 선택
4. 네이티브 앱처럼 전체화면으로 사용!

## 프로젝트 구조

```
investment-helper/
├── api/                  # Vercel Serverless Functions
│   ├── history.js        # 주가 히스토리 (3중 폴백)
│   ├── quote.js          # 현재가 조회 (3중 폴백)
│   └── search.js         # 종목 검색
├── public/
│   ├── manifest.json     # PWA 매니페스트
│   ├── sw.js             # Service Worker
│   └── icons/            # 앱 아이콘
├── src/
│   ├── main.jsx          # React 진입점
│   └── App.jsx           # 메인 앱
├── index.html
├── package.json
├── vercel.json           # Vercel 라우팅 설정
└── .env.example          # 환경변수 예시
```