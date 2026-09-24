type ThemeCandidate = { title: string; seasonalText: string };
type Season = "spring" | "summer" | "autumn" | "winter";

const titleParts: Record<Season, { subjects: string[]; endings: string[] }> = {
  spring: {
    subjects: ["花", "霞", "若草", "春雨", "雲雀", "芽吹き", "東風", "桜", "旅立ち", "雪解け", "朝霞", "燕"],
    endings: ["の記憶", "を待つ", "に託すもの", "の向こう", "がほどける頃", "からの便り", "に残した言葉", "と帰り道"],
  },
  summer: {
    subjects: ["青葉", "夕立", "蛍", "夏雲", "風鈴", "泉", "白雨", "蝉時雨", "夕凪", "星空", "水面", "遠雷"],
    endings: ["の記憶", "を待つ", "に託すもの", "の向こう", "がほどける頃", "からの便り", "に残した言葉", "と帰り道"],
  },
  autumn: {
    subjects: ["月", "薄", "木犀", "秋風", "雁", "露", "虫の音", "夕暮れ", "紅葉", "夜長", "秋桜", "鰯雲"],
    endings: ["の記憶", "を待つ", "に託すもの", "の向こう", "がほどける頃", "からの便り", "に残した言葉", "と帰り道"],
  },
  winter: {
    subjects: ["初雪", "霜夜", "冬木立", "白息", "寒月", "焚火", "氷", "北風", "雪明り", "冬星", "枯野", "春待ち"],
    endings: ["の記憶", "を待つ", "に託すもの", "の向こう", "がほどける頃", "からの便り", "に残した言葉", "と帰り道"],
  },
};

const seasonalTexts: Record<Season, string[]> = {
  spring: ["霞の奥に、春の気配", "若草を渡る、やわらかな風", "散る花に、過ぎし日を思う"],
  summer: ["青葉に宿る、雨の匂い", "明けやすき夜に、月は淡く", "泉の音に、涼をたずねる"],
  autumn: ["露を結ぶ野に、虫の音ひとつ", "夕暮れの薄、風にかたむく", "澄む夜空に、月ひとつ"],
  winter: ["霜夜の庵に、灯ひとつ", "冬木立を抜ける、冴えた風", "雪待つ空に、音はなく"],
};

const themesBySeason = Object.fromEntries(
  (Object.keys(titleParts) as Season[]).map((season) => {
    const { subjects, endings } = titleParts[season];
    const themes = subjects.flatMap((subject, subjectIndex) =>
      endings.map((ending, endingIndex) => ({
        title: `${subject}${ending}`,
        seasonalText: seasonalTexts[season][(subjectIndex + endingIndex) % seasonalTexts[season].length],
      })),
    );
    return [season, themes];
  }),
) as Record<Season, ThemeCandidate[]>;

function seasonForMonth(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function dateSeed(date: string) {
  return Array.from(date).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
}

export function chooseDailyTheme(date: string, recentTitles: string[] = []): ThemeCandidate {
  const month = Number(date.slice(5, 7));
  const seasonalCandidates = themesBySeason[seasonForMonth(month)];
  const candidates = seasonalCandidates.filter((candidate) => !recentTitles.includes(candidate.title));
  const pool = candidates.length > 0 ? candidates : seasonalCandidates;
  return pool[dateSeed(date) % pool.length];
}
