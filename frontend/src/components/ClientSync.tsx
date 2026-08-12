import { useAuthSession } from "@/hooks/use-auth-session";
import { useAudioProgressSync } from "@/hooks/use-audio-progress-sync";
import { useReadingProgressSync } from "@/hooks/use-reading-progress-sync";
import { useUxLogSync } from "@/hooks/use-ux-log-sync";

export function ClientSync() {
  const { session, supabaseReady } = useAuthSession();
  useReadingProgressSync(session, supabaseReady);
  useAudioProgressSync(session, supabaseReady);
  useUxLogSync(session, supabaseReady);
  return null;
}
