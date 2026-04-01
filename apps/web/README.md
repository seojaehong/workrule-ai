# WorkRule AI Web

Next.js App Router 기반 프론트엔드입니다.

## 현재 포함 기능

- 고급 워크스페이스형 UI
- 회사 취업규칙 / 표준취업규칙 텍스트 입력
- `txt`, `md`, `docx`, `pdf`, `hwpx` 파일 업로드 후 본문 추출
- 백엔드 프록시 라우트
- 데모 결과 패널과 실시간 진단 패널 공존

## 실행

```powershell
Copy-Item .env.local.example .env.local
npm.cmd install
npm.cmd run dev
```

기본 백엔드 주소는 `http://127.0.0.1:8000` 입니다.
