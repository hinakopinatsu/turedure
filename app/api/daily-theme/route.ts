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

function todayInJapan() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
    const date = todayInJapan();
    const { data: existing, error: existingError } = await supabase
      .from("themes")
      .select("id")
      .eq("date", date)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json({ created: false, date });
    }

    const { data: previous, error: previousError } = await supabase
      .from("themes")
      .select("title")
      .lt("date", date)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousError) throw previousError;
    const theme = chooseDailyTheme(date, previous?.title);
    const { data: created, error: insertError } = await supabase
      .from("themes")
      .insert({ date, title: theme.title, seasonal_text: theme.seasonalText })
      .select("id,date,title,seasonal_text")
      .single();

    // 同時実行時はthemes.dateの一意制約を冪等性の最後の砦にする。
    if (insertError?.code === "23505") {
      return NextResponse.json({ created: false, date });
    }
    if (insertError) throw insertError;

    return NextResponse.json({ created: true, theme: created }, { status: 201 });
  } catch (error) {
    console.error("daily-theme cron failed", error);
    return NextResponse.json({ error: "Failed to prepare daily theme" }, { status: 500 });
  }
}
