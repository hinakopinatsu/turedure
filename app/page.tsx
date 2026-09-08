"use client";

import { useEffect, useState } from "react";

type View = "gathering" | "utaawase" | "heartkeep" | "letters" | "mine";
type Poem = { id: number; author: string; lines: string[]; season?: string; theme?: string; aware?: boolean; response?: string };
type GiftMode = { kind: "reply" | "letter"; recipient: string; poem?: Poem; exchangeId?: number };
type Exchange = { id: number; person: string; visibility: "public" | "private"; waiting: boolean; poems: { fromMe: boolean; lines: string[] }[] };

const samplePoems: Poem[] = [
  { id: 1, author: "二十三", lines: ["さよならを", "言えないままに", "暮れた空", "あなたの影だけ", "長くなりゆく"], response: "誰かの心に留まりました" },
  { id: 2, author: "百八", lines: ["言の葉を", "袖に隠して", "帰る道", "月だけが知る", "声にならぬを"], response: "二つの心に留まりました" },
  { id: 3, author: "四百二十七", lines: ["また明日", "そのひとことが", "言えぬ夜", "虫の音ばかり", "近くに聞こゆ"], response: "誰かの心に留まりました" },
  { id: 4, author: "七十一", lines: ["指先に", "残るぬくもり", "秋の風", "言わずに閉じた", "扉の向こう"], response: "三つの心に留まりました" },
  { id: 5, author: "三百九", lines: ["朝露の", "消えるあわいに", "名を呼べば", "誰にも届かぬ", "声だけがある"], response: "誰かの心に留まりました" },
  { id: 6, author: "五十二", lines: ["ふりかえる", "ことも叶わぬ", "駅の端", "金木犀に", "足を止めたり"], response: "二つの心に留まりました" },
];

const pastPoems = [
  { date: "長月 七日", theme: "帰る場所", lines: ["灯のともる", "窓を数えて", "帰る道", "ひとつも我を", "待たぬと知りつつ"] },
  { date: "長月 六日", theme: "残暑", lines: ["水底に", "夏を沈めて", "秋を待つ", "濡れた素足に", "風のはじまり"] },
  { date: "葉月 二十八日", theme: "忘れられない匂い", lines: ["雨あがり", "古書の頁を", "ひらくとき", "遠いあなたの", "部屋を思えり"] },
];

const nav: { id: View; label: string }[] = [
  { id: "mine", label: "我が歌" }, { id: "gathering", label: "歌会" }, { id: "utaawase", label: "歌合" }, { id: "heartkeep", label: "心留め" }, { id: "letters", label: "文箱" },
];

function Header({ number }: { number: string }) {
  return <header className="topbar"><button className="wordmark">ツレヅレ</button><span className="member">第 {number} 番</span></header>;
}

function Nav({ view, setView, unlocked }: { view: View; setView: (v: View) => void; unlocked: boolean }) {
  return <nav className="bottom-nav" aria-label="主要な頁">{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.label}</span>{item.id === "gathering" && !unlocked && <i className="lock-dot" />}</button>)}</nav>;
}

function SeasonMark() { return <div className="season"><span>長月 八日</span><i /><span>白露</span></div>; }

function SeasonalScenery() {
  return <div className="seasonal-scene" aria-hidden="true">
    <div className="autumn-moon"><span className="moon-rabbit" /></div>
    <div className="cloud cloud-one" /><div className="cloud cloud-two" />
    <div className="susuki susuki-one"><i /><i /><i /></div>
    <div className="susuki susuki-two"><i /><i /></div>
    <span className="season-name">長月</span>
  </div>;
}

