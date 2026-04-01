"use client";

import { FormEvent, useDeferredValue, useMemo, useState, useTransition } from "react";

import {
  DEMO_REQUEST,
  DEMO_RESULT,
  FOCUS_AREA_OPTIONS,
  STANDARD_RULE_SNIPPET,
} from "@/lib/demo-data";
import type {
  ExtractedDocument,
  ReviewDiagnosisRequest,
  ReviewDiagnosisResult,
  ReviewPriority,
} from "@/lib/types";

const priorityMeta: Record<
  ReviewPriority,
  { label: string; className: string }
> = {
  critical: {
    label: "최우선",
    className: "bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
  },
  urgent: {
    label: "긴급",
    className: "bg-[color:var(--accent)]/12 text-[color:var(--accent)]",
  },
  important: {
    label: "중요",
    className: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  },
  normal: {
    label: "보통",
    className: "bg-stone-500/12 text-stone-700 dark:text-stone-300",
  },
  reference: {
    label: "참고",
    className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  },
};

const inputClassName =
  "w-full rounded-[1.4rem] border border-[color:var(--line)] bg-white/55 px-4 py-3 outline-none transition placeholder:text-[color:var(--muted)]/70 focus:border-[color:var(--accent)] focus:bg-white dark:bg-white/5";

