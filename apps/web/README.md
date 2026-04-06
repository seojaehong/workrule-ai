# AI Legal Desk Web

Next.js App Router 기반 개인 AI 법률비서 프론트엔드입니다.

## 현재 포함 기능

- 사건 개요 + 질문 입력 워크스페이스
- OpenAI Responses API 기반 질의 응답
- Korean Law MCP 연동을 통한 법령/판례/해석례 조회 시도
- 참고 근거 카드, 도구 사용 흐름, fallback 안내 패널
- Vercel 배포 가능한 `/api/chat` 서버리스 라우트

## 실행

```powershell
Copy-Item .env.local.example .env.local
npm.cmd install
npm.cmd run dev
```

`Copy-Item` 후에는 `.env.local` 안의 실제 키 값을 채워야 합니다.

## 환경변수

- `OPENAI_API_KEY`: 필수
- `OPENAI_MODEL`: 선택, 기본값 `gpt-5-mini`
- `KOREAN_LAW_MCP_URL`: 선택, Korean Law MCP 원격 URL
- `KOREAN_LAW_MCP_AUTHORIZATION`: 선택, MCP 인증 헤더가 따로 필요할 때 사용
- `APP_URL`: 선택, 배포 URL 표기용

## 실제로 넣을 값

### 1. 로컬 개발용

파일: `apps/web/.env.local`

```env
OPENAI_API_KEY=실제OpenAI키
OPENAI_MODEL=gpt-5-mini
KOREAN_LAW_MCP_URL=https://korean-law-mcp.fly.dev/mcp?profile=lite&oc=iceamericano9
APP_URL=http://127.0.0.1:3000
```

### 2. Vercel 배포용

Vercel 프로젝트의 Environment Variables에 아래 값을 넣으면 됩니다.

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
  - 권장값: `gpt-5-mini`
- `KOREAN_LAW_MCP_URL`
  - 권장값: `https://korean-law-mcp.fly.dev/mcp?profile=lite&oc=iceamericano9`
- `APP_URL`
  - 예: 배포 URL 또는 커스텀 도메인

### 3. 각 값의 의미

- `OPENAI_API_KEY`
  - `/api/chat`에서 OpenAI Responses API를 호출할 때 사용
- `KOREAN_LAW_MCP_URL`
  - 한국 법령 MCP 서버 주소
  - 현재 OC 값 `iceamericano9`를 붙인 lite 프로필 URL을 사용하면 됨
- `OPENAI_MODEL`
  - 답변 생성 모델
- `APP_URL`
  - 서비스 기본 URL 표기용