function FestiveNotice() {
  // 国民の祝日APIへ移行しやすい形。MVPでは年中行事と2026年の祝日を内包する。
  const annualEvents: Record<string, { name: string; note: string }> = {
    "1-1": { name: "歳旦", note: "新しき年のはじまり" },
    "3-3": { name: "上巳", note: "桃の節句" },
    "5-5": { name: "端午", note: "菖蒲の節句" },
    "7-7": { name: "七夕", note: "星合の夜" },
    "9-9": { name: "重陽", note: "菊の節句" },
  };
  const holidays2026: Record<string, { name: string; note: string }> = {
    "2026-1-12": { name: "成人の日", note: "若き門出を寿ぐ日" },
    "2026-2-11": { name: "建国記念の日", note: "国の歩みに心を寄せる日" },
    "2026-2-23": { name: "天皇誕生日", note: "御代の安寧を寿ぐ日" },
    "2026-3-20": { name: "春分", note: "昼と夜のあわい" },
    "2026-4-29": { name: "昭和の日", note: "過ぎし時を顧みる日" },
    "2026-5-3": { name: "憲法記念日", note: "国のかたちを思う日" },
    "2026-5-4": { name: "みどりの日", note: "草木の声を聴く日" },
    "2026-5-5": { name: "こどもの日", note: "幼き命を寿ぐ日" },
    "2026-7-20": { name: "海の日", note: "潮の恵みに謝す日" },
    "2026-8-11": { name: "山の日", note: "峰々に心を寄せる日" },
    "2026-9-21": { name: "敬老の日", note: "長き歳月を寿ぐ日" },
    "2026-9-22": { name: "国民の休日", note: "秋の歩みを愛でる日" },
    "2026-9-23": { name: "秋分", note: "昼と夜のあわい" },
    "2026-10-12": { name: "スポーツの日", note: "健やかなる身を喜ぶ日" },
    "2026-11-3": { name: "文化の日", note: "文と芸を愛でる日" },
    "2026-11-23": { name: "勤労感謝の日", note: "日々の営みに謝す日" },
  };
  const today = new Date();
  const event = holidays2026[`${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`] ?? annualEvents[`${today.getMonth() + 1}-${today.getDate()}`];
  return event ? <aside className="festive"><span>{event.name}</span><i />{event.note}</aside> : null;
}

function Welcome({ onEnter }: { onEnter: () => void }) {
  return <main className="welcome page-in">
    <div className="moon" aria-hidden="true" />
    <p className="welcome-kicker">一日一首、ただ言葉を残す場所</p>
    <h1>ツレヅレ</h1>
    <p className="welcome-copy">つながらないから、<br />言葉と出会える。</p>
    <div className="rule"><span>名は、いりません</span><span>人の歌は、詠んだあとに</span><span>今日の一首は、今日だけ</span></div>
    <button className="primary" onClick={onEnter}>この場所へ入る</button>
    <p className="welcome-note">あなたには、まだ誰も持たない番号が授けられます</p>
  </main>;
}

function Today({ submitted, onBegin, submittedLines }: { submitted: boolean; onBegin: () => void; submittedLines: string[] }) {
  return <main className="today page-in"><SeasonalScenery /><SeasonMark /><FestiveNotice />
    <div className="sprig" aria-hidden="true"><i /><i /><i /><i /></div>
    {!submitted ? <section className="theme-block"><p>本日の題</p><h1>「言えなかったこと」</h1><div className="hairline" /><p className="invitation">胸のうちに残るものを<br />五つの句に。</p><button className="primary ink" onClick={onBegin}>詠む</button><p className="until">今宵まで、あと 8 時間</p></section>
    : <section className="after-submit"><p className="small-label">今日、詠みし歌</p><PoemText lines={submittedLines} vertical /><div className="seal">四三八</div><p className="thanks">一首、たしかに預かりました。</p><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent("navigate-gathering"))}>歌会の御簾をあげる <span>→</span></button></section>}
  </main>;
}

function Composer({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (lines: string[]) => void }) {
  const [lines, setLines] = useState(["", "", "", "", ""]);
  const guides = [5, 7, 5, 7, 7];
  const ready = lines.every((l) => l.trim());
  return <main className="composer page-in"><button className="close" onClick={onCancel}>閉じる</button><SeasonMark /><p className="small-label">本日の題</p><h1>言えなかったこと</h1><p className="compose-help">文字数は、目安です。<br />あなたの呼吸で詠んでください。</p><div className="line-inputs">{lines.map((line, i) => <label key={i}><span>{guides[i]}</span><input value={line} maxLength={14} autoFocus={i === 0} onChange={(e) => setLines((old) => old.map((v, x) => x === i ? e.target.value : v))} placeholder={i === 0 ? "ことばを置く" : ""} /><em>{line.length || ""}</em></label>)}</div><button className="primary" disabled={!ready} onClick={() => onSubmit(lines)}>この一首を残す</button><p className="warning">一度残した歌は、書き直せません</p></main>;
}

