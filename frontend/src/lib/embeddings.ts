/**
 * DAMA Embedding Utility (Point 21)
 * Handles converting text into semantic vectors using OpenAI.
 */

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string || "").trim();
  if (!apiKey) {
    throw new Error("OpenAI API key missing for embeddings. Set VITE_OPENAI_API_KEY.");
  }

  const model = "text-embedding-3-small";

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text.replace(/\n/g, " "),
      model,
    }),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ error: { message: "Unknown error" } }));
    throw new Error(`Embedding failed: ${error.error.message}`);
  }

  const result = await resp.json();
  return result.data[0].embedding;
}
