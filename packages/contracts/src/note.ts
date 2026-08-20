import { OverallTrustSchema, SearchModeSchema, TrustLevelSchema } from "@searchos/domain";
import { z } from "zod";
import { DateTimeSchema, IdSchema, OutputLocaleSchema } from "./common";

export const NoteCategorySchema = z.enum([
  "INBOX",
  "TECHNOLOGY",
  "AI_DATA",
  "PRODUCT_BUSINESS",
  "LEARNING_RESEARCH",
  "WORK",
  "LIFE",
  "OTHER"
]);

export const NoteClaimSchema = z
  .object({
    claimId: IdSchema,
    statementSnapshot: z.string().min(1),
    trustLevelSnapshot: TrustLevelSchema,
    displayOrder: z.number().int().nonnegative(),
    isKey: z.boolean()
  })
  .strict();

export const SearchNoteDraftSchema = z
  .object({
    id: IdSchema,
    ownerId: IdSchema,
    taskId: IdSchema,
    sourceRunId: IdSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    outputLocale: OutputLocaleSchema.optional(),
    mode: SearchModeSchema,
    overallConfidence: OverallTrustSchema,
    claims: z.array(NoteClaimSchema).min(1),
    createdAt: DateTimeSchema
  })
  .strict();

export const SearchNoteViewSchema = SearchNoteDraftSchema.extend({
  isSaved: z.boolean(),
  isFavorite: z.boolean(),
  category: NoteCategorySchema,
  myNotes: z.string(),
  updatedAt: DateTimeSchema,
  searchDate: DateTimeSchema
}).strict();

export const UpdateSearchNoteRequestSchema = z
  .object({
    myNotes: z.string().max(20_000).optional(),
    isFavorite: z.boolean().optional(),
    category: NoteCategorySchema.optional()
  })
  .strict()
  .refine((value) => value.myNotes !== undefined || value.isFavorite !== undefined || value.category !== undefined, {
    message: "At least one Search Note field is required."
  });

export type SearchNoteDraft = z.infer<typeof SearchNoteDraftSchema>;
export type SearchNoteView = z.infer<typeof SearchNoteViewSchema>;
export type NoteCategory = z.infer<typeof NoteCategorySchema>;
export type UpdateSearchNoteRequest = z.infer<typeof UpdateSearchNoteRequestSchema>;
