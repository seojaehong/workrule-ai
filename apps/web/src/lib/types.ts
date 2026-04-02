export type ReviewPriority =
  | "critical"
  | "urgent"
  | "important"
  | "normal"
  | "reference";

export type ReviewType =
  | "violation"
  | "required_missing"
  | "legal_update_missing"
  | "wording_issue"
  | "recommendation";

export type MappingStatus = "matched" | "missing" | "custom" | "partial";

export interface ReviewDiagnosisRequest {
  company_name: string;
  company_rule_text: string;
  standard_rule_text: string;
  industry?: string;
  employee_count?: number;
  focus_areas: string[];
  review_date?: string;
}

export interface RuleMapping {
  company_clause: string;
  standard_clause: string | null;
  status: MappingStatus;
  notes: string;
}

export interface RequiredItemCheck {
  item_key: string;
  item_label: string;
  is_present: boolean;
  related_clause: string | null;
  notes: string;
}

export interface ReviewFinding {
  finding_id: string;
  clause_title: string;
  priority: ReviewPriority;
  review_type: ReviewType;
  related_laws: string[];
  current_text: string;
  suggested_text: string;
  reason: string;
}

export interface UserConfirmationItem {
  item_id: string;
  clause_title: string;
  question: string;
  background: string;
  options: string[];
  recommendation: string | null;
}

export interface ReviewSummary {
  company_name: string;
  standard_version: string;
  review_date: string;
  total_findings: number;
  critical_count: number;
  urgent_count: number;
  important_count: number;
  normal_count: number;
  reference_count: number;
  top_findings: string[];
}

export interface ReviewDiagnosisResult {
  summary: ReviewSummary;
  clause_mappings: RuleMapping[];
  required_item_checks: RequiredItemCheck[];
  findings: ReviewFinding[];
  user_confirmations: UserConfirmationItem[];
  optional_recommendations: string[];
}

export interface ExtractedDocument {
  filename: string;
  parser: string;
  media_type: string | null;
  extracted_text: string;
  normalized_text: string;
  char_count: number;
  line_count: number;
}

export interface DraftGenerationRequest {
  company_name: string;
  baseline_rule_text: string;
  diagnosis_result: ReviewDiagnosisResult;
}

export interface DraftGenerationResult {
  company_name: string;
  draft_title: string;
  export_filename: string;
  draft_plain_text: string;
  draft_markdown: string;
  applied_replacements: number;
  inserted_clauses: number;
  section_count: number;
  sections: string[];
  unresolved_findings: string[];
}
