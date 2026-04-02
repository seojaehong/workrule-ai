import json
import re
from dataclasses import asdict, dataclass


_CLAUSE_PATTERN = re.compile(
    r"(?P<header>제\s*\d+\s*조(?:\s*의\s*\d+)?\s*(?:\([^)]+\))?)",
    flags=re.MULTILINE,
)


@dataclass(frozen=True)
class ParsedClause:
    article_key: str
    header: str
    body: str

    @property
    def snippet(self) -> str:
        compact = self.body.replace("\n", " ").strip()
        return compact[:280]


@dataclass(frozen=True)
class ClauseComparisonCandidate:
    article_key: str
    status: str
    company_header: str | None
    standard_header: str | None
    company_snippet: str | None
    standard_snippet: str | None


@dataclass(frozen=True)
class ReviewPreprocessResult:
    company_clause_count: int
    standard_clause_count: int
    shared_clause_count: int
    clause_candidates: list[ClauseComparisonCandidate]

    def to_prompt_json(self) -> str:
        payload = {
            "company_clause_count": self.company_clause_count,
            "standard_clause_count": self.standard_clause_count,
            "shared_clause_count": self.shared_clause_count,
            "clause_candidates": [asdict(candidate) for candidate in self.clause_candidates],
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)


class ReviewPreprocessor:
    def build(self, *, company_rule_text: str, standard_rule_text: str) -> ReviewPreprocessResult:
        company_clauses = self._parse_clauses(company_rule_text)
        standard_clauses = self._parse_clauses(standard_rule_text)

        company_map = {clause.article_key: clause for clause in company_clauses}
        standard_map = {clause.article_key: clause for clause in standard_clauses}

        shared_keys = sorted(set(company_map) & set(standard_map), key=_sort_article_key)
        missing_keys = sorted(set(standard_map) - set(company_map), key=_sort_article_key)
        custom_keys = sorted(set(company_map) - set(standard_map), key=_sort_article_key)

        candidates: list[ClauseComparisonCandidate] = []
        for article_key in shared_keys:
            company_clause = company_map[article_key]
            standard_clause = standard_map[article_key]
            status = "matched"
            if _normalize_clause_body(company_clause.body) != _normalize_clause_body(standard_clause.body):
                status = "partial"
            candidates.append(
                ClauseComparisonCandidate(
                    article_key=article_key,
                    status=status,
                    company_header=company_clause.header,
                    standard_header=standard_clause.header,
                    company_snippet=company_clause.snippet,
                    standard_snippet=standard_clause.snippet,
                )
            )

        for article_key in missing_keys:
            standard_clause = standard_map[article_key]
            candidates.append(
                ClauseComparisonCandidate(
                    article_key=article_key,
                    status="missing",
                    company_header=None,
                    standard_header=standard_clause.header,
                    company_snippet=None,
                    standard_snippet=standard_clause.snippet,
                )
            )

        for article_key in custom_keys:
            company_clause = company_map[article_key]
            candidates.append(
                ClauseComparisonCandidate(
                    article_key=article_key,
                    status="custom",
                    company_header=company_clause.header,
                    standard_header=None,
                    company_snippet=company_clause.snippet,
                    standard_snippet=None,
                )
            )

        candidates = _prioritize_candidates(candidates)
        return ReviewPreprocessResult(
            company_clause_count=len(company_clauses),
            standard_clause_count=len(standard_clauses),
            shared_clause_count=len(shared_keys),
            clause_candidates=candidates,
        )

    def _parse_clauses(self, text: str) -> list[ParsedClause]:
        matches = list(_CLAUSE_PATTERN.finditer(text))
        if not matches:
            return []

        clauses: list[ParsedClause] = []
        for index, match in enumerate(matches):
            start = match.start()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            block = text[start:end].strip()
            header = match.group("header").strip()
            body = block[len(match.group("header")) :].strip()
            article_key = _normalize_article_key(header)
            clauses.append(
                ParsedClause(
                    article_key=article_key,
                    header=header,
                    body=body,
                )
            )

        return clauses


def _normalize_article_key(header: str) -> str:
    match = re.search(r"제\s*(\d+)\s*조(?:\s*의\s*(\d+))?", header)
    if not match:
        return re.sub(r"\s+", "", header)

    article = int(match.group(1))
    suffix = match.group(2)
    if suffix is None:
        return f"제{article}조"
    return f"제{article}조의{int(suffix)}"


def _sort_article_key(article_key: str) -> tuple[int, int]:
    match = re.search(r"제(\d+)조(?:의(\d+))?", article_key)
    if not match:
        return (10**9, 0)
    return (int(match.group(1)), int(match.group(2) or 0))


def _normalize_clause_body(body: str) -> str:
    return re.sub(r"\s+", "", body)


def _prioritize_candidates(candidates: list[ClauseComparisonCandidate]) -> list[ClauseComparisonCandidate]:
    status_order = {"missing": 0, "partial": 1, "custom": 2, "matched": 3}
    ordered = sorted(
        candidates,
        key=lambda candidate: (status_order.get(candidate.status, 9), _sort_article_key(candidate.article_key)),
    )
    return ordered[:80]
