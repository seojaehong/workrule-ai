# workrule-ai

기업의 기존 취업규칙을 최신 표준취업규칙과 대조해 조문 매핑, 법령 위반 가능성, 필수기재사항 누락, 개정 권고안을 구조화된 JSON으로 반환하는 HR SaaS 오픈소스 프로젝트입니다.

## Why this repo

- LLM이 자유 텍스트를 흘리지 않도록 하네스 중심 구조로 설계합니다.
- 결과는 반드시 스키마 검증을 통과해야 하며, 실패 시 모델에 오류를 되먹여 재시도합니다.
- 문서 입력, 프롬프트 구성, 검증, UI 렌더링을 느슨하게 분리해 제품화와 평가를 동시에 가능하게 합니다.

## Current scope

### `apps/api`
- FastAPI 백엔드
- OpenAI Responses API 연동
- Pydantic 기반 Output Validation Harness
- 문서 추출기: `txt`, `md`, `docx`, `pdf`, `hwpx`, `hwp`
- 스캔형 PDF용 OCR fallback (`Upstage Document Parse Standard` 기본)
- 추출 텍스트 정규화 레이어

### `apps/web`
- Next.js 16 App Router 프론트엔드
- 브랜드형 검토 워크스페이스 UI
- 문서 업로드 후 본문 자동 채우기
- 데모 결과 모드 + 실연동 모드

## Project structure

```text
workrule-ai/
├─ apps/
│  ├─ api/
│  │  ├─ app/
│  │  │  ├─ api/
│  │  │  ├─ core/
│  │  │  ├─ domain/
│  │  │  └─ services/
│  │  └─ tests/
│  └─ web/
│     └─ src/
├─ docs/
└─ README.md
```

## Run locally

### 1. API

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e .[dev]
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

기본값은 `LLM_MODE=mock` 이므로 OpenAI 키 없이도 진단 플로우를 눌러볼 수 있습니다.
실제 모델로 전환하려면 `apps/api/.env` 에서 `LLM_MODE=openai` 로 바꾸고 `OPENAI_API_KEY` 를 넣으면 됩니다.

스캔형 PDF OCR은 `LLM_MODE` 와 별개로 동작합니다.
기본값은 `INGESTION_OCR_PROVIDER=upstage` 이며, `UPSTAGE_API_KEY` 가 유효하면 텍스트 레이어가 없는 PDF 업로드 시 `Upstage Document Parse Standard` 로 자동 fallback 됩니다.
출력 형식은 `INGESTION_OCR_OUTPUT_FORMAT=markdown` 으로 설정되어 있어 조문/표 구조를 최대한 유지합니다.

### 2. Web

```powershell
cd apps/web
Copy-Item .env.local.example .env.local
npm.cmd install
npm.cmd run dev
```

## Quick test

루트에서 아래 두 명령만 실행하면 됩니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

- 브라우저 확인: `http://127.0.0.1:3000`
- 종료: `powershell -ExecutionPolicy Bypass -File .\scripts\stop-local.ps1`
- 로그: `evaluation/local-run/`
- 스모크 테스트 보고서: `evaluation/local-smoke/report.json`

## Validation flow

1. 문서를 업로드하거나 텍스트를 붙여 넣습니다.
2. Data Ingestion Harness가 텍스트를 추출하고 정규화합니다.
3. Prompt Harness가 리뷰 요청 컨텍스트를 조립합니다.
4. LLM이 구조화된 JSON을 생성합니다.
5. Output Validation Harness가 Pydantic으로 재검증합니다.
6. 실패 시 검증 오류를 모델에 다시 전달해 재시도합니다.

## Verification

- `apps/api`: `pytest`
- `apps/web`: `npm.cmd run lint`, `npm.cmd run build`

## Near-term roadmap

- HWP 바이너리 파서 또는 변환 워커 추가
- 조문 단위 chunking 및 매핑 정확도 평가셋 구축
- 결과 보고서 Markdown / DOCX 익스포트
- Supabase 저장 및 멀티테넌트 인증
