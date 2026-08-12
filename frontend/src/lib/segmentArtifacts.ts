export type SegmentArtifact = {
  type?: string;
  uri?: string;
};

export type SegmentDocument = {
  sutta_id?: string;
  segments?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export function normalizeWorkPath(uri: string): string {
  return uri.replace(/\\/g, "/").replace(/^data\/work\//, "");
}

export function getSegmentsWorkPath(artifacts: SegmentArtifact[] = []): string | null {
  const artifact = artifacts.find((item) => item.type === "segments" && item.uri);
  return artifact?.uri ? normalizeWorkPath(artifact.uri) : null;
}

export function updateSegmentSuttaId(document: SegmentDocument, suttaId: string): SegmentDocument {
  return {
    ...document,
    sutta_id: suttaId.trim(),
  };
}
