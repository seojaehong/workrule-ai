import type { ReviewDiagnosisRequest, ReviewDiagnosisResult } from "@/lib/types";

export const FOCUS_AREA_OPTIONS = [
  "육아휴직",
  "임금명세서",
  "배우자 출산휴가",
  "징계",
  "안전보건",
  "직장 내 괴롭힘",
];

export const STANDARD_RULE_SNIPPET = `제23조(배우자 출산휴가)
회사는 근로자가 배우자의 출산을 이유로 휴가를 청구하는 경우 관련 법령에 따라 휴가를 부여한다.

제38조(육아휴직)
회사는 관련 법령에 따라 육아휴직 및 육아기 근로시간 단축을 보장한다.

제52조(임금명세서)
회사는 임금 지급 시 근로자에게 임금의 구성항목, 계산방법, 공제내역이 포함된 임금명세서를 교부한다.`;

export const DEMO_REQUEST: ReviewDiagnosisRequest = {
  company_name: "세이프워크 주식회사",
  industry: "제조업",
  employee_count: 85,
  focus_areas: ["육아휴직", "임금명세서", "안전보건"],
  review_date: "2026-04-01",
  company_rule_text: `제21조(배우자 출산휴가)
회사는 배우자 출산 시 10일의 휴가를 부여한다.

제35조(육아휴직)
회사는 만 8세 이하 자녀를 둔 근로자에게 1년의 범위에서 육아휴직을 허용한다.

제49조(임금지급)
회사는 임금을 매월 25일 지급한다.`,
  standard_rule_text: STANDARD_RULE_SNIPPET,
};

export const DEMO_RESULT: ReviewDiagnosisResult = {
  summary: {
    company_name: "세이프워크 주식회사",
    standard_version: "MOEL Standard Employment Rules 2026-02",
    review_date: "2026-04-01",
    total_findings: 4,
    critical_count: 1,
    urgent_count: 1,
    important_count: 2,
    normal_count: 0,
    reference_count: 0,
    top_findings: [
      "배우자 출산휴가 기간이 현행 기준보다 짧습니다.",
      "육아휴직 및 육아기 근로시간 단축 기준이 2025년 개정을 반영하지 못했습니다.",
      "임금명세서 교부 의무가 명시되지 않았습니다.",
      "안전보건 관련 필수기재사항 구조가 부족합니다.",
    ],
  },
  clause_mappings: [
    {
      company_clause: "제21조(배우자 출산휴가)",
      standard_clause: "제23조(배우자 출산휴가)",
      status: "partial",
      notes: "휴가 부여 구조는 있으나 기간 및 사용 방식이 최신 기준과 다릅니다.",
    },
    {
      company_clause: "제35조(육아휴직)",
      standard_clause: "제38조(육아휴직)",
      status: "partial",
      notes: "기본 구조는 있으나 기간, 대상 자녀 연령, 분할사용 기준 업데이트가 필요합니다.",
    },
    {
      company_clause: "제49조(임금지급)",
      standard_clause: "제52조(임금명세서)",
      status: "missing",
      notes: "임금명세서 교부에 관한 독립 규정이 보이지 않습니다.",
    },
  ],
  required_item_checks: [
    {
      item_key: "wage_statement",
      item_label: "임금 결정·계산·지급방법",
      is_present: false,
      related_clause: null,
      notes: "임금 지급 시기만 있고 명세서 교부 구조는 누락돼 있습니다.",
    },
    {
      item_key: "work_life_balance",
      item_label: "모성보호 및 일·가정 양립 지원",
      is_present: true,
      related_clause: "제35조",
      notes: "존재하지만 최신 개정 반영이 불충분합니다.",
    },
  ],
  findings: [
    {
      finding_id: "F-001",
      clause_title: "제21조(배우자 출산휴가)",
      priority: "critical",
      review_type: "legal_update_missing",
      related_laws: ["남녀고용평등법 제18조의2"],
      current_text: "회사는 배우자 출산 시 10일의 휴가를 부여한다.",
      suggested_text:
        "회사는 근로자가 배우자의 출산을 이유로 청구하는 경우 관련 법령에 따른 기간과 방식으로 배우자 출산휴가를 부여한다.",
      reason: "배우자 출산휴가 기간 및 사용 방식이 최신 기준과 불일치합니다.",
    },
    {
      finding_id: "F-002",
      clause_title: "제35조(육아휴직)",
      priority: "urgent",
      review_type: "legal_update_missing",
      related_laws: ["남녀고용평등법 제19조", "남녀고용평등법 제19조의2"],
      current_text: "회사는 만 8세 이하 자녀를 둔 근로자에게 1년의 범위에서 육아휴직을 허용한다.",
      suggested_text:
        "회사는 관련 법령에 따라 육아휴직, 육아기 근로시간 단축, 분할사용 기준을 보장한다.",
      reason: "기간, 자녀 연령, 분할사용 횟수 등 2025년 개정사항 반영이 필요합니다.",
    },
    {
      finding_id: "F-003",
      clause_title: "임금명세서 조항 누락",
      priority: "important",
      review_type: "required_missing",
      related_laws: ["근로기준법 제48조"],
      current_text: "해당 조문 없음",
      suggested_text:
        "회사는 임금 지급 시 근로자에게 임금의 구성항목, 계산방법, 공제내역이 포함된 임금명세서를 교부한다.",
      reason: "임금명세서 교부 의무를 독립 조문으로 명시할 필요가 있습니다.",
    },
    {
      finding_id: "F-004",
      clause_title: "안전보건 조항 구조",
      priority: "important",
      review_type: "recommendation",
      related_laws: ["근로기준법 제93조", "산업안전보건법"],
      current_text: "안전보건 관련 조문이 축약돼 있음",
      suggested_text:
        "안전교육, 보호구 지급, 재해 발생 시 조치 절차를 별도 항으로 체계화한다.",
      reason: "제조업 사업장 특성을 고려하면 안전보건 절차 문구를 더 명확히 둘 필요가 있습니다.",
    },
  ],
  user_confirmations: [
    {
      item_id: "C-001",
      clause_title: "안전보건 조항",
      question: "교대근무 및 야간작업 절차를 별도로 운영하고 있나요?",
      background: "제조업 사업장이라면 안전보건 문구의 상세 수준이 달라질 수 있습니다.",
      options: [
        "교대근무와 야간작업 절차를 취업규칙에 포함한다.",
        "별도 안전보건 규정으로 분리하고 취업규칙에는 연계 문구만 둔다.",
      ],
      recommendation: "실제 운영 문서가 별도로 있다면 상호 참조 구조가 더 안전합니다.",
    },
  ],
  optional_recommendations: [
    "선택 조항으로 감정노동 보호 또는 고객응대 근로자 보호 문구 도입을 검토할 수 있습니다.",
  ],
};
