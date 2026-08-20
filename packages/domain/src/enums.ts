import { z } from "zod";

export const RequestedModeSchema = z.enum(["AUTO", "QUICK", "COMPARE", "RESEARCH"]);
export const SearchModeSchema = z.enum(["QUICK", "COMPARE", "RESEARCH"]);
export const RunStateSchema = z.enum([
  "CREATED",
  "UNDERSTANDING",
  "PLANNING",
  "RETRIEVING",
  "EXTRACTING",
  "EVALUATING",
  "GAP_CHECK",
  "SYNTHESIZING",
  "MATERIALIZING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED"
]);
export const TrustLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]);
export const OverallTrustSchema = z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT", "MIXED"]);
export const EvidenceStanceSchema = z.enum(["SUPPORTS", "CONTRADICTS", "QUALIFIES", "CONTEXTUAL"]);
export const EvidenceRelevanceSchema = z.enum(["DIRECT", "PARTIAL", "CONTEXTUAL", "UNRELATED"]);
export const AuthoritySchema = z.enum(["STRONG", "ADEQUATE", "WEAK", "UNKNOWN"]);
export const PrimaryContextSchema = z.enum(["PRIMARY", "SECONDARY", "MIXED", "UNKNOWN"]);
export const FreshnessSchema = z.enum(["CURRENT", "ACCEPTABLE", "STALE", "UNKNOWN"]);
export const ClaimImportanceSchema = z.enum(["DECISIVE", "KEY", "SUPPORTING", "BACKGROUND"]);
export const ClaimTypeSchema = z.enum([
  "FACT",
  "CAPABILITY",
  "COMPARISON",
  "RECOMMENDATION",
  "DEFINITION",
  "PROCEDURE"
]);
export const ClaimStatusSchema = z.enum(["CANDIDATE", "EVALUATED", "INCLUDED", "EXCLUDED"]);
export const ConflictSeveritySchema = z.enum(["MINOR", "MATERIAL"]);
export const ConflictStatusSchema = z.enum(["OPEN", "EXPLAINED", "RESOLVED"]);
export const SourceTypeSchema = z.enum([
  "OFFICIAL_DOC",
  "GITHUB",
  "PAPER",
  "GOVERNMENT",
  "ARTICLE",
  "FORUM",
  "OTHER"
]);
export const EvidenceTypeSchema = z.enum(["QUOTE", "TABLE", "CODE", "DATA", "METADATA", "VISUAL"]);
export const StopReasonSchema = z.enum([
  "ANSWER_SUFFICIENT",
  "COVERAGE_SUFFICIENT",
  "DIMENSIONS_COMPLETE",
  "DIMINISHING_RETURNS",
  "BUDGET_EXHAUSTED",
  "NO_NEW_QUERY",
  "USER_CANCELLED",
  "RETRIEVAL_BLOCKED"
]);
export const RunTriggerSchema = z.enum(["INITIAL", "MODE_SWITCH", "RETRY", "CONTINUE", "UPDATE"]);

export type RequestedMode = z.infer<typeof RequestedModeSchema>;
export type SearchMode = z.infer<typeof SearchModeSchema>;
export type RunState = z.infer<typeof RunStateSchema>;
export type TrustLevel = z.infer<typeof TrustLevelSchema>;
export type OverallTrust = z.infer<typeof OverallTrustSchema>;
export type EvidenceStance = z.infer<typeof EvidenceStanceSchema>;
export type EvidenceRelevance = z.infer<typeof EvidenceRelevanceSchema>;
export type ClaimImportance = z.infer<typeof ClaimImportanceSchema>;
export type ClaimType = z.infer<typeof ClaimTypeSchema>;
export type ConflictSeverity = z.infer<typeof ConflictSeveritySchema>;
export type StopReason = z.infer<typeof StopReasonSchema>;
export type RunTrigger = z.infer<typeof RunTriggerSchema>;

export const runStateLabels: Record<RunState, string> = {
  CREATED: "已创建",
  UNDERSTANDING: "理解问题",
  PLANNING: "制定计划",
  RETRIEVING: "查找来源",
  EXTRACTING: "提取证据",
  EVALUATING: "验证证据",
  GAP_CHECK: "检查缺口",
  SYNTHESIZING: "整理结果",
  MATERIALIZING: "生成笔记",
  COMPLETED: "已完成",
  PARTIAL: "部分完成",
  FAILED: "失败",
  CANCELLED: "已取消"
};

export const trustLabels: Record<TrustLevel, string> = {
  HIGH: "高可信",
  MEDIUM: "中等可信",
  LOW: "低可信",
  INSUFFICIENT: "证据不足"
};
