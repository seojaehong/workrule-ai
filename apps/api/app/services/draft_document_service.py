import re
from dataclasses import dataclass

from app.domain.schemas.documents import DraftGenerationRequest, DraftGenerationResult


_CLAUSE_PATTERN = re.compile(
    r"(?P<header>제\s*\d+\s*조(?:\s*의\s*\d+)?\s*(?:\([^)]+\))?)",
    flags=re.MULTILINE,
)


@dataclass
class ClauseSegment:
    article_key: str
    block: str
    leading_text: str


class DraftDocumentService:
    def generate(self, request: DraftGenerationRequest) -> DraftGenerationResult:
        segments, trailing_text = self._parse_segments(request.baseline_rule_text)
        segment_by_key = {segment.article_key: segment for segment in segments}

        applied_replacements = 0
        inserted_clauses = 0
        unresolved_findings: list[str] = []

        for finding in request.diagnosis_result.findings:
            clause_text = self._extract_clause_text(finding.suggested_text)
            article_key = (
                self._extract_article_key(clause_text)
                or self._extract_article_key(finding.clause_title)
                or self._extract_article_key(finding.current_text)
            )

            if article_key is None or clause_text is None:
                unresolved_findings.append(finding.clause_title)
                continue

            if article_key in segment_by_key:
                segment_by_key[article_key].block = clause_text
                applied_replacements += 1
                continue

            insert_index = self._find_insert_index(segments, article_key)
            inserted_segment = ClauseSegment(
                article_key=article_key,
                block=clause_text,
                leading_text="\n\n",
            )
            segments.insert(insert_index, inserted_segment)
            segment_by_key[article_key] = inserted_segment
            inserted_clauses += 1

        draft_body = self._render_segments(segments, trailing_text)
        draft_title = f"{request.company_name} 최신 취업규칙 초안"
        draft_markdown = (
            f"# {draft_title}\n\n"
            f"- 생성 기준: 2025 취업규칙 기준 + 2026 표준취업규칙 반영\n"
            f"- 검토 결과 반영 건수: {request.diagnosis_result.summary.total_findings}\n\n"
            f"{draft_body.strip()}\n"
        )

        return DraftGenerationResult(
            company_name=request.company_name,
            draft_title=draft_title,
            draft_markdown=draft_markdown,
            applied_replacements=applied_replacements,
            inserted_clauses=inserted_clauses,
            unresolved_findings=unresolved_findings,
        )

    def _parse_segments(self, text: str) -> tuple[list[ClauseSegment], str]:
        matches = list(_CLAUSE_PATTERN.finditer(text))
        if not matches:
            return [], text.strip()

        segments: list[ClauseSegment] = []
        previous_end = 0
        for index, match in enumerate(matches):
            start = match.start()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            leading_text = text[previous_end:start]
            block = text[start:end].strip()
            article_key = self._extract_article_key(match.group("header")) or f"segment-{index}"
            segments.append(
                ClauseSegment(
                    article_key=article_key,
                    block=block,
                    leading_text=leading_text,
                )
            )
            previous_end = end

        trailing_text = text[previous_end:]
        return segments, trailing_text

    def _render_segments(self, segments: list[ClauseSegment], trailing_text: str) -> str:
        chunks: list[str] = []
        for segment in segments:
            if segment.leading_text.strip():
                chunks.append(segment.leading_text.rstrip())
            chunks.append(segment.block.strip())

        if trailing_text.strip():
            chunks.append(trailing_text.strip())

        return "\n\n".join(chunk for chunk in chunks if chunk.strip())

    def _extract_clause_text(self, text: str) -> str | None:
        stripped = text.strip()
        if not stripped:
            return None
        return stripped

    def _extract_article_key(self, text: str) -> str | None:
        match = re.search(r"제\s*(\d+)\s*조(?:\s*의\s*(\d+))?", text)
        if not match:
            return None

        article = int(match.group(1))
        suffix = match.group(2)
        if suffix is None:
            return f"제{article}조"
        return f"제{article}조의{int(suffix)}"

    def _find_insert_index(self, segments: list[ClauseSegment], article_key: str) -> int:
        target = self._sort_key(article_key)
        for index, segment in enumerate(segments):
            if self._sort_key(segment.article_key) > target:
                return index
        return len(segments)

    def _sort_key(self, article_key: str) -> tuple[int, int]:
        match = re.search(r"제(\d+)조(?:의(\d+))?", article_key)
        if not match:
            return (10**9, 0)
        return (int(match.group(1)), int(match.group(2) or 0))