function PoemText({ lines, vertical = false }: { lines: string[]; vertical?: boolean }) {
  return <div className={vertical ? "poem vertical" : "poem"}>{lines.map((line, i) => <span key={i}>{line}</span>)}</div>;
}

function Gathering({ unlocked, onPeek, onReply, onOpenReplies, publicExchanges, awareIds, onAware }: { unlocked: boolean; onPeek: (poem: Poem) => void; onReply: (poem: Poem) => void; onOpenReplies: (exchanges: Exchange[]) => void; publicExchanges: Exchange[]; awareIds: number[]; onAware: (id: number) => void }) {
  const [page, setPage] = useState(0); const poems = samplePoems;
  if (!unlocked) return <main className="locked page-in"><SeasonMark /><div className="misescreen"><div className="misen-line" /><div className="misen-line" /><div className="misen-line" /></div><p className="small-label">本日の歌会</p><h1>詠まねば、<br />覗けない。</h1><p>誰かの言葉に触れる前に、<br />まず、あなたの心から。</p><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent("navigate-today"))}>本日の題へ <span>→</span></button></main>;
  const visible = poems.slice(page * 3, page * 3 + 3);
  return <main className="gathering page-in"><SeasonalScenery /><SeasonMark /><header className="section-head"><p>本日の歌会</p><h1>言えなかったこと</h1><span>{page + 1} / 2</span></header><div className="poem-list">{visible.map((p) => {
    const replies = publicExchanges.filter(exchange => exchange.poems[0]?.lines.join("\n") === p.lines.join("\n"));
    const replyCount = replies.reduce((total, exchange) => total + Math.max(0, exchange.poems.length - 1), 0);
    const aware = awareIds.includes(p.id);
    return <article key={p.id}><div className="poem-number">其の {p.id}</div><PoemText lines={p.lines} vertical /><footer className="poem-author"><span>— {p.author}番 <button className="peek-link" onClick={() => onPeek(p)}>垣間見</button></span><button className={aware ? "aware given" : "aware"} onClick={() => onAware(p.id)}><i />{aware ? "心に留めました" : "あはれ"}</button></footer><div className="poem-replies"><span>{replyCount > 0 && <button className="reply-count" onClick={() => onOpenReplies(replies)}><i />返歌 {replyCount}首</button>}</span><button className="reply-link" onClick={() => onReply(p)}>この歌に返す</button></div>{p.response && <p className="response">{p.response}</p>}</article>;
  })}</div><div className="pagination">{page === 1 && <button onClick={() => {setPage(0); window.scrollTo(0,0)}}>先の料紙へ</button>}<button onClick={() => {setPage(page === 0 ? 1 : 0); window.scrollTo(0,0)}}>{page === 0 ? "次なる歌を繙く" : "巻頭へ戻る"} <span>→</span></button></div></main>;
}

function Glimpse() { const [month, setMonth] = useState("長月"); return <main className="glimpse page-in"><SeasonalScenery /><SeasonMark /><header className="title-head"><p>過ぎた日の心を、そっと覗く</p><h1>垣間見</h1></header><div className="month-nav"><button onClick={() => setMonth("葉月")}>〈</button><span>{month}<small>{month === "長月" ? "九月" : "八月"}</small></span><button onClick={() => setMonth("長月")}>〉</button></div><div className="past-list">{pastPoems.filter((_,i) => month === "長月" ? i < 2 : i === 2).map((p, i) => <article key={p.date}><header><span>{p.date}</span><em>「{p.theme}」</em></header><PoemText lines={p.lines} vertical /><footer>— {i === 0 ? "六十四" : i === 1 ? "二百十一" : "三十九"}番</footer></article>)}</div></main>; }

