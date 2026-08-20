import { describe, expect, it } from "vitest";
import { suggestCategory } from "./index";

const claims = (statement: string) => [{ statement }];

describe("suggestCategory", () => {
  it.each([
    ["Python 怎么删除 dict key？", "Use dict.pop to remove the key.", "TECHNOLOGY"],
    ["How should I structure a React API client?", "TypeScript can model the response.", "TECHNOLOGY"],
    ["如何设计文献综述研究方法？", "先定义论文纳入标准。", "LEARNING_RESEARCH"],
    ["How do I plan a literature review?", "Academic sources should be screened.", "LEARNING_RESEARCH"],
    ["周末去杭州旅行怎么安排？", "旅行路线应考虑交通时间。", "LIFE"],
    ["What is a good home fitness routine?", "Daily exercise can be progressive.", "LIFE"],
    ["这是什么？", "当前信息不足。", "INBOX"]
  ])("classifies %s", (question, statement, expected) => {
    expect(suggestCategory(question, claims(statement))).toBe(expected);
  });
});
