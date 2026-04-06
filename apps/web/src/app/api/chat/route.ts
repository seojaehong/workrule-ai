import { NextRequest, NextResponse } from "next/server";

import type { CitationCard, ChatMode, ChatRequest, ChatResponse, ToolTraceItem } from "@/lib/types";

const DEFAULT_MODEL = "gpt-5-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MCP_ALLOWED_TOOLS = [
  "chain_full_research",
  "search_law",
  "get_law_text",
  "search_precedents",
  "summarize_precedent",
  "search_interpretations",
  "get_interpretation_text",
  "get_related_laws",
  "search_all",
  "get_legal_term_kb",
  "get_daily_to_legal",
];

type ParsedChatRequest = ChatRequest;

class RouteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

interface OpenAITextOutput {
  type: string;
  text?: string;
}

interface OpenAIMcpCall {
  type: "mcp_call";
  server_label?: string;
  name?: string;
  output?: string;
  error?: string | null;
}

interface OpenAIOtherOutput {
  type: string;
  [key: string]: unknown;
}

interface OpenAIResponsesPayload {
  output?: Array<OpenAITextOutput | OpenAIMcpCall | OpenAIOtherOutput>;
  output_text?: string;
  error?: {
    message?: string;
  };
}

interface ModelStructuredAnswer {
  answer: string;
  citations?: CitationCard[];
  disclaimer?: string;
  usedSources?: string[];
}

interface AttemptResult {
  payload: OpenAIResponsesPayload;
  fallbackReason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const parsedRequest = parseChatRequest(body);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          detail:
            "OPENAI_API_KEY가 설정되지 않았습니다. Vercel 또는 로컬 환경변수에 OpenAI 키를 추가해 주세요.",
        },
        { status: 503 },
      );
    }

    const result = await runChatFlow(parsedRequest, apiKey);
    const response = buildChatResponse(result.payload, result.fallbackReason);

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "채팅 라우트에서 알 수 없는 오류가 발생했습니다.";
    const status = error instanceof RouteError ? error.status : 500;
    console.error("Chat route failed:", error);
    return NextResponse.json({ detail }, { status });
  }
}

function parseChatRequest(body: unknown): ParsedChatRequest {
  if (!body || typeof body !== "object") {
    throw new RouteError("요청 본문이 비어 있습니다.", 400);
  }

  const candidate = body as Partial<ChatRequest>;
  const messages = Array.isArray(candidate.messages)
    ? candidate.messages.filter(
        (message): message is ChatRequest["messages"][number] =>
          Boolean(message) &&
          typeof message === "object" &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0,
      )
    : [];

  if (messages.length === 0) {
    throw new RouteError("최소 한 개 이상의 대화 메시지가 필요합니다.", 400);
  }

  const mode: ChatMode = candidate.mode === "quick" ? "quick" : "research";
  const caseContext =
    typeof candidate.caseContext === "string" && candidate.caseContext.trim().length > 0
      ? candidate.caseContext.trim()
      : "별도 사건 개요 없음";

  return {
    messages,
    caseContext,
    mode,
  };
}

async function runChatFlow(parsedRequest: ParsedChatRequest, apiKey: string): Promise<AttemptResult> {
  const mcpUrl = process.env.KOREAN_LAW_MCP_URL?.trim();

  if (!mcpUrl) {
    const payload = await createResponseRequest({
      apiKey,
      parsedRequest,
    });
    return {
      payload,
      fallbackReason:
        "법률 MCP 서버가 설정되지 않아 일반 AI 응답으로 처리했습니다. 배포 환경에 KOREAN_LAW_MCP_URL을 추가하면 법령 조회를 함께 사용할 수 있습니다.",
    };
  }

  try {
    const payload = await createResponseRequest({
      apiKey,
      parsedRequest,
      mcpUrl,
      allowedTools: MCP_ALLOWED_TOOLS,
    });
    return { payload };
  } catch (error) {
    console.error("Chat with restricted MCP tools failed:", error);
  }

  try {
    const payload = await createResponseRequest({
      apiKey,
      parsedRequest,
      mcpUrl,
    });
    return {
      payload,
      fallbackReason:
        "초기 제한 도구 구성이 맞지 않아 전체 MCP 도구 목록으로 다시 시도했습니다.",
    };
  } catch (error) {
    console.error("Chat with unrestricted MCP tools failed:", error);
  }

  const payload = await createResponseRequest({
    apiKey,
    parsedRequest,
  });

  return {
    payload,
    fallbackReason:
      "법령 근거 조회 실패로 일반 AI 응답으로만 처리했습니다. MCP 서버 URL 또는 인증키 설정을 확인해 주세요.",
  };
}

async function createResponseRequest({
  apiKey,
  parsedRequest,
  mcpUrl,
  allowedTools,
}: {
  apiKey: string;
  parsedRequest: ParsedChatRequest;
  mcpUrl?: string;
  allowedTools?: string[];
}): Promise<OpenAIResponsesPayload> {
  const tool = mcpUrl ? buildMcpTool(mcpUrl, allowedTools) : null;
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      input: buildPrompt(parsedRequest),
      tools: tool ? [tool] : [],
    }),
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });

  const payload = (await response.json()) as OpenAIResponsesPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "OpenAI Responses API 요청에 실패했습니다.");
  }

  return payload;
}

function buildMcpTool(mcpUrl: string, allowedTools?: string[]) {
  const tool: Record<string, unknown> = {
    type: "mcp",
    server_label: "korean_law",
    server_description:
      "대한민국 법령, 판례, 해석례, 자치법규를 조회하는 Korean Law MCP 서버",
    server_url: mcpUrl,
    require_approval: "never",
  };

  if (allowedTools && allowedTools.length > 0) {
    tool.allowed_tools = allowedTools;
  }

  const authorization = process.env.KOREAN_LAW_MCP_AUTHORIZATION?.trim();
  if (authorization) {
    tool.authorization = authorization;
  }

  return tool;
}

