import { describe, it, expect, vi, beforeEach } from "vitest";
import * as tools from "../harnessTools";
import { supabase } from "../supabase";
import * as embeddings from "../embeddings";

vi.mock("../supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user_123" } } }),
    },
  },
}));

vi.mock("../embeddings", () => ({
  getEmbedding: vi.fn(),
}));

describe("Harness Tools (Unit Tests)", () => {
  const mockCtx = (overrides = {}): any => ({
    input: { text: "test query", channel: "ui" },
    intent: { kind: "corpus_search", entities: {} },
    state: {
      runId: "run_123",
      outputs: {},
      trace: [],
      startTime: Date.now(),
      steps: []
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("retrieveVectorCorpus", () => {
    it("falls back to keyword search if embedding fails", async () => {
      vi.mocked(embeddings.getEmbedding).mockRejectedValue(new Error("API Down"));

      // We expect it to log the error and successfully return an empty array (or fallback)
      // since retrieveCorpus will be called and it might return [] if no IDs provided.
      const result = await tools.retrieveVectorCorpus(mockCtx());
      expect(result).toEqual([]);
      expect(embeddings.getEmbedding).toHaveBeenCalled();
    });

    it("returns mapped results from Supabase match_suttas RPC", async () => {
      vi.mocked(embeddings.getEmbedding).mockResolvedValue([0.1, 0.2]);
      vi.mocked(supabase!.rpc).mockResolvedValue({
        data: [
          {
            sutta_id: "AN 1.1",
            content: "Sutta text",
            similarity: 0.9,
            metadata: { title: "Title" }
          }
        ],
        error: null
      });

      const result: any = await tools.retrieveVectorCorpus(mockCtx());
      expect(result).toHaveLength(1);
      expect(result[0].suttaid).toBe("AN 1.1");
      expect(result[0].similarity).toBe(0.9);
    });
  });

  describe("recordTrace", () => {
    it("attempts to sync trace to Supabase harness_traces table", async () => {
      const ctx = mockCtx({
        state: {
          runId: "run_999",
          intent: { kind: "reflection", confidence: 1.0 },
          trace: [{ stepId: "step1", status: "succeeded" }],
          startTime: Date.now(),
          outputs: {},
          input: { text: "hello" },
          steps: []
        }
      });

      await tools.recordTrace(ctx);
      expect(supabase!.from).toHaveBeenCalledWith("harness_traces");
      expect(supabase!.from("harness_traces").insert).toHaveBeenCalled();
    });
  });
});