function Peek({ poem, onClose, onLetter, onReply }: { poem: Poem; onClose: () => void; onLetter: () => void; onReply: (poem: Poem) => void }) {
  const pinned = [poem, samplePoems[(poem.id + 1) % samplePoems.length], samplePoems[(poem.id + 3) % samplePoems.length]];
  return <main className="peek-page page-in"><SeasonalScenery /><button className="close" onClick={onClose}>そっと閉じる</button><header className="peek-head"><div className="number-mark">{poem.author.slice(0, 3)}</div><h1>{poem.author}番</h1><p>心に留めし歌</p></header><div className="pinned-scroll">{pinned.map((p, i) => <article key={`${p.id}-${i}`}><span className="pin-order">{["一", "二", "三"][i]}</span><PoemText lines={p.lines} vertical /><button className="reply-link" onClick={() => onReply(p)}>この歌に返す</button></article>)}</div><div className="peek-actions"><p>名を知らぬまま、心を知る。</p><button className="primary" onClick={onLetter}>この方へ、文をしたためる</button></div></main>;
}

function GiftComposer({ mode, onClose, onSend }: { mode: GiftMode; onClose: () => void; onSend: (lines: string[], visibility: "public" | "private") => void }) {
  const [lines, setLines] = useState(["", "", "", "", ""]); const [visibility, setVisibility] = useState<"public" | "private">(mode.kind === "letter" ? "private" : "public"); const guides = [5,7,5,7,7];
  return <main className="gift-compose page-in"><button className="close" onClick={onClose}>そっと閉じる</button><SeasonMark /><header><p>{mode.recipient}番へ</p><h1>{mode.kind === "reply" ? "返歌を詠む" : "文をしたためる"}</h1></header>{mode.poem && <div className="source-poem"><p>心を寄せた歌</p><PoemText lines={mode.poem.lines} vertical /></div>}{mode.kind === "reply" && <fieldset className="visibility"><legend>この歌への返歌を</legend><label><input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} /><span>歌会に残す<small>皆が読める贈答歌として</small></span></label><label><input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /><span>文として届ける<small>この方だけに、そっと</small></span></label></fieldset>}<div className="line-inputs">{lines.map((line,i) => <label key={i}><span>{guides[i]}</span><input value={line} onChange={e => setLines(old => old.map((v,x) => x === i ? e.target.value : v))} /><em>{line.length || ""}</em></label>)}</div><button className="primary" disabled={!lines.every(Boolean)} onClick={() => onSend(lines, visibility)}>一首を結ぶ</button><p className="waiting-rule">この一首が返されるまで、<br />次の文は送れません。</p></main>;
}

function Letters({ exchanges, onOpen }: { exchanges: Exchange[]; onOpen: (e: Exchange) => void }) {
  return <main className="letters page-in"><SeasonalScenery /><SeasonMark /><header className="title-head"><p>返歌のある時だけ、往来は続く</p><h1>文箱</h1></header><div className="letter-list">{exchanges.map(e => <button key={e.id} onClick={() => onOpen(e)}><span className={`folded-letter ${e.waiting ? "quiet" : ""}`} /><span><b>{e.person}番との文</b><small>{e.waiting ? "返歌を待っています" : "返歌が届いています"}</small></span><em>繙く</em></button>)}</div><p className="letter-note">既読も、時刻も、ここにはありません。<br />言葉が返るまで、ただ待つ場所。</p></main>;
}

function ExchangeView({ exchange, onClose, onReply, returnLabel }: { exchange: Exchange; onClose: () => void; onReply: () => void; returnLabel: string }) {
  return <main className="exchange-page page-in"><button className="close" onClick={onClose}>{returnLabel}</button><header><p>{exchange.visibility === "public" ? "歌会に残る贈答歌" : "文の往来"}</p><h1>{exchange.visibility === "public" ? "返歌の往来" : `${exchange.person}番との文`}</h1></header><div className="exchange-flow">{exchange.poems.map((p,i) => <article key={i} className={p.fromMe ? "from-me" : "from-them"}><span>{i === 0 ? "元歌" : `返歌 ${i}`}</span><PoemText lines={p.lines} vertical /><small>{p.fromMe ? "四百三十八番" : `${exchange.person}番`}</small></article>)}</div>{exchange.waiting ? <div className="waiting"><i /><p>一首を届けました。<br />返歌を、静かに待ちます。</p><small>返されるまで次の歌は送れません</small></div> : <button className="primary exchange-reply" onClick={onReply}>返歌をしたためる</button>}</main>;
}

