# Step 1 Scaffolding Note

## 왜 FastAPI + Pydantic인가

- 취업규칙 검토 결과는 최종적으로 엄격한 JSON 구조를 가져야 한다.
- Pydantic `BaseModel` 하나로 API 입출력 스키마와 LLM 출력 검증 스키마를 통일할 수 있다.
- 추후 배치 작업, 문서 파싱 파이프라인, 비동기 큐를 붙일 때 Python 생태계가 유리하다.

## 책임 분리

### `app/api`
- HTTP 엔드포인트
- 의존성 주입
- 외부 요청/응답 모델 바인딩

### `app/services/prompt_harness.py`
- 시스템 프롬프트와 사용자 프롬프트를 조립
- 향후 3단계 프롬프트 체계로 확장

### `app/services/llm/openai_gateway.py`
- OpenAI API 통신만 담당
- 비즈니스 규칙과 분리

### `app/services/output_validation_harness.py`
- 응답 JSON 파싱
- Pydantic 검증
- 실패 시 에러 메시지를 LLM에게 되먹임

### `app/services/review_service.py`
- 요청 컨텍스트를 받아 전체 하네스를 orchestration

## 다음 Step 권장 순서

1. `Data Ingestion Harness` 추가
2. 프론트엔드 Next.js 업로드 UI 생성
3. HWP/PDF/DOCX 텍스트 추출기 연결
4. 평가용 샘플 문서 셋과 회귀 테스트 추가

