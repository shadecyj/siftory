import { z } from "zod";

export const IdSchema = z.string().uuid();
export const DateTimeSchema = z.string().datetime({ offset: true });
export const UrlSchema = z.string().url();
export const OutputLocaleSchema = z.enum(["zh-CN", "en-US"]);
export type OutputLocale = z.infer<typeof OutputLocaleSchema>;

export const LocatorSchema = z
  .object({
    blockId: z.string().min(1).optional(),
    heading: z.string().min(1).optional(),
    paragraph: z.number().int().positive().optional(),
    lineStart: z.number().int().positive().optional(),
    lineEnd: z.number().int().positive().optional(),
    page: z.number().int().positive().optional(),
    selector: z.string().min(1).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Evidence locator must not be empty.");
