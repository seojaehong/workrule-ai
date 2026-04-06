import type { ChatMessage, ChatMode } from "@/lib/types";

export const DEFAULT_CASE_CONTEXT =
  "사건 배경, 당사자 관계, 진행 일정, 이미 받은 통지서나 계약서 내용을 간단히 적어 주세요.";

export const STARTER_CHAT: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content:
      "안녕하세요. 상황을 정리해 주시면 관련 법령(법 조문), 판례(법원의 판단 사례), 해석례(행정기관의 해석)를 찾아서 참고용으로 정리해 드립니다.",
  },
];

export const STARTER_PROMPTS: Array<{
  title: string;
  mode: ChatMode;
  prompt: string;
}> = [
  {
    title: "해고 통지 검토",
    mode: "research",
    prompt:
      "회사에서 문자로 이번 달 말까지만 나오라고 했습니다. 해고예고(미리 알리는 절차)와 서면 통지 의무가 있는지 확인해 주세요.",
  },
  {
    title: "임금 체불 대응",
    mode: "research",
    prompt:
      "퇴사 후 마지막 달 급여와 연장수당을 받지 못했습니다. 어떤 근거로 요구할 수 있고 먼저 무엇부터 해야 하나요?",
  },
  {
    title: "빠른 요약",
    mode: "quick",
    prompt:
      "근로기준법상 연차휴가 기본 원칙을 빠르게 설명해 주세요. 핵심 조문이 있으면 함께 알려 주세요.",
  },
];

export const MODE_COPY: Record<ChatMode, { label: string; description: string }> = {
  quick: {
    label: "빠른 답변",
    description: "핵심 쟁점을 먼저 요약하고 필요한 근거만 짧게 정리합니다.",
  },
  research: {
    label: "근거 조사",
    description: "법령, 판례, 해석례를 우선 확인하고 정리된 참고 근거를 함께 보여줍니다.",
  },
};
