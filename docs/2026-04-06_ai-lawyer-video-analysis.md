# 2026-04-06 AI 변호사 영상 분석 및 구현 메모

## 영상 핵심

- 대상 영상: [나만의 인공지능 AI 변호사를 가져보세요](https://www.youtube.com/watch?v=GX0qaErlZuY)
- 채널: `코드깎는노인`
- 공개일: `2026-04-04`
- 확인한 영상 설명 핵심:
  - `cokacdir`
  - `Korean Law MCP`
  - "언제나 나만을 위해 대기하고 조언해주는 AI 변호사"

## 구현 해석

이번 구현에서는 영상을 그대로 복제하기보다, 영상이 전달하는 제품 메시지를 `Vercel에 바로 올릴 수 있는 웹 MVP`로 번역했다.

- `cokacdir`는 원격 제어/운영 도구로 보고 웹 MVP에는 직접 넣지 않았다.
- 제품의 핵심은 `Korean Law MCP`를 모델의 도구로 붙여 법령/판례/해석례를 조회하는 흐름이라고 판단했다.
- 기존 `workrule-ai/apps/web`의 취업규칙 대조 UI는 영상 방향과 맞지 않아, 개인 AI 법률비서 워크스페이스로 재구성했다.

## 적용한 구조

### 프론트엔드

- 기존 입력 중심 비교 화면을 `사건 개요 + 질문 + 답변 + 참고 근거` 구조로 변경
- 메인 메시지를 "내 상황을 이해하고 관련 법령과 판례를 먼저 찾아주는 AI 법률비서"로 통일
- 우측 패널에 아래 정보를 분리해 표시
  - 참고 근거 카드
  - MCP 도구 사용 흐름
  - 주의 문구 및 fallback 메모

### 서버 라우트

- `apps/web/src/app/api/chat/route.ts` 추가
- OpenAI Responses API를 호출하면서 `tools[].type = "mcp"`로 remote MCP server 연결
- 우선 제한된 `allowed_tools`로 시도하고, 실패하면
  1. 전체 MCP 도구로 재시도
  2. 그래도 실패하면 일반 AI 응답으로 fallback
- 환경변수 누락 시 사용자에게 바로 이해되는 오류를 반환

### 환경변수

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `KOREAN_LAW_MCP_URL`
- `KOREAN_LAW_MCP_AUTHORIZATION` 선택
- `APP_URL` 선택

## 참고한 외부 문서

- OpenAI 공식 문서: [MCP and Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp/)
  - `Responses API`에서 `mcp` 도구 타입으로 remote MCP server를 붙일 수 있음
  - `server_url`, `authorization`, `allowed_tools`, `require_approval` 패턴 확인
- Korean Law MCP README:
  - 공개 원격 주소 예시 `https://korean-law-mcp.fly.dev/mcp?...`
  - `profile=lite` 사용 가능
  - 대표 도구 예시 `chain_full_research`, `search_law`, `get_law_text`, `search_precedents`

## 남은 운영 포인트

- 현재 로컬/배포 환경에는 `OPENAI_API_KEY`가 없어서 live 질의 응답까지는 검증하지 못했다.
- 실제 운영 시에는 Vercel 환경변수에 OpenAI 키와 Korean Law MCP URL을 넣어야 한다.
- Korean Law MCP가 URL 쿼리 `oc` 방식을 지원하므로, 가장 간단한 배포는 `KOREAN_LAW_MCP_URL`에 완성된 URL을 그대로 넣는 방식이다.
