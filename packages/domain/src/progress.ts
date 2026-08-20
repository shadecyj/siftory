import type { RunState } from "./enums";

export interface PublicProgressStage {
  readonly state: RunState;
  readonly label: string;
  readonly copy: string;
}

export const publicProgressStages: readonly PublicProgressStage[] = [
  { state: "UNDERSTANDING", label: "理解问题", copy: "识别任务意图与搜索模式" },
  { state: "RETRIEVING", label: "查找来源", copy: "优先查找与问题直接相关的官方资料" },
  { state: "EVALUATING", label: "验证证据", copy: "建立 Claim、Evidence 与 Source 的支持关系" },
  { state: "SYNTHESIZING", label: "整理结果", copy: "生成带置信度解释的结构化答案" }
] as const;
