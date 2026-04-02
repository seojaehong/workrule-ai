"use client";

import { FormEvent, useDeferredValue, useMemo, useState, useTransition } from "react";

import {
  DEMO_REQUEST,
  DEMO_RESULT,
  FOCUS_AREA_OPTIONS,
  STANDARD_RULE_SNIPPET,
} from "@/lib/demo-data";
import type {
  DraftGenerationRequest,
  ExtractedDocument,
  ReviewDiagnosisRequest,
  ReviewDiagnosisResult,
  ReviewPriority,
} from "@/lib/types";

type WorkspaceView = "compare" | "draft" | "report";

const priorityMeta: Record<
  ReviewPriority,
  { label: string; className: string }
> = {
  critical: {
    label: "즉시 수정",
    className: "bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
  },
  urgent: {
    label: "우선 반영",
    className: "bg-[color:var(--accent)]/12 text-[color:var(--accent)]",
  },
  important: {
    label: "중요 검토",
    className: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  },
  normal: {
    label: "표현 정리",
    className: "bg-stone-500/12 text-stone-700 dark:text-stone-300",
  },
  reference: {
    label: "참고",
    className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  },
};

const menuItems: Array<{ key: WorkspaceView; label: string; description: string }> = [
  {
    key: "compare",
    label: "조문 대조",
    description: "기존 규정과 신규 기준문을 나란히 비교합니다.",
  },
  {
    key: "draft",
    label: "개정안 초안",
    description: "비교 결과를 바탕으로 개정 취업규칙 문안을 만듭니다.",
  },
  {
    key: "report",
    label: "검토 보고",
    description: "수정 포인트와 확인 필요 항목을 보고서처럼 정리합니다.",
  },
];

const inputClassName =
  "w-full rounded-[1.4rem] border border-[color:var(--line)] bg-white/55 px-4 py-3 outline-none transition placeholder:text-[color:var(--muted)]/70 focus:border-[color:var(--accent)] focus:bg-white dark:bg-white/5";

