import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import { RunRecord } from "./Save";
import { ReplayEvent, REPLAY_VERSION } from "./Replay";

/**
 * Everything that talks to Supabase.
 *
 * The whole module is optional by design: if the env vars aren't set, `enabled`
 * is false and every call is a no-op that resolves safely. The game must stay
 * completely playable offline and un-signed-in — accounts are a bonus, never a
 * gate. That also means this file can ship before the backend exists.
 *
 * The anon key is compiled into the public bundle. That's how Supabase is meant
 * to work; Row Level Security (see supabase/schema.sql) is what actually
 * protects the data. The service_role key must never appear here.
 */
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface LeaderboardRow {
  username: string;
  monster: string;
  score: number;
  milestone: number;
  verified: boolean;
}

export interface CloudProfile {
  username: string;
  monster: string;
  best_score: number;
  best_run: RunRecord | null;
  runs: number;
}

class CloudService {
  private client: SupabaseClient | null = null;
  private session: Session | null = null;
  /**
   * Resolves once the stored session has been read back from disk.
   *
   * Restoring a session is asynchronous, so anything that asks "is the player
   * signed in?" during the first moments after load can get a false negative —
   * which would silently skip posting a score. Await this first.
   */
  readonly ready: Promise<void>;

  constructor() {
    if (!URL || !ANON_KEY) {
      this.ready = Promise.resolve();
      return;
    }
    this.client = createClient(URL, ANON_KEY);
    this.ready = this.client.auth.getSession().then(({ data }) => {
      this.session = data.session;
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      this.session = session;
    });
  }

  /** False until the project URL + anon key are configured. */
  get enabled(): boolean {
    return this.client !== null;
  }

  get signedIn(): boolean {
    return this.session !== null;
  }

  get userId(): string | null {
    return this.session?.user.id ?? null;
  }

  /** True if someone already has this username. */
  async usernameTaken(username: string): Promise<boolean> {
    if (!this.client) return false;
    const { data } = await this.client
      .from("profiles")
      .select("username")
      .ilike("username", username)
      .limit(1);
    return !!data && data.length > 0;
  }

  /**
   * Sign up with email + password, claiming a username.
   *
   * Email (rather than username-only) is deliberate: Supabase can then handle
   * password resets, which a username-only scheme can't. The username is just
   * the public display name.
   *
   * The profile row is created by a database trigger, not here — with email
   * confirmation enabled, sign-up returns no session, so a client insert would
   * have no auth.uid() and RLS would (correctly) reject it. We pass the desired
   * username as user metadata and the trigger picks it up.
   *
   * `needsConfirmation` tells the caller to send the player to their inbox
   * rather than straight into a signed-in state.
   */
  async signUp(
    email: string,
    password: string,
    username: string
  ): Promise<{ ok: boolean; error?: string; needsConfirmation?: boolean }> {
    if (!this.client) return { ok: false, error: "Cloud not configured" };

    if (await this.usernameTaken(username)) {
      return { ok: false, error: "That username is taken." };
    }

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) return { ok: false, error: error.message };

    this.session = data.session;
    return { ok: true, needsConfirmation: data.session === null };
  }

  async signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.client) return { ok: false, error: "Cloud not configured" };
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { ok: false, error: error.message };
    this.session = data.session;
    return { ok: true };
  }

  async signOut(): Promise<void> {
    await this.client?.auth.signOut();
    this.session = null;
  }

  async fetchProfile(): Promise<CloudProfile | null> {
    if (!this.client || !this.userId) return null;
    const { data, error } = await this.client
      .from("profiles")
      .select("username, monster, best_score, best_run, runs")
      .eq("id", this.userId)
      .single();
    if (error) return null;
    return data as CloudProfile;
  }

  /** Mirror local progress up. Only overwrites the best if this run beat it. */
  async pushProgress(
    monster: string,
    best: number,
    bestRun: RunRecord | null,
    runs: number
  ): Promise<void> {
    if (!this.client || !this.userId) return;
    await this.client
      .from("profiles")
      .update({ monster, best_score: best, best_run: bestRun, runs, updated_at: new Date().toISOString() })
      .eq("id", this.userId)
      .lt("best_score", best);
  }

  /**
   * Submit a daily-challenge result for verification.
   *
   * The score is NOT sent as a fact — it goes to the `verify-run` edge
   * function along with the event log, and the server re-runs the whole
   * economy from the day's seed to work out the real score itself. The client
   * cannot write to daily_scores directly (RLS forbids it), so a tampered
   * score simply fails to reproduce and is rejected.
   */
  async submitDaily(
    dailyKey: string,
    run: RunRecord,
    events: ReplayEvent[]
  ): Promise<{ ok: boolean; error?: string; verified?: boolean }> {
    if (!this.client || !this.userId) return { ok: false, error: "Not signed in" };
    const { data, error } = await this.client.functions.invoke("verify-run", {
      body: {
        daily_key: dailyKey,
        score: run.score,
        events,
        version: REPLAY_VERSION,
      },
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: !!data?.accepted,
      verified: !!data?.verified,
      error: data?.reason,
    };
  }

  async leaderboard(dailyKey: string, limit = 50): Promise<LeaderboardRow[]> {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from("daily_leaderboard")
      .select("username, monster, score, milestone, verified")
      .eq("daily_key", dailyKey)
      .order("score", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as LeaderboardRow[];
  }
}

export const Cloud = new CloudService();
