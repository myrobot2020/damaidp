export function CanonQuote({
  text,
  source,
}: {
  text: string;
  /** Omitted on sutta reader when citation is shown above; still used on reflection answer. */
  source?: string;
}) {
  const paragraphs = (text ?? "").split("\n").filter((p) => p.trim().length > 0);

  return (
    <div className="border-y paper-rule px-5 py-8">
      <div className="space-y-6">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-reading text-[1.32rem] leading-[1.7] text-foreground tracking-tight"
          >
            {i === 0 ? `“${p}` : p}
            {i === paragraphs.length - 1 ? `”` : ""}
          </p>
        ))}
      </div>
      {source?.trim() ? (
        <div className="mt-6 label-mono text-muted-foreground">— {source}</div>
      ) : null}
    </div>
  );
}