function PublicReplies({ exchanges, onClose }: { exchanges: Exchange[]; onClose: () => void }) {
  const root = exchanges[0]?.poems[0];
  const replies = exchanges.flatMap(exchange => exchange.poems.slice(1).map((poem, index) => ({ ...poem, person: exchange.person, order: index + 1 })));
  return <main className="exchange-page public-replies-page page-in"><button className="close" onClick={onClose}>歌会へ戻る</button><header><p>歌会に残りし言の葉</p><h1>返歌 {replies.length}首</h1></header>{root && <section className="reply-root"><span>元歌</span><PoemText lines={root.lines} vertical /></section>}<div className="exchange-flow">{replies.map((reply, index) => <article key={`${reply.person}-${index}`} className={reply.fromMe ? "from-me" : "from-them"}><span>返歌 {index + 1}</span><PoemText lines={reply.lines} vertical /><small>— {reply.fromMe ? "四百三十八" : reply.person}番</small></article>)}</div><p className="all-replies-note">寄せられた返歌を、すべて。</p></main>;
}

function HeartKeep({ poemIds, onAware, onPeek, onReply }: { poemIds: number[]; onAware: (id: number) => void; onPeek: (p: Poem) => void; onReply: (p: Poem) => void }) {
  const poems = samplePoems.filter(poem => poemIds.includes(poem.id));
  return <main className="heartkeep page-in"><SeasonalScenery /><SeasonMark /><header className="title-head"><p>あはれと思ひし歌</p><h1>心留め</h1></header>{poems.length === 0 ? <div className="empty-keep"><i /><p>心に留めし歌は、<br />まだありません。</p><small>歌会で「あはれ」と思う一首に出会えば、ここへ。</small></div> : <div className="kept-poems">{poems.map(poem => <article key={poem.id}><PoemText lines={poem.lines} vertical /><footer><span>— {poem.author}番</span><button onClick={() => onAware(poem.id)}>心留めから外す</button></footer><div><button onClick={() => onPeek(poem)}>垣間見</button><button onClick={() => onReply(poem)}>この歌に返す</button></div></article>)}</div>}</main>;
}

const matches = [[samplePoems[1],samplePoems[2]],[samplePoems[3],samplePoems[4]],[samplePoems[0],samplePoems[5]]] as const;
function UtaAwase({ onLeave }: { onLeave: () => void }) {
  const [index,setIndex] = useState(0); const [votes,setVotes] = useState<Record<number,"left"|"draw"|"right">>({}); const pair = matches[index]; const choice = votes[index];
  return <main className="utaawase page-in"><SeasonalScenery /><button className="close" onClick={onLeave}>歌合を辞す</button><SeasonMark /><header className="awase-head"><p>長月七日の歌合</p><h1>題「帰る場所」</h1><span>第 {index+1} 組 ／ {matches.length} 組</span></header><div className="match-sheet"><section><b>左</b><PoemText lines={pair[0].lines} vertical />{choice && <small>— {pair[0].author}番</small>}</section><i className="match-divider" /><section><b>右</b><PoemText lines={pair[1].lines} vertical />{choice && <small>— {pair[1].author}番</small>}</section></div>{!choice ? <fieldset className="vote-choices"><legend>いずれに心寄る</legend><button onClick={() => setVotes(old => ({...old,[index]:"left"}))}>左に<br />心寄る</button><button onClick={() => setVotes(old => ({...old,[index]:"draw"}))}>持</button><button onClick={() => setVotes(old => ({...old,[index]:"right"}))}>右に<br />心寄る</button></fieldset> : <div className="vote-done"><p>{choice === "draw" ? "いずれも、心に残りました。" : `${choice === "left" ? "左" : "右"}の歌へ、心を寄せました。`}</p>{index < matches.length-1 ? <button className="primary" onClick={() => setIndex(index+1)}>次なる組へ</button> : <button className="primary" onClick={onLeave}>歌合を納める</button>}</div>}</main>;
}

