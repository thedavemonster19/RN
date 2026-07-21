// Supabase Edge Function: verify-run
//
// The ONLY path by which a daily-challenge score reaches the leaderboard.
// The client sends its event log; this function re-runs the entire economy
// from that day's seed and works out the score itself. The number the client
// claims is only ever compared, never trusted — and because the client has no
// insert/update rights on daily_scores (RLS), it cannot go around this.
//
// Deploy:  supabase functions deploy verify-run
//
// It writes with the service_role key, which is injected by the platform as an
// env var and never leaves the server. That key must never appear in the game
// bundle.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyRun, REPLAY_VERSION } from "../_shared/replay.ts";

const ALLOWED_ORIGINS = [
  "https://thedavemonster19.github.io",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/** Today and yesterday in UTC — players in other timezones roll over early. */
function acceptableKeys(): string[] {
  const now = Date.now();
  return [0, 1, -1].map((d) =>
    new Date(now - d * 86400000).toISOString().slice(0, 10)
  );
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    // --- who is this? -------------------------------------------------------
    // Identity comes from the caller's JWT, never from the request body, so a
    // player cannot submit a score as somebody else.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return json({ accepted: false, reason: "Not signed in" }, 401);
    }
    const userId = userData.user.id;

    // --- what are they claiming? -------------------------------------------
    const body = await req.json().catch(() => null);
    if (!body) return json({ accepted: false, reason: "Bad request body" }, 400);

    const { daily_key, seed, score, events, version } = body;
    if (version !== REPLAY_VERSION) {
      return json({
        accepted: false,
        reason: `Client version ${version} no longer accepted (server is ${REPLAY_VERSION})`,
      });
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
      return json({ accepted: false, reason: "Bad score" });
    }

    // A daily run is pinned to an open challenge date; a casual run carries its
    // own seed. Either way the run is re-simulated, never trusted.
    const isDaily = typeof daily_key === "string" && daily_key.length > 0;
    if (isDaily && !acceptableKeys().includes(daily_key)) {
      return json({ accepted: false, reason: "Not an open daily challenge" });
    }
    if (!isDaily && (typeof seed !== "number" || !Number.isFinite(seed))) {
      return json({ accepted: false, reason: "Missing run seed" });
    }

    // --- re-run the whole thing --------------------------------------------
    const result = verifyRun(
      isDaily ? { dailyKey: daily_key } : { seed },
      events,
      score
    );
    if (!result.ok) {
      return json({ accepted: false, verified: false, reason: result.reason });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- all-time board: every verified run counts, best one kept ----------
    const { data: bestRow } = await admin
      .from("best_scores")
      .select("score")
      .eq("user_id", userId)
      .maybeSingle();
    if (!bestRow || bestRow.score < result.score) {
      await admin.from("best_scores").upsert(
        {
          user_id: userId,
          score: result.score,
          milestone: result.biggestTier,
          feeds: result.feeds,
          drops: result.drops,
          game_version: REPLAY_VERSION,
          verified: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    if (!isDaily) {
      return json({ accepted: true, verified: true, score: result.score });
    }

    // --- daily board: one row per player per day, best kept ---------------
    const { data: existing } = await admin
      .from("daily_scores")
      .select("score")
      .eq("user_id", userId)
      .eq("daily_key", daily_key)
      .maybeSingle();

    if (existing && existing.score >= result.score) {
      return json({
        accepted: true,
        verified: true,
        score: result.score,
        improved: false,
      });
    }

    const { error: writeErr } = await admin.from("daily_scores").upsert(
      {
        user_id: userId,
        daily_key,
        score: result.score,
        milestone: 0,
        feeds: result.feeds,
        drops: result.drops,
        game_version: REPLAY_VERSION,
        verified: true,
      },
      { onConflict: "user_id,daily_key" }
    );
    if (writeErr) return json({ accepted: false, reason: writeErr.message }, 500);

    return json({ accepted: true, verified: true, score: result.score, improved: true });
  } catch (e) {
    return json({ accepted: false, reason: `Server error: ${e}` }, 500);
  }
});