export function ReviewWorkbench() {
  const [form, setForm] = useState<ReviewDiagnosisRequest>(DEMO_REQUEST);
  const [result, setResult] = useState<ReviewDiagnosisResult | null>(DEMO_RESULT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRunMode, setLastRunMode] = useState<"demo" | "live">("demo");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("compare");
  const [uploadingField, setUploadingField] = useState<
    "company_rule_text" | "standard_rule_text" | null
  >(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const deferredCurrentRule = useDeferredValue(form.company_rule_text);
  const deferredReferenceRule = useDeferredValue(form.standard_rule_text);

  const textStats = useMemo(() => {
    const currentLines = deferredCurrentRule.split(/\r?\n/).filter(Boolean).length;
    const referenceLines = deferredReferenceRule.split(/\r?\n/).filter(Boolean).length;

    return {
      currentChars: deferredCurrentRule.length,
      referenceChars: deferredReferenceRule.length,
      currentLines,
      referenceLines,
    };
  }, [deferredCurrentRule, deferredReferenceRule]);

  const currentResult = result;
  const summary = currentResult?.summary ?? null;

  const generatedDraftSections = useMemo(() => {
    if (!currentResult) {
      return [];
    }

    return currentResult.findings.map((finding, index) => ({
      id: `${finding.finding_id}-${index}`,
      title: finding.clause_title,
      body: finding.suggested_text,
      rationale: finding.reason,
      laws: finding.related_laws.join(", "),
    }));
  }, [currentResult]);

  const generatedDraftText = useMemo(() => {
    if (generatedDraftSections.length === 0) {
      return "";
    }

    return generatedDraftSections
      .map(
        (section, index) =>
          `제안 ${index + 1}. ${section.title}\n${section.body}\n\n[반영 사유]\n${section.rationale}`,
      )
      .join("\n\n");
  }, [generatedDraftSections]);

  function updateField<Key extends keyof ReviewDiagnosisRequest>(
    key: Key,
    value: ReviewDiagnosisRequest[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleFocusArea(area: string) {
    const next = form.focus_areas.includes(area)
      ? form.focus_areas.filter((item) => item !== area)
      : [...form.focus_areas, area];
    updateField("focus_areas", next);
  }

  function loadDemo() {
    setForm(DEMO_REQUEST);
    setResult(DEMO_RESULT);
    setLastRunMode("demo");
    setWorkspaceView("compare");
    setErrorMessage(null);
  }

  function clearForm() {
    setForm({
      company_name: "",
      company_rule_text: "",
      standard_rule_text: STANDARD_RULE_SNIPPET,
      industry: "",
      employee_count: undefined,
      focus_areas: [],
      review_date: "",
    });
    setResult(null);
    setErrorMessage(null);
    setWorkspaceView("compare");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/diagnose", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            industry: form.industry || null,
            employee_count: form.employee_count || null,
            review_date: form.review_date || null,
          }),
        });

        const payload = (await response.json()) as ReviewDiagnosisResult | { detail?: string };
        if (!response.ok) {
          throw new Error(
            "detail" in payload && payload.detail
              ? payload.detail
              : "대조 요청에 실패했습니다.",
          );
        }

        setResult(payload as ReviewDiagnosisResult);
        setWorkspaceView("compare");
        setLastRunMode("live");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        setErrorMessage(message);
      }
    });
  }

  async function handleFileSelected(
    field: "company_rule_text" | "standard_rule_text",
    file: File | null,
  ) {
    if (!file) {
      return;
    }

    setUploadingField(field);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ExtractedDocument | { detail?: string };
      if (!response.ok) {
        throw new Error(
          "detail" in payload && payload.detail
            ? payload.detail
            : "문서 텍스트 추출에 실패했습니다.",
        );
      }

      updateField(field, (payload as ExtractedDocument).normalized_text);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "문서 업로드 중 알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleExportHwpx() {
    if (!currentResult) {
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const payload: DraftGenerationRequest = {
        company_name: form.company_name,
        baseline_rule_text: form.company_rule_text,
        diagnosis_result: currentResult,
      };

      const response = await fetch("/api/export-hwpx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const maybeError = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(maybeError?.detail ?? "HWPX 내보내기에 실패했습니다.");
      }

      const blob = await response.blob();
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename\*=UTF-8''(.+)$/)?.[1]
          ?.replaceAll("%20", " ") ?? "latest-workrule-draft.hwpx";

      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = decodeURIComponent(filename);
      link.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "내보내기 중 알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="grain min-h-screen">
      <section className="border-b border-[color:var(--line)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 md:px-10 lg:px-12">
          <div className="animate-fade flex items-center justify-between text-sm text-[color:var(--muted)]">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
                WorkRule AI
              </span>
              <span>취업규칙 전문 대조 및 개정안 생성</span>
            </div>
            <span className="font-mono text-xs">Local workspace</span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="animate-rise">
              <p className="mb-4 text-sm uppercase tracking-[0.24em] text-[color:var(--accent)]">
                Compare first. Draft second.
              </p>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.04em] md:text-7xl">
                기존 취업규칙과 신규 기준문을 대조한 뒤, 바로 개정 취업규칙 초안까지 만듭니다.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
                사용자는 문서 두 개만 올리면 됩니다. 시스템은 조문 매칭, 차이 탐지, 수정 포인트
                정리, 개정 문안 생성까지 한 흐름으로 이어집니다.
              </p>
            </div>

            <div className="poster-shadow animate-rise delay-1 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8">
              <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Main workflow
              </p>
              <div className="mt-5 space-y-4">
                {[
                  ["1", "기존 취업규칙 업로드", "현행 문서를 텍스트 또는 파일로 불러옵니다."],
                  ["2", "신규 기준문 업로드", "신규 표준안 또는 개정 기준문을 올립니다."],
                  ["3", "조문 매칭 대조", "누락, 변경, 충돌 조문을 먼저 정렬합니다."],
                  ["4", "개정안 생성", "수정 문안만 모아 개정 취업규칙 초안으로 묶습니다."],
                ].map(([step, title, description]) => (
                  <div
                    key={step}
                    className="flex items-start gap-4 border-t border-[color:var(--line)] pt-4 first:border-t-0 first:pt-0"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-sm font-semibold text-[color:var(--accent)]">
                      {step}
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <nav className="animate-rise delay-2 grid gap-3 md:grid-cols-3">
            {menuItems.map((item) => {
              const active = workspaceView === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setWorkspaceView(item.key)}
                  className={`rounded-[1.6rem] border px-5 py-4 text-left transition ${
                    active
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-[color:var(--line)] bg-white/35 hover:border-[color:var(--accent)] hover:bg-white/55 dark:bg-white/5"
                  }`}
                >
                  <p className="text-base font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-10 md:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-12">
        <form
          onSubmit={handleSubmit}
          className="poster-shadow animate-rise rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--line)] pb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Compare setup
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                대조 작업 설정
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={loadDemo}
                className="rounded-full border border-[color:var(--line)] px-4 py-2 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                샘플 불러오기
              </button>
              <button
                type="button"
                onClick={clearForm}
                className="rounded-full border border-[color:var(--line)] px-4 py-2 transition hover:border-[color:var(--foreground)]"
              >
                새 작업
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Field label="회사명">
              <input
                value={form.company_name}
                onChange={(event) => updateField("company_name", event.target.value)}
                className={inputClassName}
                placeholder="예: 세이프워크 주식회사"
                required
              />
            </Field>

            <Field label="업종">
              <input
                value={form.industry ?? ""}
                onChange={(event) => updateField("industry", event.target.value)}
                className={inputClassName}
                placeholder="예: 제조업"
              />
            </Field>

            <Field label="상시근로자 수">
              <input
                type="number"
                min={1}
                value={form.employee_count ?? ""}
                onChange={(event) =>
                  updateField(
                    "employee_count",
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
                className={inputClassName}
                placeholder="예: 85"
              />
            </Field>

            <Field label="검토일">
              <input
                type="date"
                value={form.review_date ?? ""}
                onChange={(event) => updateField("review_date", event.target.value)}
                className={inputClassName}
              />
            </Field>
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium">중점 검토 범위</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FOCUS_AREA_OPTIONS.map((area) => {
                const active = form.focus_areas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleFocusArea(area)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      active
                        ? "bg-[color:var(--accent)] text-white"
                        : "border border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-6">
            <Field
              label="기존 취업규칙"
              hint={`문자 ${textStats.currentChars.toLocaleString()} / 줄 ${textStats.currentLines.toLocaleString()}`}
            >
              <UploadAction
                description="현행 취업규칙 원문을 올리면 대조의 기준 A로 사용합니다."
                isLoading={uploadingField === "company_rule_text"}
                onSelect={(file) => handleFileSelected("company_rule_text", file)}
              />
              <textarea
                value={form.company_rule_text}
                onChange={(event) => updateField("company_rule_text", event.target.value)}
                className={`${inputClassName} min-h-[240px] resize-y`}
                placeholder="기존 취업규칙 본문을 붙여 넣으세요."
                required
              />
            </Field>

            <Field
              label="신규 취업규칙 또는 기준문"
              hint={`문자 ${textStats.referenceChars.toLocaleString()} / 줄 ${textStats.referenceLines.toLocaleString()}`}
            >
              <UploadAction
                description="개정 표준안, 신규 취업규칙, 기준문 중 비교 기준이 되는 문서를 올립니다."
                isLoading={uploadingField === "standard_rule_text"}
                onSelect={(file) => handleFileSelected("standard_rule_text", file)}
              />
              <textarea
                value={form.standard_rule_text}
                onChange={(event) => updateField("standard_rule_text", event.target.value)}
                className={`${inputClassName} min-h-[220px] resize-y`}
                placeholder="신규 취업규칙 또는 기준 취업규칙 원문을 붙여 넣으세요."
                required
              />
            </Field>
          </div>

          <div className="mt-8 grid gap-3 border-t border-[color:var(--line)] pt-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-medium">실행 순서</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                먼저 조문 매칭 대조를 실행한 뒤, 결과 탭에서 개정안 초안을 확인하세요.
              </p>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[color:var(--foreground)] px-6 py-3 text-sm font-semibold text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "조문 대조 실행 중..." : "조문 매칭 대조 실행"}
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-3xl border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[color:var(--danger)]">
              {errorMessage}
            </div>
          ) : null}
        </form>

        <aside className="animate-rise delay-1 lg:sticky lg:top-8 lg:self-start">
          <div className="poster-shadow rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 backdrop-blur md:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Output workspace
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                  {workspaceView === "compare"
                    ? "조문 대조 결과"
                    : workspaceView === "draft"
                      ? "개정 취업규칙 초안"
                      : "검토 보고서 뷰"}
                </h2>
              </div>
              <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                {lastRunMode === "live" ? "live" : "demo"}
              </span>
            </div>

            {!currentResult || !summary ? (
              <div className="mt-6 rounded-[2rem] border border-dashed border-[color:var(--line)] px-6 py-10 text-sm leading-7 text-[color:var(--muted)]">
                아직 비교 결과가 없습니다. 왼쪽에서 기존 취업규칙과 신규 기준문을 입력한 뒤
                조문 매칭 대조를 실행하세요.
              </div>
            ) : workspaceView === "compare" ? (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="총 매칭 이슈" value={`${summary.total_findings}건`} />
                  <Metric label="비교 기준" value="기존 vs 신규" />
                  <Metric label="즉시 수정" value={`${summary.critical_count}건`} />
                  <Metric label="우선 반영" value={`${summary.urgent_count}건`} />
                </div>

                <section>
                  <SectionHeader title="조문 매칭" meta={`${currentResult.clause_mappings.length} items`} />
                  <div className="mt-3 space-y-3">
                    {currentResult.clause_mappings.map((mapping, index) => (
                      <article
                        key={`${mapping.company_clause}-${index}`}
                        className="rounded-[1.5rem] border border-[color:var(--line)] px-4 py-4"
                      >
                        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                          {mapping.status}
                        </p>
                        <p className="mt-2 font-semibold">{mapping.company_clause}</p>
                        <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                          대응 기준: {mapping.standard_clause ?? "직접 대응 조문 없음"}
                        </p>
                        <p className="mt-2 text-sm leading-6">{mapping.notes}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeader
                    title="핵심 차이"
                    meta={`${currentResult.findings.length.toLocaleString()} items`}
                  />
                  <div className="mt-3 space-y-3">
                    {currentResult.findings.map((finding) => (
                      <article
                        key={finding.finding_id}
                        className="rounded-[1.5rem] border border-[color:var(--line)] px-4 py-4 transition hover:border-[color:var(--accent)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{finding.clause_title}</p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityMeta[finding.priority].className}`}
                          >
                            {priorityMeta[finding.priority].label}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                          {finding.reason}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : workspaceView === "draft" ? (
              <div className="mt-6 space-y-6">
                <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/30 px-5 py-5 dark:bg-white/5">
                  <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Draft strategy
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                    대조 결과에서 수정이 필요한 문안만 모아 개정 취업규칙 초안으로 구성했습니다.
                    실제 적용 전에는 조문 번호, 장/절 체계, 사업장 고유 조항을 함께 검토해야 합니다.
                  </p>
                </div>

                <section>
                  <div className="flex items-center justify-between gap-3">
                    <SectionHeader title="개정 초안 섹션" meta={`${generatedDraftSections.length} items`} />
                    <button
                      type="button"
                      onClick={handleExportHwpx}
                      disabled={isExporting}
                      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-xs font-semibold transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isExporting ? "HWPX 생성 중..." : "HWPX 다운로드"}
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {generatedDraftSections.map((section) => (
                      <article
                        key={section.id}
                        className="rounded-[1.5rem] border border-[color:var(--line)] px-4 py-4"
                      >
                        <p className="font-semibold">{section.title}</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                          {section.body}
                        </p>
                        <p className="mt-3 text-xs leading-6 text-[color:var(--muted)]">
                          반영 사유: {section.rationale}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-[color:var(--muted)]">
                          관련 법령: {section.laws || "기준문 참고"}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeader title="통합 개정안 텍스트" meta="copy ready" />
                  <textarea
                    value={generatedDraftText}
                    readOnly
                    className={`${inputClassName} mt-3 min-h-[260px] resize-y`}
                  />
                </section>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="전체 이슈" value={`${summary.total_findings}건`} />
                  <Metric label="사용자 확인" value={`${currentResult.user_confirmations.length}건`} />
                  <Metric label="즉시 수정" value={`${summary.critical_count}건`} />
                  <Metric label="중요 검토" value={`${summary.important_count}건`} />
                </div>

                <section>
                  <SectionHeader title="주요 발견사항" meta={`${summary.top_findings.length} items`} />
                  <div className="mt-3 space-y-2">
                    {summary.top_findings.map((item) => (
                      <div
                        key={item}
                        className="rounded-3xl border border-[color:var(--line)] bg-white/30 px-4 py-3 text-sm leading-6 dark:bg-white/5"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeader
                    title="사용자 확인 필요"
                    meta={`${currentResult.user_confirmations.length.toLocaleString()} items`}
                  />
                  <div className="mt-3 space-y-3">
                    {currentResult.user_confirmations.length > 0 ? (
                      currentResult.user_confirmations.map((item) => (
                        <div
                          key={item.item_id}
                          className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/30 px-4 py-4 dark:bg-white/5"
                        >
                          <p className="font-semibold">{item.clause_title}</p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                            {item.question}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[color:var(--muted)]">
                        현재 결과에는 추가 확인 항목이 없습니다.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function UploadAction({
  description,
  isLoading,
  onSelect,
}: {
  description: string;
  isLoading: boolean;
  onSelect: (file: File | null) => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-xs text-[color:var(--muted)]">
        {description}
      </p>
      <label className="cursor-pointer rounded-full border border-[color:var(--line)] px-3 py-2 text-xs font-semibold transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]">
        {isLoading ? "추출 중..." : "파일 업로드"}
        <input
          type="file"
          accept=".txt,.md,.docx,.pdf,.hwpx,.hwp"
          className="hidden"
          disabled={isLoading}
          onChange={(event) => {
            onSelect(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {hint ? (
          <span className="font-mono text-xs text-[color:var(--muted)]">{hint}</span>
        ) : null}
      </div>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/30 px-4 py-4 dark:bg-white/5">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  );
}

function SectionHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <span className="font-mono text-xs text-[color:var(--muted)]">{meta}</span>
    </div>
  );
}
