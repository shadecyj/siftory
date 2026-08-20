import { OverallTrustSchema } from "@searchos/domain";
import { z } from "zod";
import { IdSchema } from "./common";

const ClaimRefNodeSchema = z.object({ type: z.literal("CLAIM_REF"), claimId: IdSchema }).strict();
const ParagraphNodeSchema = z
  .object({ type: z.literal("PARAGRAPH"), text: z.string().min(1), claimIds: z.array(IdSchema) })
  .strict();
const ListNodeSchema = z
  .object({
    type: z.literal("LIST"),
    items: z.array(z.object({ text: z.string().min(1), claimIds: z.array(IdSchema) }).strict()).min(1)
  })
  .strict();

export const AnswerNodeSchema = z.discriminatedUnion("type", [ClaimRefNodeSchema, ParagraphNodeSchema, ListNodeSchema]);

export const AnswerSectionSchema = z
  .object({
    id: z.string().min(1),
    heading: z.string().min(1),
    nodes: z.array(AnswerNodeSchema).min(1)
  })
  .strict();

export const StructuredResultSchema = z
  .object({
    runId: IdSchema,
    status: z.enum(["COMPLETE", "PARTIAL", "DRAFT"]),
    title: z.string().min(1),
    answerSections: z.array(AnswerSectionSchema).min(1),
    decisiveClaimIds: z.array(IdSchema).min(1),
    keyClaimIds: z.array(IdSchema).min(1),
    sourceIds: z.array(IdSchema).min(1),
    overallConfidence: OverallTrustSchema,
    confidenceReasonCodes: z.array(z.string().min(1)).min(1),
    confidenceExplanation: z.array(z.string().min(1)).min(1),
    limitations: z.array(z.string()),
    synthesisVersion: z.string().min(1)
  })
  .strict();

export type AnswerNode = z.infer<typeof AnswerNodeSchema>;
export type StructuredResult = z.infer<typeof StructuredResultSchema>;

export function collectStructuredResultClaimIds(result: StructuredResult): string[] {
  const ids = new Set([...result.decisiveClaimIds, ...result.keyClaimIds]);
  for (const section of result.answerSections) {
    for (const node of section.nodes) {
      if (node.type === "CLAIM_REF") ids.add(node.claimId);
      if (node.type === "PARAGRAPH") node.claimIds.forEach((id) => ids.add(id));
      if (node.type === "LIST") node.items.flatMap((item) => item.claimIds).forEach((id) => ids.add(id));
    }
  }
  return [...ids];
}
