// This utility runs on your Nitro server to decide which DB to use for the user.
const REGIONS = {
  PRIMARY: "asia-south1",
  REPLICA: "us-central1"
};

const DB_ENDPOINTS = {
  "asia-south1": process.env.DB_URL_INDIA,
  "us-central1": process.env.DB_URL_US_REPLICA
};

/**
 * For the User Perspective:
 * - If the user is browsing/reading, use the local region.
 * - If the user is saving progress, use the primary region.
 */
export async function getDb(intent: 'read' | 'write' = 'read') {
  const currentRegion = process.env.VERCEL_REGION || process.env.GOOGLE_CLOUD_REGION || REGIONS.PRIMARY;

  // Rules for the User Experience
  let targetRegion = currentRegion;

  if (intent === 'write') {
    // All updates (bookmarks, quiz scores) MUST go to India
    targetRegion = REGIONS.PRIMARY;
  } else {
    // All browsing should use the local replica if available
    targetRegion = DB_ENDPOINTS[currentRegion] ? currentRegion : REGIONS.PRIMARY;
  }

  console.log(`[User Routing] Intent: ${intent} | Serving from: ${targetRegion}`);

  return {
    url: DB_ENDPOINTS[targetRegion],
    region: targetRegion,
    isReplica: targetRegion !== REGIONS.PRIMARY
  };
}
