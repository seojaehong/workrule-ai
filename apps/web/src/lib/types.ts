export type ChatMode = "quick" | "research";

export type ChatRole = "user" | "assistant";

export type CitationSourceType = "law" | "precedent" | "interpretation";

export type ToolTraceStatus = "used" | "failed" | "skipped";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface CitationCard {
  title: string;
  sourceType: CitationSourceType;
  reference: string;
  summary: string;
  url?: string;
  identifier?: string;
}

export interface ToolTraceItem {
  serverLabel: string;
  toolName: string;
  status: ToolTraceStatus;
  detail: string;
}

export interface ChatRequestMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatRequestMessage[];
  caseContext: string;
  mode: ChatMode;
}

export interface ChatResponse {
  answer: string;
  citations: CitationCard[];
  disclaimer: string;
  toolTrace: ToolTraceItem[];
  usedSources: string[];
  fallbackReason?: string;
}
