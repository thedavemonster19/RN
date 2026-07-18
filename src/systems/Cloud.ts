import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import { RunRecord } from "./Save";

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

  constructor() {
    if (URL && ANON_KEY) {
      this.client = createClient(URL, ANON_KEY);
      // Pick up an existing session on boot, and follow sign-in/sign-out.
      this.client.auth.getSession().then(({ data }) => {
        this.session = data.session;
      });
      this.client.auth.onAuthStateChange((_event, session) => {
        this.session = session;
      });
    }
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

  /**
   * Sign up with email + password, then claim a username.
   *
   * Email (rather than username-only) is deliberate: Supabase can then handle
   * password resets, which a username-only scheme can't. The username is just
   * the public display name.
   */
  async signUp(
    email: string,
    password: string,
    username: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.client) return { ok: false, error: "Cloud not configured" };
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    this.session = data.session;
    if (!data.user) return { ok: false, error: "Check your email to confirm." };

    const { error: pErr } = await this.client
      .from("profiles")
      .insert({ id: data.user.id, username });
    if (pErr) {
      return {
        ok: false,
        error: pErr.code === "23505" ? "That username is taken." : pErr.message,
      };
    }
    return { ok: true };
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
   * Submit a daily-challenge result. Upserts so only one row exists per player
   * per day. NOTE: this is currently unverified — the score is whatever the
   * client says it is. See the leaderboard caveat in the project notes.
   */
  async submitDaily(
    dailyKey: string,
    run: RunRecord
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.client || !this.userId) return { ok: false, error: "Not signed in" };
    const { error } = await this.client.from("daily_scores").upsert(
      {
        user_id: this.userId,
        daily_key: dailyKey,
        score: run.score,
        milestone: run.milestone,
        feeds: run.feeds,
        drops: run.drops,
      },
      { onConflict: "user_id,daily_key" }
    );
    return error ? { ok: false, error: error.message } : { ok: true };
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
