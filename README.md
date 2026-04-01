# workrule-ai

기업 취업규칙을 최신 표준취업규칙과 대조해 법령 위반, 누락, 개정 필요 사항을 구조화된 JSON으로 반환하는 HR SaaS의 초기 스캐폴딩이다.

## Step 1 범위

- 독립 저장소 초기화
- 모노레포형 디렉토리 구조 정의
- `FastAPI + Pydantic` 기반 백엔드 핵심 뼈대 구현
- `Output Validation Harness` 구현
- 검증 실패 시 재시도 루프 구현
- API 라우터, LLM 게이트웨이, 프롬프트 생성부 분리

## 제안 구조

```text
workrule-ai/
├─ apps/
│  ├─ api/
│  │  ├─ app/
│  │  │  ├─ api/
│  │  │  ├─ core/
│  │  │  ├─ domain/
│  │  │  └─ services/
│  │  ├─ tests/
│  │  └─ pyproject.toml
│  └─ web/
│     └─ README.md
├─ docs/
│  └─ step-1-scaffolding.md
└─ README.md
```

## 백엔드 실행

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e .[dev]
uvicorn app.main:app --reload
```

## 테스트

```powershell
cd apps/api
pytest
```

## 설계 메모

- 실제 제품에서는 `Data Ingestion Harness`, `Prompt Harness`, `Output Validation Harness`를 각각 독립 모듈로 유지한다.
- 이번 단계에서는 `Prompt Harness`와 `Output Validation Harness`의 연결 지점을 먼저 구현했다.
- OpenAI Structured Outputs를 사용하되, 애플리케이션 레벨에서 Pydantic 재검증과 재시도를 한 번 더 수행한다.