export function ReviewWorkbench() {
  const [form, setForm] = useState<ReviewDiagnosisRequest>(DEMO_REQUEST);
  const [result, setResult] = useState<ReviewDiagnosisResult | null>(DEMO_RESULT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRunMode, setLastRunMode] = useState<"demo" | "live">("demo");
  const [uploadingField, setUploadingField] = useState<"company_rule_text" | "standard_rule_text" | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const deferredCompanyText = useDeferredValue(form.company_rule_text);
  const deferredStandardText = useDeferredValue(form.standard_rule_text);

  const textStats = useMemo(() => {
    const companyLines = deferredCompanyText.split(/\r?\n/).filter(Boolean).length;
    const standardLines = deferredStandardText.split(/\r?\n/).filter(Boolean).length;

    return {
      companyChars: deferredCompanyText.length,
      standardChars: deferredStandardText.length,
      companyLines,
      standardLines,
    };
  }, [deferredCompanyText, deferredStandardText]);

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
              : "진단 요청에 실패했습니다.",
          );
        }

        setResult(payload as ReviewDiagnosisResult);
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

  const currentResult = result;
  const summary = currentResult?.summary ?? null;

  return (
    <main className="grain min-h-screen">
      <section className="border-b border-[color:var(--line)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-8 md:px-10 lg:px-12">
          <div className="animate-fade flex items-center justify-between text-sm text-[color:var(--muted)]">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
                WorkRule AI
              </span>
              <span>Structured labor rule review harness</span>
            </div>
            <span className="font-mono text-xs">Next.js + FastAPI + Pydantic</span>
          </div>

          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="animate-rise">
              <p className="mb-4 text-sm uppercase tracking-[0.24em] text-[color:var(--accent)]">
                Employment rule diagnosis workspace
              </p>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.04em] md:text-7xl">
                취업규칙을 넣으면, 조문 매핑부터 개정 권고안까지 바로 구조화합니다.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
                업로드 이후의 핵심은 생성이 아니라 통제입니다. WorkRule AI는 표준취업규칙
                기준 비교, 스키마 강제, 재검증 루프를 묶어 실무용 결과만 남깁니다.
              </p>
            </div>

            <div className="poster-shadow animate-rise delay-1 relative overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8">
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[color:var(--accent-soft)] to-transparent" />
              <div className="relative space-y-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      Harness layers
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                      Validate before trust
                    </p>
                  </div>
                  <span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-semibold text-white">
                    Live workspace
                  </span>
                </div>

                <div className="space-y-4">
                  {[
                    ["01", "Data Ingestion", "문서별 추출기를 붙여도 normalize 레이어는 하나로 유지"],
                    ["02", "Prompt Harness", "업무 프롬프트와 모델 호출부를 분리해 재사용성 확보"],
                    ["03", "Output Validation", "Pydantic 검증 실패 시 오류 메시지로 재시도"],
                  ].map(([index, title, description]) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 border-t border-[color:var(--line)] pt-4 first:border-t-0 first:pt-0"
                    >
                      <span className="font-mono text-sm text-[color:var(--muted)]">{index}</span>
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
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-10 md:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
        <form
          onSubmit={handleSubmit}
          className="poster-shadow animate-rise delay-2 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--line)] pb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Review Input
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                검토 요청 구성
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={loadDemo}
                className="rounded-full border border-[color:var(--line)] px-4 py-2 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                데모 로드
              </button>
              <button
                type="button"
                onClick={clearForm}
                className="rounded-full border border-[color:var(--line)] px-4 py-2 transition hover:border-[color:var(--foreground)]"
              >
                입력 초기화
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
            <p className="text-sm font-medium">중점 검토 영역</p>
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
              hint={`문자 ${textStats.companyChars.toLocaleString()} / 줄 ${textStats.companyLines.toLocaleString()}`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-[color:var(--muted)]">
                  텍스트 직접 입력 또는 파일 업로드 지원: txt, md, docx, pdf, hwpx
                </p>
                <label className="cursor-pointer rounded-full border border-[color:var(--line)] px-3 py-2 text-xs font-semibold transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]">
                  {uploadingField === "company_rule_text" ? "추출 중..." : "파일에서 채우기"}
                  <input
                    type="file"
                    accept=".txt,.md,.docx,.pdf,.hwpx"
                    className="hidden"
                    disabled={uploadingField !== null}
                    onChange={(event) => {
                      void handleFileSelected("company_rule_text", event.target.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <textarea
                value={form.company_rule_text}
                onChange={(event) => updateField("company_rule_text", event.target.value)}
                className={`${inputClassName} min-h-[260px] resize-y`}
                placeholder="기존 취업규칙 본문을 붙여 넣으세요."
                required
              />
            </Field>

            <Field
              label="표준취업규칙 기준문"
              hint={`문자 ${textStats.standardChars.toLocaleString()} / 줄 ${textStats.standardLines.toLocaleString()}`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-[color:var(--muted)]">
                  표준취업규칙 원문도 문서 업로드로 채울 수 있습니다.
                </p>
                <label className="cursor-pointer rounded-full border border-[color:var(--line)] px-3 py-2 text-xs font-semibold transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]">
                  {uploadingField === "standard_rule_text" ? "추출 중..." : "파일에서 채우기"}
                  <input
                    type="file"
                    accept=".txt,.md,.docx,.pdf,.hwpx"
                    className="hidden"
                    disabled={uploadingField !== null}
                    onChange={(event) => {
                      void handleFileSelected("standard_rule_text", event.target.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <textarea
                value={form.standard_rule_text}
                onChange={(event) => updateField("standard_rule_text", event.target.value)}
                className={`${inputClassName} min-h-[220px] resize-y`}
                placeholder="고용노동부 표준취업규칙 원문을 붙여 넣으세요."
                required
              />
            </Field>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[color:var(--line)] pt-6">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[color:var(--foreground)] px-6 py-3 text-sm font-semibold text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "검토 실행 중..." : "실시간 진단 실행"}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(DEMO_RESULT);
                setLastRunMode("demo");
                setErrorMessage(null);
              }}
              className="rounded-full border border-[color:var(--line)] px-6 py-3 text-sm font-semibold transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              데모 결과 보기
            </button>
            <p className="text-sm text-[color:var(--muted)]">
              현재 모드: {lastRunMode === "live" ? "백엔드 실연동" : "UI 데모"}
            </p>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-3xl border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[color:var(--danger)]">
              {errorMessage}
            </div>
          ) : null}
        </form>

        <aside className="animate-rise delay-3 lg:sticky lg:top-8 lg:self-start">
          <div className="poster-shadow rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 backdrop-blur md:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Diagnosis Output
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                  검토 결과 패널
                </h2>
              </div>
              <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                schema locked
              </span>
            </div>

            {currentResult && summary ? (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="총 발견" value={`${summary.total_findings}건`} />
                  <Metric
                    label="표준 버전"
                    value={summary.standard_version.replace("MOEL ", "")}
                  />
                  <Metric label="최우선" value={`${summary.critical_count}건`} />
                  <Metric label="긴급" value={`${summary.urgent_count}건`} />
                </div>

                <section>
                  <SectionHeader
                    title="주요 포인트"
                    meta={`${summary.top_findings.length} items`}
                  />
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
                    title="검토 Findings"
                    meta={`${currentResult.findings.length.toLocaleString()} items`}
                  />
                  <div className="mt-3 space-y-3">
                    {currentResult.findings.slice(0, 4).map((finding) => (
                      <article
                        key={finding.finding_id}
                        className="rounded-[1.5rem] border border-[color:var(--line)] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]"
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
            ) : (
              <div className="mt-6 rounded-[2rem] border border-dashed border-[color:var(--line)] px-6 py-10 text-sm leading-7 text-[color:var(--muted)]">
                아직 결과가 없습니다. 왼쪽에서 회사 규칙과 기준문을 입력한 뒤 실시간 진단을
                실행하거나 데모 결과를 불러오세요.
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
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
