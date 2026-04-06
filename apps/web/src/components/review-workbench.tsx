"use client";

import { FormEvent, useDeferredValue, useMemo, useState, useTransition } from "react";

import {
  DEFAULT_CASE_CONTEXT,
  MODE_COPY,
  STARTER_CHAT,
  STARTER_PROMPTS,
} from "@/lib/demo-data";
import type {
  ChatMessage,
  ChatMode,
  ChatRequest,
  ChatResponse,
  CitationCard,
  ToolTraceItem,
} from "@/lib/types";

const textareaClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-4 text-sm leading-7 text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:bg-[color:var(--panel-strong)]";

export function ReviewWorkbench() {
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_CHAT);
  const [draftMessage, setDraftMessage] = useState("");
  const [caseContext, setCaseContext] = useState(DEFAULT_CASE_CONTEXT);
  const [mode, setMode] = useState<ChatMode>("research");
  const [citations, setCitations] = useState<CitationCard[]>([]);
  const [toolTrace, setToolTrace] = useState<ToolTraceItem[]>([]);
  const [usedSources, setUsedSources] = useState<string[]>([]);
  const [disclaimer, setDisclaimer] = useState(
    "이 서비스는 참고용 정보 정리 도구입니다. 실제 대응 전에는 사실관계와 최신 법령(현재 시행 규정)을 다시 확인해 주세요.",
  );
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const deferredCaseContext = useDeferredValue(caseContext);
  const canSubmit = draftMessage.trim().length > 0 && !isPending;

  const caseStats = useMemo(() => {
    const lines = deferredCaseContext
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length;

    return {
      chars: deferredCaseContext.length,
      lines,
    };
  }, [deferredCaseContext]);

  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role,
      content,
    };
  }

  function resetWorkspace() {
    setMessages(STARTER_CHAT);
    setDraftMessage("");
    setCaseContext(DEFAULT_CASE_CONTEXT);
    setMode("research");
    setCitations([]);
    setToolTrace([]);
    setUsedSources([]);
    setDisclaimer(
      "이 서비스는 참고용 정보 정리 도구입니다. 실제 대응 전에는 사실관계와 최신 법령(현재 시행 규정)을 다시 확인해 주세요.",
    );
    setFallbackReason(null);
    setErrorMessage(null);
  }

  function applyStarter(prompt: string, nextMode: ChatMode) {
    setDraftMessage(prompt);
    setMode(nextMode);
    setErrorMessage(null);
  }

  async function sendMessage(nextMessages: ChatMessage[]) {
    const payload: ChatRequest = {
      messages: nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      caseContext,
      mode,
    };

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as ChatResponse | { detail?: string };
    if (!response.ok) {
      throw new Error(
        "detail" in data && typeof data.detail === "string"
          ? data.detail
          : "질의 처리 중 오류가 발생했습니다.",
      );
    }

    const chatResponse = data as ChatResponse;
    setMessages((current) => [...current, createMessage("assistant", chatResponse.answer)]);
    setCitations(chatResponse.citations);
    setToolTrace(chatResponse.toolTrace);
    setUsedSources(chatResponse.usedSources);
    setDisclaimer(chatResponse.disclaimer);
    setFallbackReason(chatResponse.fallbackReason ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const nextUserMessage = createMessage("user", draftMessage.trim());
    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setDraftMessage("");
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await sendMessage(nextMessages);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <main className="legal-shell min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[color:var(--background)]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-5 py-4 md:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[color:var(--line-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                AI Legal Desk
              </span>
              <span className="hidden text-sm text-[color:var(--muted)] md:inline">
                Korean Law MCP research workspace
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              질문보다 먼저 근거를 확인하는 법률 리서치 워크스페이스
            </p>
          </div>

          <div className="hidden items-center gap-6 lg:flex">
            <nav className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              <span>Brief</span>
              <span className="h-px w-6 bg-[color:var(--line)]" />
              <span>Chat</span>
              <span className="h-px w-6 bg-[color:var(--line)]" />
              <span>Evidence</span>
            </nav>
            <StatusPill label={MODE_COPY[mode].label} tone="accent" />
            <StatusPill label={isPending ? "정리 중" : "대기 중"} tone={isPending ? "muted" : "success"} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-0 px-0 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="border-b border-[color:var(--line)] px-5 py-6 md:px-8 lg:min-h-[calc(100vh-81px)] lg:border-r lg:border-b-0">
          <SectionKicker label="Case Brief" />
          <h1 className="mt-3 max-w-[14ch] text-3xl font-semibold leading-tight tracking-[-0.04em]">
            사건을 짧게 정리하고, 지금 바로 질문하세요.
          </h1>
          <p className="mt-4 max-w-[28ch] text-sm leading-7 text-[color:var(--muted)]">
            첫 화면에서 해야 할 일은 세 가지뿐입니다. 사건 배경을 적고, 질문을 고르고, 답변보다
            먼저 근거를 확인하는 것입니다.
          </p>

          <div className="mt-8 border-t border-[color:var(--line)] pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                상담 모드
              </h2>
              <span className="font-mono text-xs text-[color:var(--muted)]">
                {MODE_COPY[mode].label}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {(Object.entries(MODE_COPY) as Array<[ChatMode, (typeof MODE_COPY)[ChatMode]]>).map(
                ([entryMode, config]) => {
                  const active = mode === entryMode;
                  return (
                    <button
                      key={entryMode}
                      type="button"
                      onClick={() => setMode(entryMode)}
                      className={`w-full border-b px-0 py-3 text-left transition ${
                        active
                          ? "border-[color:var(--foreground)] text-[color:var(--foreground)]"
                          : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{config.label}</p>
                        <span className="text-xs">{active ? "active" : "select"}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{config.description}</p>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-[color:var(--line)] pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                사건 개요
              </h2>
              <span className="font-mono text-xs text-[color:var(--muted)]">
                {caseStats.chars.toLocaleString()} chars / {caseStats.lines.toLocaleString()} lines
              </span>
            </div>
            <textarea
              value={caseContext}
              onChange={(event) => setCaseContext(event.target.value)}
              className={`${textareaClassName} mt-4 min-h-[240px] resize-y`}
              placeholder="당사자 관계, 통지 시점, 이미 받은 문서, 가장 급한 쟁점을 적어 주세요."
            />
          </div>

          <div className="mt-8 border-t border-[color:var(--line)] pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              진행 현황
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <CompactMetric label="질문" value={String(messages.filter((item) => item.role === "user").length)} />
              <CompactMetric label="근거" value={String(citations.length)} />
              <CompactMetric label="출처" value={String(usedSources.length)} />
            </div>
          </div>

          <div className="mt-8 border-t border-[color:var(--line)] pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                시작 질문
              </h2>
              <button
                type="button"
                onClick={resetWorkspace}
                className="text-xs font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
              >
                초기화
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => applyStarter(item.prompt, item.mode)}
                  className="group block w-full border-b border-[color:var(--line)] pb-3 text-left transition hover:border-[color:var(--accent)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium group-hover:text-[color:var(--foreground)]">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{item.prompt}</p>
                    </div>
                    <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {item.mode}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-h-[calc(100vh-81px)] border-b border-[color:var(--line)] px-5 py-6 md:px-8 lg:border-r lg:border-b-0">
          <div className="flex items-end justify-between gap-6 border-b border-[color:var(--line)] pb-5">
            <div>
              <SectionKicker label="Conversation" />
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">질문과 답변</h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                답변은 짧고 명확하게, 근거는 우측 인스펙터에서 바로 확인합니다.
              </p>
            </div>
            <div className="hidden text-right md:block">
              <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">Last question</p>
              <p className="mt-2 max-w-[34ch] text-sm leading-6 text-[color:var(--muted)]">
                {lastUserMessage?.content ?? "아직 질문이 없습니다."}
              </p>
            </div>
          </div>

          <div className="min-h-[480px] space-y-6 py-6">
            {messages.length === 1 ? (
              <div className="grid gap-10 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-5">
                  <p className="max-w-[18ch] text-4xl font-semibold leading-[1.02] tracking-[-0.05em]">
                    첫 답변보다 먼저, 어떤 근거를 볼지 정하는 화면입니다.
                  </p>
                  <p className="max-w-[40ch] text-sm leading-7 text-[color:var(--muted)]">
                    21st.dev의 Notion, Cursor, Minimal 방향처럼 장식을 줄이고 작업 표면을
                    우선시했습니다. 질문을 보내면 중앙은 대화, 우측은 근거 인스펙터로 바로
                    전환됩니다.
                  </p>
                  <div className="grid gap-3 pt-2 md:grid-cols-3">
                    <MiniNote title="브리프 우선" body="사건 배경을 먼저 적고" />
                    <MiniNote title="질문 단일화" body="지금 가장 급한 쟁점만 묻고" />
                    <MiniNote title="근거 확인" body="우측 인스펙터로 바로 검증" />
                  </div>
                </div>

                <div className="space-y-3 border-t border-[color:var(--line)] pt-4 xl:border-t-0 xl:border-l xl:pl-8 xl:pt-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                    Workspace order
                  </p>
                  {[
                    "사건 개요 입력",
                    "질문 작성 또는 시작 질문 선택",
                    "법령·판례·해석례 탐색",
                    "다음 대응 포인트 정리",
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] py-3"
                    >
                      <p className="text-sm text-[color:var(--muted)]">{item}</p>
                      <span className="font-mono text-xs text-[color:var(--muted)]">
                        0{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[90%] ${
                  message.role === "assistant" ? "mr-auto" : "ml-auto"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                    {message.role === "assistant" ? "assistant" : "user"}
                  </span>
                  <span className="h-px flex-1 bg-[color:var(--line)]" />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-[color:var(--foreground)]">
                  {message.content}
                </p>
              </article>
            ))}

            {isPending ? (
              <div className="border-t border-[color:var(--line)] pt-4">
                <p className="text-sm leading-7 text-[color:var(--muted)]">
                  관련 법령과 참고 근거를 먼저 정리하고 있습니다.
                </p>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[color:var(--line)] pt-6">
            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              className={`${textareaClassName} min-h-[144px] resize-y`}
              placeholder="예: 문자로 해고 통보를 받았습니다. 해고예고(미리 알리는 절차)와 서면 통지 의무 위반 가능성을 먼저 정리해 주세요."
            />

            <div className="mt-4 flex flex-col gap-4 border-t border-[color:var(--line)] pt-4 md:flex-row md:items-center md:justify-between">
              <p className="max-w-[54ch] text-sm leading-7 text-[color:var(--muted)]">
                답변은 참고용입니다. 실제 대응 전에는 사실관계와 최신 규정 여부를 다시 확인해
                주세요.
              </p>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--foreground)] px-6 py-3 text-sm font-semibold text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "정리 중..." : "질문 보내기"}
              </button>
            </div>

            {errorMessage ? (
              <div className="mt-4 border-t border-[color:var(--line)] pt-4 text-sm leading-7 text-[color:var(--danger)]">
                {errorMessage}
              </div>
            ) : null}
          </form>
        </section>

        <aside className="px-5 py-6 md:px-8 lg:min-h-[calc(100vh-81px)]">
          <div className="space-y-8 lg:sticky lg:top-[97px]">
            <section>
              <SectionKicker label="Evidence" />
              <div className="mt-3 flex items-end justify-between gap-4 border-b border-[color:var(--line)] pb-4">
                <h2 className="text-2xl font-semibold tracking-[-0.04em]">근거 인스펙터</h2>
                <span className="font-mono text-xs text-[color:var(--muted)]">
                  {citations.length} items
                </span>
              </div>

              <p className="mt-4 max-w-[32ch] text-sm leading-7 text-[color:var(--muted)]">
                답변 자체보다, 어떤 근거를 확인해야 하는지 빠르게 스캔할 수 있도록 정리합니다.
              </p>

              <div className="mt-5 space-y-5">
                {citations.length > 0 ? (
                  citations.map((citation) => (
                    <article key={`${citation.reference}-${citation.title}`} className="border-b border-[color:var(--line)] pb-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
                            {sourceTypeLabel(citation.sourceType)}
                          </p>
                          <h3 className="mt-2 text-base font-semibold">{citation.title}</h3>
                        </div>
                        <span className="text-[11px] text-[color:var(--muted)]">reference</span>
                      </div>
                      <p className="mt-3 text-sm text-[color:var(--muted)]">{citation.reference}</p>
                      <p className="mt-3 text-sm leading-7">{citation.summary}</p>
                      {citation.url ? (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-sm font-medium text-[color:var(--accent)] underline-offset-4 hover:underline"
                        >
                          원문 링크 열기
                        </a>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="근거가 여기에 쌓입니다"
                    description="답변이 생성되면 법령(법 조문), 판례(법원의 판단 사례), 해석례(행정기관 해석)를 이 패널에서 바로 스캔할 수 있습니다."
                  />
                )}
              </div>
            </section>

            <section>
              <SectionKicker label="Trace" />
              <div className="mt-3 border-t border-[color:var(--line)] pt-4">
                {toolTrace.length > 0 ? (
                  <div className="space-y-4">
                    {toolTrace.map((item) => (
                      <article key={`${item.serverLabel}-${item.toolName}-${item.detail}`} className="border-b border-[color:var(--line)] pb-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">
                            {item.serverLabel} / {item.toolName}
                          </p>
                          <span className={`text-[11px] uppercase tracking-[0.18em] ${statusClassName(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{item.detail}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="도구 흐름 없음"
                    description="법률 조회가 필요한 질문을 보내면 MCP 도구 사용 흐름이 이 영역에 표시됩니다."
                  />
                )}
              </div>
            </section>

            <section>
              <SectionKicker label="Notes" />
              <div className="mt-3 border-t border-[color:var(--line)] pt-4">
                <p className="text-sm font-medium">마지막 정리</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
                  {lastAssistantMessage?.content ?? "아직 답변이 없습니다."}
                </p>

                <div className="mt-5 border-t border-[color:var(--line)] pt-4">
                  <p className="text-sm font-medium">주의 문구</p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">{disclaimer}</p>
                  {fallbackReason ? (
                    <p className="mt-3 text-sm leading-7 text-[color:var(--accent)]">{fallbackReason}</p>
                  ) : null}
                </div>

                <div className="mt-5 border-t border-[color:var(--line)] pt-4">
                  <p className="text-sm font-medium">출처 메모</p>
                  {usedSources.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                      {usedSources.map((source) => (
                        <li key={source}>{source}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
                      아직 표시할 출처 메모가 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}

function SectionKicker({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
      {label}
    </p>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "accent" | "success" | "muted";
}) {
  const className =
    tone === "accent"
      ? "border-[color:var(--accent)]/30 text-[color:var(--accent)]"
      : tone === "success"
        ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
        : "border-[color:var(--line-strong)] text-[color:var(--muted)]";

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${className}`}>
      {label}
    </span>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

function MiniNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-[color:var(--line)] pt-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{body}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="py-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">{description}</p>
    </div>
  );
}

function sourceTypeLabel(sourceType: CitationCard["sourceType"]) {
  switch (sourceType) {
    case "law":
      return "법령";
    case "precedent":
      return "판례";
    case "interpretation":
      return "해석례";
    default:
      return "근거";
  }
}

function statusLabel(status: ToolTraceItem["status"]) {
  switch (status) {
    case "used":
      return "used";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return "status";
  }
}

function statusClassName(status: ToolTraceItem["status"]) {
  switch (status) {
    case "used":
      return "text-emerald-600 dark:text-emerald-300";
    case "failed":
      return "text-[color:var(--danger)]";
    case "skipped":
      return "text-[color:var(--muted)]";
    default:
      return "text-[color:var(--muted)]";
  }
}
