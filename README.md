# 🚀 GA4 Content Grouping Tool

**GA4 데이터를 AI로 자동 분석하여 한글 콘텐츠 그룹핑을 수행하는 웹 애플리케이션**

> Google Analytics 4 데이터를 수집하고, AI를 활용해 URL을 한글로 번역하며, 개인화된 URL을 자동으로 그룹핑합니다.

## ✨ 주요 기능

- 🔐 **Google OAuth 2.0 로그인** - 팀 계정으로 안전한 인증
- 🏢 **GA4 계정/속성 자동 선택** - Admin API를 통한 계층적 선택
- 📊 **실시간 데이터 수집** - GA4 Reporting API v4 연동
- 🤖 **AI 기반 URL 분석** - Claude/OpenAI를 활용한 스마트 그룹핑
- 🎯 **개인화 URL 감지** - 세션/사용자별 URL 자동 그룹화
- 🌐 **한글 번역** - AI 기반 컨텍스트 인식 번역
- 📁 **다양한 내보내기** - Excel, CSV, Google Sheets 지원

## 🚀 빠른 시작

### 1. 저장소 클론 및 설치
```bash
git clone https://github.com/team-hurdlers/auto-contents-grouping.git
cd auto-contents-grouping
npm install
```

### 2. Google Cloud 프로젝트 설정

1. **[Google Cloud Console](https://console.cloud.google.com)** 에서 새 프로젝트 생성
2. **API 및 서비스** → **라이브러리**에서 다음 API 활성화:
   ```
   ✅ Google Analytics Data API
   ✅ Google Analytics Admin API  
   ✅ Google Sheets API
   ✅ Google Drive API
   ```

3. **사용자 인증 정보** → **OAuth 2.0 클라이언트 ID** 생성:
   - 애플리케이션 유형: `웹 애플리케이션`
   - 승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback`

### 3. 환경 변수 설정

`.env` 파일 생성:
```env
# Google OAuth 설정
GOOGLE_CLIENT_ID=your_client_id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret

# Service Account (선택사항 - OAuth 사용시 불필요)
# GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# AI API 키
ANTHROPIC_API_KEY=sk-ant-your_api_key_here
# 서버 설정
PORT=3000
SESSION_SECRET=ga4-content-grouping-secret-key-change-this
```

> 💡 **팀 내부용 설정**: 위 설정은 허들러스 팀 내부 서버용입니다. 
> 외부 배포시에는 새로운 OAuth 클라이언트와 API 키를 생성하세요.

### 4. 서버 실행 및 접속
```bash
npm start
```
브라우저에서 `http://localhost:3000` 접속

## 📝 사용법

### 1단계: Google 계정 로그인
- **Google 계정으로 로그인** 버튼 클릭
- 팀의 Google 계정으로 인증 (GA4 접근 권한 필요)

### 2단계: GA4 계정 및 속성 선택  
- 좌측에서 **애널리틱스 계정** 선택
- 우측에서 분석할 **속성** 선택
- **이 속성으로 분석 시작** 클릭

### 3단계: 데이터 수집 설정
```
📅 기간 설정: 최근 7일/30일/90일 또는 사용자 지정
🎯 필터 설정: 최소 조회수, 포함/제외 경로
🌐 웹사이트 컨텍스트: AI 번역 정확도 향상을 위한 사이트 설명
```

### 4단계: AI 분석 및 그룹핑
- **🚀 데이터 가져오기** → 기본 데이터 수집
- **⚡ AI URL 분석 및 정리** → 스마트 그룹핑 실행
  - 개인화 URL 자동 감지 (세션ID, 사용자ID 등)
  - 중복 URL 제거
  - 의미 있는 URL만 남김

### 5단계: 결과 확인 및 내보내기
- 한글 매핑 결과 검토 및 수정
- **📊 Excel/📄 CSV/📋 Google Sheets** 내보내기

## 🛠 문제 해결

### 로그인/인증 오류
```bash
❌ "Google 계정으로 로그인해주세요"
→ OAuth 클라이언트 ID 및 시크릿 확인
→ 리디렉션 URI가 정확한지 확인
```

### GA4 데이터 접근 오류  
```bash
❌ "GA4 Admin API 접근 권한이 없습니다"
→ GA4 속성에 계정 권한 부여 확인
→ Google Analytics Admin API 활성화 확인
```

### AI 번역 오류
```bash
❌ AI API 호출 실패
→ ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 확인
→ API 잔액/할당량 확인
```

## 🏗 프로젝트 구조

```
📦 auto-contents-grouping/
├── 🔧 server.js                 # Express 메인 서버
├── 📁 routes/                   # API 엔드포인트
│   ├── analyticsAdmin.js        # GA4 Admin API 라우트
│   ├── admin.js                 # 계정/속성 관리
│   └── urlProcessor.js          # AI URL 분석
├── 🔧 services/                 # 비즈니스 로직
│   ├── analyticsAdminServiceV2.js # GA4 서비스
│   └── sheetsService.js         # Google Sheets 연동
├── 🎨 public/                   # 프론트엔드
│   ├── index.html               # 메인 UI (GA4 스타일)
│   ├── app.js                   # 프론트엔드 로직
│   └── style.css                # GA4 스타일링
├── ⚙️ config/                   # 설정 및 캐시
│   └── url-mapping.json         # AI 번역 캐시
└── 🔐 .env                      # 환경변수 (생성 필요)
```

## 🚀 개발 환경

### 개발 서버 실행
```bash
npm run dev  # nodemon으로 자동 재시작
```

### 패키지 스크립트
```bash
npm start       # 프로덕션 서버 시작
npm run dev     # 개발 서버 (파일 변경시 자동 재시작)  
npm test        # 테스트 실행
```

## 🔐 보안 주의사항

⚠️ **절대 Git에 커밋하지 말 것:**
- `.env` 파일 (환경변수)
- `config/` 폴더 (자동 생성되는 캐시)
- Google OAuth 인증 정보

✅ **포함된 보안 설정:**
- CORS 설정으로 출처 제한
- 세션 기반 인증
- API 키 환경변수 분리

## 📈 성능 최적화

- **AI 번역 캐시**: `config/url-mapping.json`에 번역 결과 저장
- **세션 관리**: Express 세션으로 OAuth 토큰 관리  
- **API 호출 최적화**: GA4 API 페이지네이션 지원

## 🤝 기여하기

1. Fork 후 브랜치 생성
2. 기능 개발 및 테스트
3. Pull Request 생성

## 📄 라이선스

MIT License

---

**🏢 Developed by Team Hurdlers**  
*GA4 데이터 분석을 더 쉽고 스마트하게*# auto-contents-grouping
