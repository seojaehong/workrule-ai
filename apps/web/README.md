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

## 환경변수

- `OPENAI_API_KEY`: 필수
- `OPENAI_MODEL`: 선택, 기본값 `gpt-5-mini`
- `KOREAN_LAW_MCP_URL`: 선택, Korean Law MCP 원격 URL
- `KOREAN_LAW_MCP_AUTHORIZATION`: 선택, MCP 인증 헤더가 따로 필요할 때 사용
- `APP_URL`: 선택, 배포 URL 표기용