function Results({ onContinue }: { onContinue: () => void }) {
  return <main className="results page-in"><SeasonalScenery /><SeasonMark /><header><p>長月六日　題「残暑」</p><h1>歌合、果てたり。</h1><span>今宵残りし三首</span></header><div className="selected-poems">{samplePoems.slice(0,3).map((poem,index) => <article key={poem.id}><b>{["一","二","三"][index]}</b><PoemText lines={poem.lines} vertical /><small>— {poem.author}番</small></article>)}</div><button className="primary" onClick={onContinue}>今日へ</button></main>;
}

function Mine({ submitted, lines, onBegin }: { submitted: boolean; lines: string[]; onBegin: () => void }) { const [pinned, setPinned] = useState<number[]>([0,1]); const togglePin = (id: number) => setPinned(old => old.includes(id) ? old.filter(x => x !== id) : old.length < 3 ? [...old,id] : old); return <main className="mine page-in"><SeasonalScenery /><SeasonMark /><section className="my-today"><p>本日の題</p><h1>「言えなかったこと」</h1>{submitted ? <><span>本日の一首は、歌筥に納まりました。</span><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent("navigate-gathering"))}>歌会の御簾をあげる　→</button></> : <><span>今日という日に、一首だけ。</span><button className="primary ink" onClick={onBegin}>詠む</button></>}</section><header className="mine-head"><div className="number-mark">四三八</div><p>四百三十八番の歌筥</p><h1>詠みし歌</h1><span>{submitted ? "四首" : "三首"}</span><small>心に留めし歌　{pinned.length} / 3</small></header><div className="season-counts"><span>春　〇首</span><span>夏　二首</span><span>秋　{submitted ? "二" : "一"}首</span><span>冬　〇首</span></div><div className="chronology"><span>今</span><i /><span>往時</span></div><div className="my-poems">{submitted && <article className="new"><header><span>長月 八日</span><em>言えなかったこと</em></header><PoemText lines={lines} vertical /><p className="aware-total">あはれ　〇</p><button className="pin-button" onClick={() => togglePin(9)}>{pinned.includes(9) ? "留めし歌から外す" : pinned.length === 3 ? "三首を選定済み" : "心に留めし歌にする"}</button></article>}{pastPoems.map((p,i) => <article key={p.date}><header><span>{p.date}</span><em>{p.theme}</em></header><PoemText lines={p.lines} vertical /><p className="aware-total">あはれ　{["七","三","十一"][i]}</p><button className={`pin-button ${pinned.includes(i) ? "selected" : ""}`} onClick={() => togglePin(i)}>{pinned.includes(i) ? `心に留めし歌　${pinned.indexOf(i)+1}` : pinned.length === 3 ? "三首を選定済み" : "心に留めし歌にする"}</button></article>)}</div><p className="collection-note">選びし三首だけが、垣間見に現れます。<br />プロフィールの代わりに、三首。</p></main>; }

