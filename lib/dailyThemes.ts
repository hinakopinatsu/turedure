type ThemeCandidate = { title: string; seasonalText: string };

const themesBySeason: Record<"spring" | "summer" | "autumn" | "winter", ThemeCandidate[]> = {
  spring: [
    { title: "ほどけゆくもの", seasonalText: "霞の奥に、春の気配" },
    { title: "新しい道", seasonalText: "若草を渡る、やわらかな風" },
    { title: "花のあと", seasonalText: "散る花に、過ぎし日を思う" },
    { title: "遠い知らせ", seasonalText: "雁の帰る空、淡く霞みて" },
    { title: "待ちわびた朝", seasonalText: "東雲にほどける、春の光" },
  ],
  summer: [
    { title: "雨を待つ", seasonalText: "青葉に宿る、雨の匂い" },
    { title: "短い夜", seasonalText: "明けやすき夜に、月は淡く" },
    { title: "水の記憶", seasonalText: "泉の音に、涼をたずねる" },
    { title: "言葉にならない熱", seasonalText: "夕凪の空、なお熱を残して" },
    { title: "夏の別れ", seasonalText: "遠雷ののち、風向き変わる" },
  ],
  autumn: [
    { title: "言えなかったこと", seasonalText: "露を結ぶ野に、虫の音ひとつ" },
    { title: "帰る場所", seasonalText: "夕暮れの薄、風にかたむく" },
    { title: "忘れられない匂い", seasonalText: "木犀の香、ふと袖に満ちて" },
    { title: "長くなる影", seasonalText: "秋の日は傾き、影のみ残る" },
    { title: "月に隠したもの", seasonalText: "澄む夜空に、月ひとつ" },
  ],
  winter: [
    { title: "灯をともす", seasonalText: "霜夜の庵に、灯ひとつ" },
    { title: "消えないぬくもり", seasonalText: "冬木立を抜ける、冴えた風" },
    { title: "静かな約束", seasonalText: "雪待つ空に、音はなく" },
    { title: "遠い足音", seasonalText: "凍る道に、足跡つづく" },
    { title: "年の果て", seasonalText: "古き日を送り、新しきを待つ" },
  ],
};

function seasonForMonth(month: number): keyof typeof themesBySeason {
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
