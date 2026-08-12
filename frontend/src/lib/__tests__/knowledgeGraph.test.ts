import { describe, it, expect } from "vitest";
import { transformKnowledgeGraph } from "../knowledgeGraph";
import type { ItemDetail } from "../damaApi";

describe("transformKnowledgeGraph", () => {
  it("should return null if item is null", () => {
    expect(transformKnowledgeGraph(null)).toBeNull();
  });

  it("should return item.graph if it exists", () => {
    const item = {
      graph: { label: "Test Graph", children: [] },
    } as unknown as ItemDetail;
    expect(transformKnowledgeGraph(item)).toEqual(item.graph);
  });

  it("should transform knowledge_graph into a tree", () => {
    const item = {
      suttaid: "5.4.40",
      knowledge_graph: {
        nodes: [
          { id: "root1", label: "Root 1", type: "Support", pali: "Pali1" },
          { id: "child1", label: "Child 1" },
          { id: "child2", label: "Child 2" },
        ],
        edges: [
          { source: "root1", target: "child1", relation: "HAS_GROWTH", order: 1 },
          { source: "root1", target: "child2", relation: "HAS_GROWTH", order: 2 },
          { source: "child1", target: "child2", relation: "PARALLEL_TO" },
        ],
      },
    } as unknown as ItemDetail;

    const result = transformKnowledgeGraph(item);
    expect(result).not.toBeNull();
    expect(result?.label).toBe("TEACHING STRUCTURE");
    expect(result?.children).toHaveLength(1);
    expect(result?.children?.[0].label).toBe("Root 1 (Pali1)");
    expect(result?.children?.[0].children).toHaveLength(2);
    expect(result?.children?.[0].children?.[0].label).toBe("Child 1");
    expect(result?.children?.[0].children?.[1].label).toBe("Child 2");
    // PARALLEL_TO relation should be ignored in the tree structure
    expect(result?.children?.[0].children?.[0].children).toBeUndefined();
  });

  it("should respect edge order", () => {
    const item = {
      knowledge_graph: {
        nodes: [
          { id: "root", label: "Root" },
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [
          { source: "root", target: "b", relation: "HAS", order: 2 },
          { source: "root", target: "a", relation: "HAS", order: 1 },
        ],
      },
    } as unknown as ItemDetail;

    const result = transformKnowledgeGraph(item);
    expect(result?.children?.[0].children?.[0].label).toBe("A");
    expect(result?.children?.[0].children?.[1].label).toBe("B");
  });
});
