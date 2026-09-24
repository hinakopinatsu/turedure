import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { chooseDailyTheme } from "@/lib/dailyThemes";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || !authorization) return false;

  const supplied = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function dateInJapan(offsetDays = 0) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(`${today}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function prepareTodayMatches(supabase: ReturnType<typeof createServerSupabase>, battleDate: string) {
  const sourceDate = dateInJapan(-1);
  const { data: theme, error: themeError } = await supabase.from("themes").select("id").eq("date", sourceDate).maybeSingle();
  if (themeError) throw themeError;
  if (!theme) return { sourceDate, created: 0, reason: "theme-not-found" };

  const { data: poems, error: poemsError } = await supabase.from("poems").select("id").eq("theme_id", theme.id).order("id");
  if (poemsError) throw poemsError;
  if (!poems || poems.length < 2) return { sourceDate, themeId: theme.id, created: 0, reason: "not-enough-poems" };

  const pairs = poems.length === 2
    ? [{ theme_id: theme.id, left_poem_id: poems[0].id, right_poem_id: poems[1].id, battle_date: battleDate }]
    : poems.map((poem, index) => ({
        theme_id: theme.id,
        left_poem_id: poem.id,
        right_poem_id: poems[(index + 1) % poems.length].id,
        battle_date: battleDate,
      }));
  const { error } = await supabase.from("uta_awase_matches").upsert(pairs, {
    onConflict: "theme_id,left_poem_id,right_poem_id",
    ignoreDuplicates: true,
  });
  if (error) throw error;
  return { sourceDate, themeId: theme.id, created: pairs.length };
}

async function finalizePreviousResults(supabase: ReturnType<typeof createServerSupabase>) {
  const sourceDate = dateInJapan(-2);
  const { data: theme, error: themeError } = await supabase.from("themes").select("id").eq("date", sourceDate).maybeSingle();
  if (themeError) throw themeError;
  if (!theme) return { sourceDate, calculated: false, reason: "theme-not-found" };
  const { data: existing, error: existingError } = await supabase.from("uta_awase_results").select("id").eq("theme_id", theme.id).limit(1);
  if (existingError) throw existingError;
  if (existing?.length) return { sourceDate, themeId: theme.id, calculated: false, reason: "already-calculated" };
  const { error } = await supabase.rpc("calculate_uta_awase_results", { p_theme_id: theme.id });
  if (error) throw error;
  return { sourceDate, themeId: theme.id, calculated: true };
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const date = dateInJapan();
    const warnings: string[] = [];
    let results: Awaited<ReturnType<typeof finalizePreviousResults>> | null = null;
    let matches: Awaited<ReturnType<typeof prepareTodayMatches>> | null = null;
    try { results = await finalizePreviousResults(supabase); } catch (error) {
      console.error("daily uta-awase result calculation failed", error);
      warnings.push("result-calculation-failed");
    }
    try { matches = await prepareTodayMatches(supabase, date); } catch (error) {
      console.error("daily uta-awase match preparation failed", error);
      warnings.push("match-preparation-failed");
    }
    const { data: existing, error: existingError } = await supabase
      .from("themes")
      .select("id")
      .eq("date", date)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json({ created: false, date, matches, results, warnings });
    }

    const { data: usedThemes, error: usedThemesError } = await supabase
      .from("themes")
      .select("title")
      .lt("date", date)
      .order("date", { ascending: false });

    if (usedThemesError) throw usedThemesError;
    const theme = chooseDailyTheme(date, (usedThemes ?? []).map((row) => row.title));
    const { data: created, error: insertError } = await supabase
      .from("themes")
      .insert({ date, title: theme.title, seasonal_text: theme.seasonalText })
      .select("id,date,title,seasonal_text")
      .single();

    // 同時実行時はthemes.dateの一意制約を冪等性の最後の砦にする。
    if (insertError?.code === "23505") {
      return NextResponse.json({ created: false, date, matches, results, warnings });
    }
    if (insertError) throw insertError;

    return NextResponse.json({ created: true, theme: created, matches, results, warnings }, { status: 201 });
  } catch (error) {
    console.error("daily-theme cron failed", error);
    return NextResponse.json({ error: "Failed to prepare daily theme" }, { status: 500 });
  }
}