export default function Home() {
  const [entered, setEntered] = useState(false); const [resultSeen, setResultSeen] = useState(true); const [view, setView] = useState<View>("mine"); const [awareIds, setAwareIds] = useState<number[]>([]); const [composing, setComposing] = useState(false); const [submitted, setSubmitted] = useState(false); const [lines, setLines] = useState<string[]>([]); const [peeked, setPeeked] = useState<Poem | null>(null); const [gift, setGift] = useState<GiftMode | null>(null); const [openExchange, setOpenExchange] = useState<Exchange | null>(null); const [openReplyGroup, setOpenReplyGroup] = useState<Exchange[] | null>(null); const [exchangeReturn, setExchangeReturn] = useState<"letters" | "gathering">("letters");
  const [exchanges, setExchanges] = useState<Exchange[]>([
    { id: 1, person: "二千三百十二", visibility: "private", waiting: false, poems: [{ fromMe: true, lines: ["月影を","たよりに歩む","秋の道","名も知らぬ君","なぜか懐かし"] }, { fromMe: false, lines: ["名を知らず","されど言の葉","届く夜","同じ月見て","我も歩まん"] }] },
    { id: 2, person: "二十三", visibility: "public", waiting: true, poems: [{ fromMe: false, lines: samplePoems[0].lines }, { fromMe: true, lines: ["暮れゆけば","影は重なり","消えゆけど","言えぬ言葉は","胸に灯れり"] }] },
  ]);
  useEffect(() => { const gathering = () => setView("gathering"); const mine = () => setView("mine"); window.addEventListener("navigate-gathering", gathering); window.addEventListener("navigate-today", mine); return () => { window.removeEventListener("navigate-gathering", gathering); window.removeEventListener("navigate-today", mine); }; }, []);
  const toggleAware = (id: number) => setAwareIds(old => old.includes(id) ? old.filter(value => value !== id) : [...old,id]);
  if (!entered) return <Welcome onEnter={() => { setResultSeen(window.localStorage.getItem("turedure-result-2026-09-06") === "seen"); setEntered(true); }} />;
  if (!resultSeen) return <Results onContinue={() => {window.localStorage.setItem("turedure-result-2026-09-06","seen");setResultSeen(true);setView("mine")}} />;
  if (composing) return <Composer onCancel={() => setComposing(false)} onSubmit={(value) => {setLines(value); setSubmitted(true); setComposing(false)}} />;
  if (gift) return <GiftComposer mode={gift} onClose={() => setGift(null)} onSend={(sentLines, visibility) => { if (gift.exchangeId) { const current = exchanges.find(exchange => exchange.id === gift.exchangeId); if (!current) return; const next = { ...current, waiting: true, poems: [...current.poems, { fromMe: true, lines: sentLines }] }; setExchanges(old => old.map(exchange => exchange.id === next.id ? next : exchange)); setGift(null); setOpenExchange(next); return; } const next: Exchange = { id: Date.now(), person: gift.recipient, visibility, waiting: true, poems: [...(gift.poem ? [{ fromMe: false, lines: gift.poem.lines }] : []), { fromMe: true, lines: sentLines }] }; setExchanges(old => [next, ...old]); setGift(null); setOpenExchange(next); }} />;
  if (peeked) return <Peek poem={peeked} onClose={() => setPeeked(null)} onLetter={() => {setExchangeReturn("letters");setGift({kind:"letter",recipient:peeked.author});setPeeked(null)}} onReply={(poem) => {setExchangeReturn("gathering");setGift({kind:"reply",recipient:poem.author,poem});setPeeked(null)}} />;
  if (openReplyGroup) return <PublicReplies exchanges={openReplyGroup} onClose={() => {setOpenReplyGroup(null);setView("gathering")}} />;
  if (openExchange) return <ExchangeView exchange={openExchange} returnLabel={exchangeReturn === "letters" ? "文箱へ戻る" : "歌会へ戻る"} onClose={() => {setOpenExchange(null);setView(exchangeReturn)}} onReply={() => setGift({kind:"letter",recipient:openExchange.person,exchangeId:openExchange.id})} />;
  return <div className="app-shell"><Header number="四百三十八" />{view === "gathering" && <Gathering unlocked={submitted} onPeek={setPeeked} onReply={(poem) => {setExchangeReturn("gathering");setGift({kind:"reply",recipient:poem.author,poem})}} onOpenReplies={setOpenReplyGroup} publicExchanges={exchanges.filter(exchange => exchange.visibility === "public")} awareIds={awareIds} onAware={toggleAware} />}{view === "utaawase" && <UtaAwase onLeave={() => setView("mine")} />}{view === "heartkeep" && <HeartKeep poemIds={awareIds} onAware={toggleAware} onPeek={setPeeked} onReply={(poem) => setGift({kind:"reply",recipient:poem.author,poem})} />}{view === "letters" && <Letters exchanges={exchanges} onOpen={(exchange) => {setExchangeReturn("letters");setOpenExchange(exchange)}} />}{view === "mine" && <Mine submitted={submitted} lines={lines} onBegin={() => setComposing(true)} />}<Nav view={view} setView={setView} unlocked={submitted} /></div>;
}
