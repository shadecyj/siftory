import { describe, expect, it } from "vitest";
import { getMessages, translate } from "./translate";

describe("Siftory locale catalog", () => {
  it("keeps Chinese and English key sets in parity", () => {
    expect(Object.keys(getMessages("zh-CN")).sort()).toEqual(Object.keys(getMessages("en-US")).sort());
  });

  it("formats variables without mutating evidence content", () => {
    expect(translate("en-US", "source.count", { sites: 2, evidence: 5 })).toBe("2 websites · 5 evidence items");
    expect(translate("zh-CN", "composer.useReplay", { question: "Python 怎么删除 dict key？" })).toContain("Python 怎么删除 dict key？");
  });

  it("uses the public Siftory identity in both language catalogs", () => {
    expect(translate("en-US", "app.productHome")).toBe("Siftory home");
    expect(translate("zh-CN", "home.guideAria")).toBe("Siftory 工作方式");
  });
});
