# InvestView 모바일 앱 설정 가이드

## 전체 구조

```
investment-helper/
├── api/                    ← Vercel 백엔드 (주가 API + 크론 + 기기 등록)
├── src/App.jsx             ← 웹 앱 (Vercel에 배포)
├── mobile/                 ← 네이티브 모바일 앱 (여기!)
│   ├── App.js              ← 메인 앱 (WebView + 푸시 알림)
│   ├── app.json            ← Expo 설정
│   └── eas.json            ← EAS 빌드 설정
└── vercel.json             ← 크론 스케줄 (5분마다)
```

## 작동 원리

1. **모바일 앱** (Expo): WebView로 웹 앱을 보여주고, 네이티브 푸시 알림을 처리합니다
2. **웹 앱** (Vercel): 차트, 대시보드 등 UI를 제공합니다
3. **백엔드 크론** (Vercel): 5분마다 주가를 체크하고, MA 교차 시 푸시 알림을 보냅니다
4. **Vercel KV** (Redis): 기기 정보와 관심종목을 저장합니다

## 비용

| 서비스 | 비용 | 용도 |
|--------|------|------|
| Vercel Pro | $20/월 | 5분 크론 잡 (무료는 하루 1회만) |
| Apple Developer | $99/년 | 앱 배포 (TestFlight/App Store) |
| Expo EAS | 무료 | 클라우드 빌드 (Mac 불필요!) |
| Vercel KV | 무료 | 기기 등록 데이터 저장 |
| Yahoo Finance | 무료 | 주가 데이터 |

**총: 약 $28/월 + $99/년**

## 설정 순서

### Step 1: 사전 준비

```bash
# Node.js 설치 (없는 경우)
# https://nodejs.org 에서 LTS 버전 다운로드

# Expo CLI 설치
npm install -g expo-cli eas-cli

# Expo 계정 생성
npx expo login
# 또는 https://expo.dev 에서 회원가입
```

### Step 2: Apple Developer 가입

1. https://developer.apple.com 접속
2. "Enroll" 클릭 → $99/년 결제
3. 승인까지 1-2일 소요

### Step 3: Vercel 배포 (웹 앱 + 백엔드)

```bash
# Vercel CLI 설치
npm install -g vercel

# 프로젝트 루트에서 배포
cd investment-helper
vercel --prod

# 배포된 URL 확인 (예: https://investment-helper-xxxx.vercel.app)
```

### Step 4: Vercel KV 설정

1. https://vercel.com 로그인
2. 프로젝트 선택 → **Storage** 탭
3. **Create Database** → **KV** 선택
4. 이름: `investview-kv` → **Create**
5. **Connect to Project** 클릭
6. 환경변수 `KV_REST_API_URL`, `KV_REST_API_TOKEN`이 자동 설정됩니다

### Step 5: 환경변수 설정

Vercel Dashboard → 프로젝트 → **Settings** → **Environment Variables**:

```
CRON_SECRET = (아무 랜덤 문자열, 예: abc123xyz)
```

### Step 6: Vercel Pro 업그레이드 (크론 5분)

1. Vercel Dashboard → **Settings** → **Billing**
2. **Pro** 플랜 선택 ($20/월)
3. 이미 설정된 크론이 5분 간격으로 자동 실행됩니다

### Step 7: 모바일 앱 설정

```bash
cd investment-helper/mobile

# 의존성 설치
npm install

# app.json에서 URL 수정
# App.js 상단의 WEB_APP_URL을 실제 Vercel URL로 변경

# Expo 프로젝트 초기화 (EAS 연결)
eas init
# → 생성된 projectId를 app.json의 extra.eas.projectId에 입력
```

### Step 8: iOS 앱 빌드

```bash
# 개발 빌드 (시뮬레이터용)
eas build --platform ios --profile development

# 프리뷰 빌드 (실기기 테스트용, TestFlight 없이)
eas build --platform ios --profile preview

# 프로덕션 빌드 (TestFlight/App Store용)
eas build --platform ios --profile production
```

첫 빌드 시 Apple Developer 계정 로그인이 필요합니다.
EAS가 인증서와 프로비저닝 프로파일을 자동으로 관리합니다.

### Step 9: TestFlight 배포 (친구들에게 공유)

```bash
# App Store Connect에 제출
eas submit --platform ios

# 또는 빌드와 제출을 한 번에
eas build --platform ios --profile production --auto-submit
```

그 다음:
1. https://appstoreconnect.apple.com 접속
2. **TestFlight** 탭 선택
3. **External Testing** → 그룹 생성 → 친구 이메일 추가
4. 친구들이 TestFlight 앱 설치 후 초대 수락

### Step 10: 앱 사용!

1. TestFlight에서 InvestView 설치
2. 앱 실행 → 알림 권한 허용
3. 관심종목 선택 → 시작하기
4. 5분마다 자동으로 주가 체크 → MA 교차 시 푸시 알림!

## 문제 해결

### 푸시 알림이 안 올 때

1. iPhone 설정 → InvestView → 알림 허용 확인
2. Vercel Dashboard → Cron에서 실행 로그 확인
3. KV에 기기가 등록되었는지 확인:
   - Vercel Dashboard → Storage → KV → Browse

### 크론이 실행 안 될 때

- Vercel Pro 플랜인지 확인 (Hobby는 하루 1회만)
- `vercel.json`의 crons 설정 확인
- Vercel Dashboard → Settings → Crons에서 상태 확인

### 한국 주식 데이터가 안 나올 때

- 한국 주식은 Yahoo에서 `.KS` 접미사가 필요합니다
- API가 자동으로 6자리 숫자 → `.KS` 변환을 합니다
- 코스닥 종목은 `.KQ` 접미사가 필요할 수 있습니다 (추후 지원)