function buildPrompt(parsedRequest: ParsedChatRequest) {
  const conversation = parsedRequest.messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const modeInstruction =
    parsedRequest.mode === "quick"
      ? "빠르게 핵심 쟁점과 바로 확인할 법 조문 위주로 정리하세요."
      : "가능하면 법령, 판례, 해석례를 먼저 찾고 근거를 구조화해 주세요.";

  return [
    "당신은 대한민국 법률 이슈를 정리하는 AI 법률비서입니다.",
    "가능하면 Korean Law MCP를 사용해 관련 법령(법 조문), 판례, 해석례를 찾으세요.",
    "답변은 한국어로 작성하고, 단정적 결론보다 참고용 정리와 다음 확인 포인트를 우선하세요.",
    "전문가 확정 자문처럼 말하지 말고, 최신 개정 여부와 사실관계 추가 확인 필요성을 안내하세요.",
    modeInstruction,
    '반드시 아래 JSON만 반환하세요. 코드블록 없이 반환합니다: {"answer":"", "citations":[{"title":"","sourceType":"law|precedent|interpretation","reference":"","summary":"","url":"","identifier":""}], "disclaimer":"", "usedSources":[""]}',
    "",
    `[사건 개요]\n${parsedRequest.caseContext}`,
    "",
    `[대화 기록]\n${conversation}`,
  ].join("\n");
}

function buildChatResponse(payload: OpenAIResponsesPayload, fallbackReason?: string): ChatResponse {
  const structured = parseStructuredAnswer(payload.output_text);
  const toolTrace = extractToolTrace(payload.output);
  const disclaimer =
    structured?.disclaimer?.trim() ||
    "이 답변은 참고용 정보 정리입니다. 실제 조치 전에는 사실관계, 최신 법령(현재 시행 규정), 개별 문서 내용을 다시 확인해 주세요.";

  return {
    answer:
      structured?.answer?.trim() ||
      "답변 형식을 정리하지 못했습니다. 다시 질문하면 더 구조화된 결과를 드릴 수 있습니다.",
    citations: sanitizeCitations(structured?.citations ?? []),
    disclaimer,
    toolTrace:
      toolTrace.length > 0
        ? toolTrace
        : [
            {
              serverLabel: "korean_law",
              toolName: "not_used",
              status: "skipped",
              detail: "이번 응답에서는 MCP 도구 호출 기록이 확인되지 않았습니다.",
            },
          ],
    usedSources:
      structured?.usedSources?.filter((item) => typeof item === "string" && item.trim().length > 0) ??
      [],
    fallbackReason,
  };
}

function parseStructuredAnswer(outputText?: string): ModelStructuredAnswer | null {
  if (!outputText || outputText.trim().length === 0) {
    return null;
  }

  const normalized = outputText.trim();
  const jsonText = extractJsonObject(normalized);
  if (!jsonText) {
    return {
      answer: normalized,
      citations: [],
      disclaimer:
        "구조화된 근거 데이터를 만들지 못해 일반 텍스트 답변으로만 반환했습니다. 실제 조치 전에는 최신 규정을 다시 확인해 주세요.",
      usedSources: [],
    };
  }

  try {
    return JSON.parse(jsonText) as ModelStructuredAnswer;
  } catch (error) {
    console.error("Failed to parse structured answer JSON:", error);
    return {
      answer: normalized,
      citations: [],
      disclaimer:
        "구조화된 근거 데이터를 해석하지 못해 일반 텍스트 답변으로만 반환했습니다. 실제 조치 전에는 최신 규정을 다시 확인해 주세요.",
      usedSources: [],
    };
  }
}

function extractJsonObject(text: string) {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function sanitizeCitations(citations: CitationCard[]) {
  return citations
    .filter(
      (citation) =>
        Boolean(citation) &&
        typeof citation.title === "string" &&
        citation.title.trim().length > 0 &&
        typeof citation.reference === "string" &&
        citation.reference.trim().length > 0 &&
        typeof citation.summary === "string" &&
        citation.summary.trim().length > 0 &&
        (citation.sourceType === "law" ||
          citation.sourceType === "precedent" ||
          citation.sourceType === "interpretation"),
    )
    .map((citation) => ({
      title: citation.title.trim(),
      sourceType: citation.sourceType,
      reference: citation.reference.trim(),
      summary: citation.summary.trim(),
      url: typeof citation.url === "string" && citation.url.trim().length > 0 ? citation.url.trim() : undefined,
      identifier:
        typeof citation.identifier === "string" && citation.identifier.trim().length > 0
          ? citation.identifier.trim()
          : undefined,
    }));
}

function extractToolTrace(output?: OpenAIResponsesPayload["output"]): ToolTraceItem[] {
  if (!output) {
    return [];
  }

  return output
    .filter((item): item is OpenAIMcpCall => item.type === "mcp_call")
    .map((item) => ({
      serverLabel: item.server_label ?? "korean_law",
      toolName: item.name ?? "unknown_tool",
      status: item.error ? "failed" : "used",
      detail: item.error
        ? String(item.error)
        : summarizeToolOutput(typeof item.output === "string" ? item.output : ""),
    }));
}

function summarizeToolOutput(output: string) {
  const compact = output.replace(/\s+/g, " ").trim();
  if (compact.length === 0) {
    return "도구 호출은 수행됐지만 반환 요약이 비어 있습니다.";
  }

  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}
