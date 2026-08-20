import { describe, expect, it } from "vitest";
import { CreateSearchTaskInputSchema, LocatorSchema, NoteCategorySchema, UpdateSearchNoteRequestSchema } from "./index";

describe("boundary contracts", () => {
  it("normalizes the default requested mode", () => {
    expect(CreateSearchTaskInputSchema.parse({ question: "Python dict 删除 key" }).requestedMode).toBe("AUTO");
  });

  it("rejects empty evidence locators", () => {
    expect(LocatorSchema.safeParse({}).success).toBe(false);
    expect(LocatorSchema.safeParse({ heading: "dict.pop" }).success).toBe(true);
  });

  it("rejects unknown boundary fields", () => {
    expect(CreateSearchTaskInputSchema.safeParse({ question: "test", model: "hidden-setting" }).success).toBe(false);
  });

  it("accepts only fixed Search Note categories", () => {
    expect(NoteCategorySchema.safeParse("AI_DATA").success).toBe(true);
    expect(NoteCategorySchema.safeParse("CUSTOM_FOLDER").success).toBe(false);
  });

  it("validates partial Search Note updates without accepting empty patches", () => {
    expect(UpdateSearchNoteRequestSchema.safeParse({ isFavorite: true, category: "TECHNOLOGY" }).success).toBe(true);
    expect(UpdateSearchNoteRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateSearchNoteRequestSchema.safeParse({ myNotes: "ok", evidence: "tamper" }).success).toBe(false);
  });
});
