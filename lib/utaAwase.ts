export type PoemResult = { poemId: string; points: number; matches: number; wins: number; draws: number; decisiveVotes: number; supportVotes: number };

// あはれ数は引数に含めない。平均点→勝率→持を除く支持率の順で撰歌を決める。
export function selectDailyPoems(results: PoemResult[]) {
  return [...results].sort((a, b) => {
    const average = (b.matches ? b.points / b.matches : 0) - (a.matches ? a.points / a.matches : 0);
    if (average) return average;
    const winRate = (b.matches ? b.wins / b.matches : 0) - (a.matches ? a.wins / a.matches : 0);
    if (winRate) return winRate;
    return (b.decisiveVotes ? b.supportVotes / b.decisiveVotes : 0) - (a.decisiveVotes ? a.supportVotes / a.decisiveVotes : 0);
  }).slice(0, 3);
}
