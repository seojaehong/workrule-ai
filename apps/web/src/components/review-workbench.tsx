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

const messageInputClassName =
  "w-full rounded-[1.6rem] border border-[color:var(--line)] bg-white/55 px-4 py-4 outline-none transition placeholder:text-[color:var(--muted)]/70 focus:border-[color:var(--accent)] focus:bg-white dark:bg-white/5";

export function ReviewWorkbench() {
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_CHAT);
  const [draftMessage, setDraftMessage] = useState("");
  const [caseContext, setCaseContext] = useState(DEFAULT_CASE_CONTEXT);
  const [mode, setMode] = useState<ChatMode>("research");
  const [citations, setCitations] = useState<CitationCard[]>([]);
  const [toolTrace, setToolTrace] = useState<ToolTraceItem[]>([]);
  const [usedSources, setUsedSources] = useState<string[]>([]);
  const [disclaimer, setDisclaimer] = useState(
    "이 서비스는 참고용 정보를 정리합니다. 실제 조치 전에는 사실관계와 최신 법령(현재 시행 규정) 여부를 다시 확인해 주세요.",
  );
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const deferredCaseContext = useDeferredValue(caseContext);

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

  const canSubmit = draftMessage.trim().length > 0 && !isPending;
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");

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
      "이 서비스는 참고용 정보를 정리합니다. 실제 조치 전에는 사실관계와 최신 법령(현재 시행 규정) 여부를 다시 확인해 주세요.",
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
    <main className="grain min-h-screen">
      <section className="border-b border-[color:var(--line)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 md:px-10 lg:px-12">
          <div className="animate-fade flex items-center justify-between gap-4 text-sm text-[color:var(--muted)]">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
                AI Legal Desk
              </span>
              <span>Korean Law MCP 기반 개인 법률비서 MVP</span>
            </div>
            <span className="font-mono text-xs">Next.js + Vercel</span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="animate-rise">
              <p className="mb-4 text-sm uppercase tracking-[0.24em] text-[color:var(--accent)]">
                Always-on legal research workspace
              </p>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] md:text-7xl">
                내 상황을 이해하고, 관련 법령과 판례를 먼저 찾아주는 AI 법률비서입니다.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
                사건 배경을 적고 질문을 던지면 답변과 함께 참고할 법령(법 조문), 판례(법원의
                판단 사례), 해석례(행정기관 해석)를 정리해 줍니다. 복잡한 검색 대신, 지금
                필요한 쟁점을 한 화면에서 정리하세요.
              </p>
            </div>

            <div className="poster-shadow animate-rise delay-1 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8">
              <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Main workflow
              </p>
              <div className="mt-5 space-y-4">
                {[
                  ["1", "사건 배경 입력", "당사자, 일정, 이미 받은 통지서 내용을 먼저 적습니다."],
                  ["2", "질문 작성", "지금 가장 급한 쟁점 하나를 자연어로 묻습니다."],
                  ["3", "법령·판례 조회", "Korean Law MCP를 통해 관련 근거를 우선 탐색합니다."],
                  ["4", "참고용 정리", "답변과 근거 카드를 함께 보고 다음 행동을 정리합니다."],
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
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-10 md:px-10 lg:grid-cols-[0.96fr_1.04fr] lg:px-12">
        <aside className="poster-shadow animate-rise rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8">
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Case setup
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">사건 개요와 질문</h2>
            </div>
            <button
              type="button"
              onClick={resetWorkspace}
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              새 상담
            </button>
          </div>

          <div className="mt-6 space-y-6">
            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">상담 모드</p>
                <span className="font-mono text-xs text-[color:var(--muted)]">
                  {MODE_COPY[mode].label}
                </span>
              </div>
              <div className="mt-3 grid gap-3">
                {(Object.entries(MODE_COPY) as Array<[ChatMode, (typeof MODE_COPY)[ChatMode]]>).map(
                  ([entryMode, config]) => {
                    const active = mode === entryMode;
                    return (
                      <button
                        key={entryMode}
                        type="button"
                        onClick={() => setMode(entryMode)}
                        className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                          active
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                            : "border-[color:var(--line)] bg-white/35 hover:border-[color:var(--accent)] hover:bg-white/55 dark:bg-white/5"
                        }`}
                      >
                        <p className="font-semibold">{config.label}</p>
                        <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                          {config.description}
                        </p>
                      </button>
                    );
                  },
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">사건 개요</p>
                <span className="font-mono text-xs text-[color:var(--muted)]">
                  문자 {caseStats.chars.toLocaleString()} / 줄 {caseStats.lines.toLocaleString()}
                </span>
              </div>
              <textarea
                value={caseContext}
                onChange={(event) => setCaseContext(event.target.value)}
                className={`${messageInputClassName} mt-3 min-h-[210px] resize-y`}
                placeholder="언제, 누가, 어떤 통지를 했는지 적어 주세요."
              />
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">바로 써보는 질문</p>
                <span className="text-xs text-[color:var(--muted)]">영상 메시지에 맞춘 시작 예시</span>
              </div>
              <div className="mt-3 grid gap-3">
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => applyStarter(item.prompt, item.mode)}
                    className="rounded-[1.4rem] border border-[color:var(--line)] bg-white/35 px-4 py-4 text-left transition hover:border-[color:var(--accent)] hover:bg-white/55 dark:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{item.title}</p>
                      <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                        {MODE_COPY[item.mode].label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{item.prompt}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <section className="animate-rise delay-1 space-y-8">
          <div className="poster-shadow rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 backdrop-blur md:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Chat workspace
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                  질문과 답변
                </h2>
              </div>
              <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                {isPending ? "thinking" : "ready"}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-[1.6rem] border px-5 py-4 ${
                    message.role === "assistant"
                      ? "border-[color:var(--line)] bg-white/40 dark:bg-white/5"
                      : "border-[color:var(--accent)]/20 bg-[color:var(--accent-soft)]"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    {message.role === "assistant" ? "assistant" : "user"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                </article>
              ))}

              {isPending ? (
                <div className="rounded-[1.6rem] border border-[color:var(--line)] px-5 py-6 text-sm text-[color:var(--muted)]">
                  관련 법령과 참고 근거를 정리하고 있습니다.
                </div>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 border-t border-[color:var(--line)] pt-6">
              <label className="block">
                <span className="text-sm font-medium">질문</span>
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  className={`${messageInputClassName} mt-3 min-h-[132px] resize-y`}
                  placeholder="예: 해고 통지를 문자로만 받았는데 어떤 절차 위반이 문제될 수 있나요?"
                />
              </label>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm leading-6 text-[color:var(--muted)]">
                  답변은 참고용입니다. 실제 조치 전에는 사실관계와 최신 규정 여부를 다시 확인해
                  주세요.
                </p>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-full bg-[color:var(--foreground)] px-6 py-3 text-sm font-semibold text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "정리 중..." : "질문 보내기"}
                </button>
              </div>
            </form>

            {errorMessage ? (
              <div className="mt-4 rounded-[1.5rem] border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[color:var(--danger)]">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="poster-shadow rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8">
              <SectionHeader title="참고 근거" meta={`${citations.length} items`} />
              <div className="mt-4 space-y-3">
                {citations.length > 0 ? (
                  citations.map((citation) => (
                    <article
                      key={`${citation.reference}-${citation.title}`}
                      className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/30 px-4 py-4 dark:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{citation.title}</p>
                        <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                          {sourceTypeLabel(citation.sourceType)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--muted)]">{citation.reference}</p>
                      <p className="mt-3 text-sm leading-6">{citation.summary}</p>
                      {citation.url ? (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-sm font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
                        >
                          원문 링크 열기
                        </a>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <EmptyPanel message="답변이 생성되면 여기에 법령·판례·해석례 근거가 정리됩니다." />
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className="poster-shadow rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8">
                <SectionHeader title="도구 사용 흐름" meta={`${toolTrace.length} items`} />
                <div className="mt-4 space-y-3">
                  {toolTrace.length > 0 ? (
                    toolTrace.map((item) => (
                      <article
                        key={`${item.serverLabel}-${item.toolName}-${item.detail}`}
                        className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/30 px-4 py-4 dark:bg-white/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">
                            {item.serverLabel} / {item.toolName}
                          </p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(item.status)}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                          {item.detail}
                        </p>
                      </article>
                    ))
                  ) : (
                    <EmptyPanel message="아직 실행된 MCP 도구가 없습니다. 법령 조회가 필요한 질문을 보내 보세요." />
                  )}
                </div>
              </div>

              <div className="poster-shadow rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 backdrop-blur md:p-8">
                <SectionHeader title="상담 메모" meta={usedSources.length > 0 ? "source ready" : "waiting"} />
                <div className="mt-4 space-y-4">
                  <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/30 px-4 py-4 text-sm leading-7 dark:bg-white/5">
                    {lastAssistantMessage?.content ??
                      "상담이 시작되면 마지막 답변 요약이 여기에 표시됩니다."}
                  </div>

                  <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/30 px-4 py-4 text-sm leading-7 dark:bg-white/5">
                    <p className="font-semibold">주의 문구</p>
                    <p className="mt-2 text-[color:var(--muted)]">{disclaimer}</p>
                    {fallbackReason ? (
                      <p className="mt-3 text-[color:var(--accent)]">{fallbackReason}</p>
                    ) : null}
                  </div>

                  <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-white/30 px-4 py-4 text-sm leading-7 dark:bg-white/5">
                    <p className="font-semibold">사용된 출처 힌트</p>
                    {usedSources.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[color:var(--muted)]">
                        {usedSources.map((source) => (
                          <li key={source}>- {source}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[color:var(--muted)]">
                        아직 표시할 출처 메모가 없습니다.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
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

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[color:var(--line)] px-4 py-8 text-sm leading-7 text-[color:var(--muted)]">
      {message}
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
      return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
    case "failed":
      return "bg-[color:var(--danger)]/12 text-[color:var(--danger)]";
    case "skipped":
      return "bg-stone-500/12 text-stone-700 dark:text-stone-300";
    default:
      return "bg-stone-500/12 text-stone-700 dark:text-stone-300";
  }
}
