"use client";

import { useEffect, useState } from "react";
import { addExchangePoem, beginExchange as saveExchange, ensureUser, getAwarePoemIds, getExchanges, getMyPoems, getPinnedPoemIds, getPoems, getTodayMatches, getTodayTheme, recordGlimpse, replacePinned, setAware, signIn, signOut, signUp, submitPoem, vote as saveVote } from "@/lib/supabase/repository";
import { supabase } from "@/lib/supabase/client";

type View = "gathering" | "utaawase" | "heartkeep" | "letters" | "mine";
type Poem = { id: number; dbId?: string; userId?: string; author: string; lines: string[]; season?: string; theme?: string; aware?: boolean; response?: string };
type GiftMode = { kind: "reply" | "letter"; recipient: string; recipientId?: string; poem?: Poem; exchangeId?: number|string };
type Exchange = { id: number|string; person: string; visibility: "public" | "private"; waiting: boolean; poems: { fromMe: boolean; lines: string[] }[] };
type OwnPoem = { id:string; lines:string[]; date:string; theme:string };

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

function Header({ number, onSignOut = () => { void signOut(); } }: { number: string; onSignOut?: () => void }) {
  return <header className="topbar"><button className="wordmark">ツレヅレ</button><div className="member-area"><span className="member">第 {number} 番</span><button onClick={onSignOut}>退出</button></div></header>;
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

function AuthPage() {
  const [mode,setMode]=useState<"signin"|"signup">("signin");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string>();
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage(undefined);try{if(mode==="signin"){await signIn(email,password)}else{const result=await signUp(email,password);if(!result.session)setMessage("確かめの文を送りました。文中の結び目を開いてください。")}}catch(error){const text=error instanceof Error?error.message:"認証できませんでした";setMessage(text.includes("Invalid login")?"便り先か合言葉が違うようです。":text.includes("already registered")?"この便り先は、すでに結ばれています。":text)}finally{setBusy(false)}};
  return <main className="auth-page page-in"><div className="moon" aria-hidden="true"/><div className="auth-sprig" aria-hidden="true"/><header><p>一日一首、ただ言葉を残す場所</p><h1>ツレヅレ</h1><span>名を持たず、番号だけで。</span></header><form onSubmit={submit}><h2>{mode==="signin"?"ふたたび、御簾の内へ":"はじめて、御簾の内へ"}</h2><p className="auth-lead">{mode==="signin"?"結びし便り先と、合言葉を。":"便り先は、帰るためだけに預かります。\nほかの誰にも明かされません。"}</p><label><span>便り先（メールアドレス）</span><input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label><label><span>合言葉（パスワード）</span><div className="password-field"><input type={showPassword?"text":"password"} autoComplete={mode==="signin"?"current-password":"new-password"} minLength={8} required value={password} onChange={event=>setPassword(event.target.value)}/><button type="button" aria-pressed={showPassword} aria-label={showPassword?"パスワードを隠す":"パスワードを表示する"} onClick={()=>setShowPassword(value=>!value)}>{showPassword?"隠す":"見る"}</button></div><small>八文字以上</small></label>{message&&<p className="auth-message" role="status">{message}</p>}<button className="primary" disabled={busy}>{busy?"しばし、お待ちを":mode==="signin"?"御簾をあげる":"番号を授かる"}</button></form><button className="auth-switch" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setMessage(undefined);setShowPassword(false)}}>{mode==="signin"?"はじめて訪れる方はこちら":"すでに番号をお持ちの方はこちら"}</button><p className="auth-foot">ここに、名も姿もいりません。<br/>歌と言葉だけが残ります。</p></main>;
}

function AuthLoading(){return <main className="auth-loading"><i/><span>御簾の内を整えています</span></main>}

function NumberGranted({number,onContinue}:{number:number;onContinue:()=>void}) {
  return <main className="number-granted page-in"><SeasonalScenery/><div className="grant-moon" aria-hidden="true"/><p>この場所で、あなたを示すもの</p><div className="granted-seal">{number}</div><h1>あなたは、<br/><span>第 {number} 番</span>です。</h1><div className="hairline"/><p className="grant-note">名の代わりに、この番号を。<br/>言葉だけを携えて、お入りください。</p><button className="primary" onClick={onContinue}>歌筥をひらく</button></main>;
}

function AccountError({message,onRetry,onSignOut}:{message:string;onRetry:()=>void;onSignOut:()=>void}) {
  return <main className="account-error page-in"><p>門の内を、まだ整えられません。</p><h1>番号を確かめられませんでした</h1><pre>{message}</pre><button className="primary" onClick={onRetry}>もう一度たしかめる</button><button className="text-button" onClick={onSignOut}>別の帳で入り直す</button></main>;
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

function Gathering({ unlocked, poems, onPeek, onReply, onOpenReplies, publicExchanges, awareIds, onAware }: { unlocked: boolean; poems: Poem[]; onPeek: (poem: Poem) => void; onReply: (poem: Poem) => void; onOpenReplies: (exchanges: Exchange[]) => void; publicExchanges: Exchange[]; awareIds: number[]; onAware: (id: number) => void }) {
  const [page, setPage] = useState(0);
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

function HeartKeep({ poemIds, allPoems, onAware, onPeek, onReply }: { poemIds: number[]; allPoems: Poem[]; onAware: (id: number) => void; onPeek: (p: Poem) => void; onReply: (p: Poem) => void }) {
  const poems = allPoems.filter(poem => poemIds.includes(poem.id));
  return <main className="heartkeep page-in"><SeasonalScenery /><SeasonMark /><header className="title-head"><p>あはれと思ひし歌</p><h1>心留め</h1></header>{poems.length === 0 ? <div className="empty-keep"><i /><p>心に留めし歌は、<br />まだありません。</p><small>歌会で「あはれ」と思う一首に出会えば、ここへ。</small></div> : <div className="kept-poems">{poems.map(poem => <article key={poem.id}><PoemText lines={poem.lines} vertical /><footer><span>— {poem.author}番</span><button onClick={() => onAware(poem.id)}>心留めから外す</button></footer><div><button onClick={() => onPeek(poem)}>垣間見</button><button onClick={() => onReply(poem)}>この歌に返す</button></div></article>)}</div>}</main>;
}

const demoMatches = [{left:samplePoems[1],right:samplePoems[2]},{left:samplePoems[3],right:samplePoems[4]},{left:samplePoems[0],right:samplePoems[5]}];
function UtaAwase({ pairs, onVote, onLeave }: { pairs:{id?:string;left:Poem;right:Poem}[];onVote:(id:string|undefined,vote:"left"|"draw"|"right")=>Promise<boolean>;onLeave: () => void }) {
  const [index,setIndex] = useState(0); const [votes,setVotes] = useState<Record<number,"left"|"draw"|"right">>({}); const pair = pairs[index]; const choice = votes[index];
  if(!pair)return <main className="utaawase page-in"><SeasonMark/><div className="empty-keep"><p>本日の歌合は、<br/>まだ始まっていません。</p><button className="text-button" onClick={onLeave}>今日へ戻る</button></div></main>;
  const choose=async(value:"left"|"draw"|"right")=>{if(await onVote(pair.id,value))setVotes(old=>({...old,[index]:value}))};
  return <main className="utaawase page-in"><SeasonalScenery /><button className="close" onClick={onLeave}>歌合を辞す</button><SeasonMark /><header className="awase-head"><p>長月七日の歌合</p><h1>題「帰る場所」</h1><span>第 {index+1} 組 ／ {pairs.length} 組</span></header><div className="match-sheet"><section><b>左</b><PoemText lines={pair.left.lines} vertical />{choice && <small>— {pair.left.author}番</small>}</section><i className="match-divider" /><section><b>右</b><PoemText lines={pair.right.lines} vertical />{choice && <small>— {pair.right.author}番</small>}</section></div>{!choice ? <fieldset className="vote-choices"><legend>いずれに心寄る</legend><button onClick={() => choose("left")}>左に<br />心寄る</button><button onClick={() => choose("draw")}>持</button><button onClick={() => choose("right")}>右に<br />心寄る</button></fieldset> : <div className="vote-done"><p>{choice === "draw" ? "いずれも、心に残りました。" : `${choice === "left" ? "左" : "右"}の歌へ、心を寄せました。`}</p>{index < pairs.length-1 ? <button className="primary" onClick={() => setIndex(index+1)}>次なる組へ</button> : <button className="primary" onClick={onLeave}>歌合を納める</button>}</div>}</main>;
}

function Results({ onContinue }: { onContinue: () => void }) {
  return <main className="results page-in"><SeasonalScenery /><SeasonMark /><header><p>長月六日　題「残暑」</p><h1>歌合、果てたり。</h1><span>今宵残りし三首</span></header><div className="selected-poems">{samplePoems.slice(0,3).map((poem,index) => <article key={poem.id}><b>{["一","二","三"][index]}</b><PoemText lines={poem.lines} vertical /><small>— {poem.author}番</small></article>)}</div><button className="primary" onClick={onContinue}>今日へ</button></main>;
}

function Mine({ submitted, lines, onBegin }: { submitted: boolean; lines: string[]; onBegin: () => void }) { const [pinned, setPinned] = useState<number[]>([0,1]); const togglePin = (id: number) => setPinned(old => old.includes(id) ? old.filter(x => x !== id) : old.length < 3 ? [...old,id] : old); return <main className="mine page-in"><SeasonalScenery /><SeasonMark /><section className="my-today"><p>本日の題</p><h1>「言えなかったこと」</h1>{submitted ? <><span>本日の一首は、歌筥に納まりました。</span><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent("navigate-gathering"))}>歌会の御簾をあげる　→</button></> : <><span>今日という日に、一首だけ。</span><button className="primary ink" onClick={onBegin}>詠む</button></>}</section><header className="mine-head"><div className="number-mark">四三八</div><p>四百三十八番の歌筥</p><h1>詠みし歌</h1><span>{submitted ? "四首" : "三首"}</span><small>心に留めし歌　{pinned.length} / 3</small></header><div className="season-counts"><span>春　〇首</span><span>夏　二首</span><span>秋　{submitted ? "二" : "一"}首</span><span>冬　〇首</span></div><div className="chronology"><span>今</span><i /><span>往時</span></div><div className="my-poems">{submitted && <article className="new"><header><span>長月 八日</span><em>言えなかったこと</em></header><PoemText lines={lines} vertical /><p className="aware-total">あはれ　〇</p><button className="pin-button" onClick={() => togglePin(9)}>{pinned.includes(9) ? "留めし歌から外す" : pinned.length === 3 ? "三首を選定済み" : "心に留めし歌にする"}</button></article>}{pastPoems.map((p,i) => <article key={p.date}><header><span>{p.date}</span><em>{p.theme}</em></header><PoemText lines={p.lines} vertical /><p className="aware-total">あはれ　{["七","三","十一"][i]}</p><button className={`pin-button ${pinned.includes(i) ? "selected" : ""}`} onClick={() => togglePin(i)}>{pinned.includes(i) ? `心に留めし歌　${pinned.indexOf(i)+1}` : pinned.length === 3 ? "三首を選定済み" : "心に留めし歌にする"}</button></article>)}</div><p className="collection-note">選びし三首だけが、垣間見に現れます。<br />プロフィールの代わりに、三首。</p></main>; }

function ConnectedMine({ poems,pinned,onPin,onBegin,submitted,userNumber }: { poems:OwnPoem[];pinned:string[];onPin:(id:string)=>void;onBegin:()=>void;submitted:boolean;userNumber:number }) {
  return <main className="mine page-in"><SeasonalScenery/><SeasonMark/><section className="my-today"><p>本日の題</p><h1>「言えなかったこと」</h1>{submitted?<><span>本日の一首は、歌筥に納まりました。</span><button className="text-button" onClick={()=>window.dispatchEvent(new CustomEvent("navigate-gathering"))}>歌会の御簾をあげる　→</button></>:<><span>今日という日に、一首だけ。</span><button className="primary ink" onClick={onBegin}>詠む</button></>}</section><header className="mine-head"><div className="number-mark">{userNumber}</div><p>{userNumber}番の歌筥</p><h1>詠みし歌</h1><span>{poems.length}首</span><small>心に留めし歌　{pinned.length} / 3</small></header><div className="chronology"><span>今</span><i/><span>往時</span></div><div className="my-poems">{poems.map(poem=><article key={poem.id}><header><span>{poem.date}</span><em>{poem.theme}</em></header><PoemText lines={poem.lines} vertical/><button className={`pin-button ${pinned.includes(poem.id)?"selected":""}`} onClick={()=>onPin(poem.id)}>{pinned.includes(poem.id)?`心に留めし歌　${pinned.indexOf(poem.id)+1}`:pinned.length>=3?"三首を選定済み":"心に留めし歌にする"}</button></article>)}</div></main>;
}

function AuthenticatedHome({initialNumber}:{initialNumber:number}) {
  const [entered, setEntered] = useState(false); const [resultSeen, setResultSeen] = useState(true); const [view, setView] = useState<View>("mine"); const [awareIds, setAwareIds] = useState<number[]>([]); const [livePoems,setLivePoems]=useState<Poem[]>(samplePoems); const [liveMatches,setLiveMatches]=useState<{id?:string;left:Poem;right:Poem}[]>(demoMatches); const [ownPoems,setOwnPoems]=useState<OwnPoem[]>([]); const [pinnedDbIds,setPinnedDbIds]=useState<string[]>([]); const [dbUserId,setDbUserId]=useState<string>(); const [themeId,setThemeId]=useState<string>(); const [userNumber,setUserNumber]=useState<number>(438); const [dbError,setDbError]=useState<string>(); const [composing, setComposing] = useState(false); const [submitted, setSubmitted] = useState(false); const [lines, setLines] = useState<string[]>([]); const [peeked, setPeeked] = useState<Poem | null>(null); const [gift, setGift] = useState<GiftMode | null>(null); const [openExchange, setOpenExchange] = useState<Exchange | null>(null); const [openReplyGroup, setOpenReplyGroup] = useState<Exchange[] | null>(null); const [exchangeReturn, setExchangeReturn] = useState<"letters" | "gathering">("letters");
  const [exchanges, setExchanges] = useState<Exchange[]>([
    { id: 1, person: "二千三百十二", visibility: "private", waiting: false, poems: [{ fromMe: true, lines: ["月影を","たよりに歩む","秋の道","名も知らぬ君","なぜか懐かし"] }, { fromMe: false, lines: ["名を知らず","されど言の葉","届く夜","同じ月見て","我も歩まん"] }] },
    { id: 2, person: "二十三", visibility: "public", waiting: true, poems: [{ fromMe: false, lines: samplePoems[0].lines }, { fromMe: true, lines: ["暮れゆけば","影は重なり","消えゆけど","言えぬ言葉は","胸に灯れり"] }] },
  ]);
  useEffect(()=>setUserNumber(initialNumber),[initialNumber]);
  useEffect(()=>{let active=true;(async()=>{try{const account=await ensureUser();const theme=await getTodayTheme();const [rows,awareDbIds,myRows,pins,matchRows,exchangeRows]=await Promise.all([getPoems(theme.id),getAwarePoemIds(account.user.id),getMyPoems(account.user.id),getPinnedPoemIds(account.user.id),getTodayMatches(),getExchanges(account.user.id)]);if(!active)return;const mapped:Poem[]=rows.map((row,index)=>({id:1000+index,dbId:row.id,userId:row.user_id,author:String(row.users?.user_number??"—"),lines:[row.line_1,row.line_2,row.line_3,row.line_4,row.line_5]}));const mapMatchPoem=(row:any,index:number):Poem=>({id:2000+index,dbId:row.id,userId:row.user_id,author:String(row.users?.user_number??"—"),lines:[row.line_1,row.line_2,row.line_3,row.line_4,row.line_5]});const own=rows.find(row=>row.user_id===account.user.id);setDbUserId(account.user.id);setThemeId(theme.id);setUserNumber(account.profile.user_number);setLivePoems(mapped);setLiveMatches(matchRows.map((match:any,index)=>({id:match.id,left:mapMatchPoem(match.left,index*2),right:mapMatchPoem(match.right,index*2+1)})));setExchanges(exchangeRows.map((exchange:any)=>{const other=exchange.initiator_user_id===account.user.id?exchange.recipient:exchange.initiator;return{id:exchange.id,person:String(other?.user_number??"—"),visibility:exchange.visibility,waiting:exchange.last_sender_user_id===account.user.id,poems:[...(exchange.exchange_poems??[])].sort((a:any,b:any)=>a.created_at.localeCompare(b.created_at)).map((poem:any)=>({fromMe:poem.sender_user_id===account.user.id,lines:[poem.line_1,poem.line_2,poem.line_3,poem.line_4,poem.line_5]}))}}));setPinnedDbIds(pins);setOwnPoems(myRows.map((row:any)=>({id:row.id,lines:[row.line_1,row.line_2,row.line_3,row.line_4,row.line_5],date:row.themes?.date??"",theme:row.themes?.title??""})));setAwareIds(mapped.filter(poem=>poem.dbId&&awareDbIds.includes(poem.dbId)).map(poem=>poem.id));if(own){setSubmitted(true);setLines([own.line_1,own.line_2,own.line_3,own.line_4,own.line_5]);}}catch(error){if(active)setDbError(error instanceof Error?error.message:"Supabaseへ接続できませんでした");}})();return()=>{active=false}},[]);
  useEffect(() => { const gathering = () => setView("gathering"); const mine = () => setView("mine"); window.addEventListener("navigate-gathering", gathering); window.addEventListener("navigate-today", mine); return () => { window.removeEventListener("navigate-gathering", gathering); window.removeEventListener("navigate-today", mine); }; }, []);
  const toggleAware = async (id: number) => { const poem=livePoems.find(item=>item.id===id);const active=!awareIds.includes(id);setAwareIds(old=>active?[...old,id]:old.filter(value=>value!==id));if(dbUserId&&poem?.dbId){try{await setAware(dbUserId,poem.dbId,active)}catch(error){setAwareIds(old=>active?old.filter(value=>value!==id):[...old,id]);setDbError(error instanceof Error?error.message:"あはれを保存できませんでした")}} };
  const openPeek = async (poem:Poem) => {setPeeked(poem);if(dbUserId&&poem.userId)try{await recordGlimpse(dbUserId,poem.userId)}catch(error){setDbError(error instanceof Error?error.message:"垣間見を記録できませんでした")}};
  const togglePinDb=async(poemId:string)=>{if(!dbUserId)return;const active=!pinnedDbIds.includes(poemId);if(active&&pinnedDbIds.length>=3)return;const next=active?[...pinnedDbIds,poemId]:pinnedDbIds.filter(id=>id!==poemId);setPinnedDbIds(next);try{await replacePinned(next)}catch(error){setPinnedDbIds(pinnedDbIds);setDbError(error instanceof Error?error.message:"ピン留めを保存できませんでした")}};
  if (!entered) return <Welcome onEnter={() => { setResultSeen(window.localStorage.getItem("turedure-result-2026-09-06") === "seen"); setEntered(true); }} />;
  if (!resultSeen) return <Results onContinue={() => {window.localStorage.setItem("turedure-result-2026-09-06","seen");setResultSeen(true);setView("mine")}} />;
  if (composing) return <Composer onCancel={() => setComposing(false)} onSubmit={async(value) => {try{if(dbUserId&&themeId){await submitPoem(dbUserId,themeId,value);const [rows,myRows]=await Promise.all([getPoems(themeId),getMyPoems(dbUserId)]);setLivePoems(rows.map((row,index)=>({id:1000+index,dbId:row.id,userId:row.user_id,author:String(row.users?.user_number??"—"),lines:[row.line_1,row.line_2,row.line_3,row.line_4,row.line_5]})));setOwnPoems(myRows.map((row:any)=>({id:row.id,lines:[row.line_1,row.line_2,row.line_3,row.line_4,row.line_5],date:row.themes?.date??"",theme:row.themes?.title??""})));}setLines(value);setSubmitted(true);setComposing(false)}catch(error){setDbError(error instanceof Error?error.message:"歌を保存できませんでした")}}} />;
  if (gift) return <GiftComposer mode={gift} onClose={() => setGift(null)} onSend={async(sentLines, visibility) => { if (gift.exchangeId) { const current = exchanges.find(exchange => exchange.id === gift.exchangeId); if (!current) return;try{if(typeof gift.exchangeId==="string")await addExchangePoem(gift.exchangeId,sentLines)}catch(error){setDbError(error instanceof Error?error.message:"返歌を保存できませんでした");return}const next = { ...current, waiting: true, poems: [...current.poems, { fromMe: true, lines: sentLines }] }; setExchanges(old => old.map(exchange => exchange.id === next.id ? next : exchange)); setGift(null); setOpenExchange(next); return; } try{if(gift.recipientId)await saveExchange(gift.recipientId,gift.poem?.dbId??null,gift.kind,visibility,sentLines)}catch(error){setDbError(error instanceof Error?error.message:"返歌を保存できませんでした");return}const next: Exchange = { id: Date.now(), person: gift.recipient, visibility, waiting: true, poems: [...(gift.poem ? [{ fromMe: false, lines: gift.poem.lines }] : []), { fromMe: true, lines: sentLines }] }; setExchanges(old => [next, ...old]); setGift(null); setOpenExchange(next); }} />;
  if (peeked) return <Peek poem={peeked} onClose={() => setPeeked(null)} onLetter={() => {setExchangeReturn("letters");setGift({kind:"letter",recipient:peeked.author,recipientId:peeked.userId});setPeeked(null)}} onReply={(poem) => {setExchangeReturn("gathering");setGift({kind:"reply",recipient:poem.author,recipientId:poem.userId,poem});setPeeked(null)}} />;
  if (openReplyGroup) return <PublicReplies exchanges={openReplyGroup} onClose={() => {setOpenReplyGroup(null);setView("gathering")}} />;
  if (openExchange) return <ExchangeView exchange={openExchange} returnLabel={exchangeReturn === "letters" ? "文箱へ戻る" : "歌会へ戻る"} onClose={() => {setOpenExchange(null);setView(exchangeReturn)}} onReply={() => setGift({kind:"letter",recipient:openExchange.person,exchangeId:openExchange.id})} />;
  return <div className="app-shell"><Header number={String(userNumber)} />{dbError&&<button className="db-error" onClick={()=>setDbError(undefined)}>{dbError}</button>}{view === "gathering" && <Gathering unlocked={submitted} poems={livePoems} onPeek={openPeek} onReply={(poem) => {setExchangeReturn("gathering");setGift({kind:"reply",recipient:poem.author,recipientId:poem.userId,poem})}} onOpenReplies={setOpenReplyGroup} publicExchanges={exchanges.filter(exchange => exchange.visibility === "public")} awareIds={awareIds} onAware={toggleAware} />}{view === "utaawase" && <UtaAwase pairs={liveMatches} onVote={async(id,value)=>{if(!id||!dbUserId)return true;try{await saveVote(id,dbUserId,value);return true}catch(error){setDbError(error instanceof Error?error.message:"歌合の票を保存できませんでした");return false}}} onLeave={() => setView("mine")} />}{view === "heartkeep" && <HeartKeep poemIds={awareIds} allPoems={livePoems} onAware={toggleAware} onPeek={openPeek} onReply={(poem) => setGift({kind:"reply",recipient:poem.author,recipientId:poem.userId,poem})} />}{view === "letters" && <Letters exchanges={exchanges} onOpen={(exchange) => {setExchangeReturn("letters");setOpenExchange(exchange)}} />}{view === "mine" && (dbUserId?<ConnectedMine poems={ownPoems} pinned={pinnedDbIds} onPin={togglePinDb} submitted={submitted} userNumber={userNumber} onBegin={()=>setComposing(true)}/>:<Mine submitted={submitted} lines={lines} onBegin={() => setComposing(true)} />)}<Nav view={view} setView={setView} unlocked={submitted} /></div>;
}

export default function Home() {
  const [ready,setReady]=useState(false);
  const [signedIn,setSignedIn]=useState(false);
  const [accountId,setAccountId]=useState<string>();
  const [memberNumber,setMemberNumber]=useState<number>();
  const [accountError,setAccountError]=useState<string>();
  const [grantSeen,setGrantSeen]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    const isMember=(session:Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"])=>Boolean(session&&!session.user.is_anonymous);
    const accept=(session:Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"])=>{setSignedIn(isMember(session));setAccountId(isMember(session)?session?.user.id:undefined);setReady(true)};
    supabase.auth.getSession().then(({data})=>{if(active)accept(data.session)});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>accept(session));
    return()=>{active=false;subscription.unsubscribe()};
  },[]);
  useEffect(()=>{if(!signedIn||!accountId){setMemberNumber(undefined);setAccountError(undefined);return}let active=true;setMemberNumber(undefined);setAccountError(undefined);ensureUser().then(({profile})=>{if(!active)return;if(typeof profile.user_number!=="number")throw new Error("番号がまだ授けられていません。users_assign_number の適用を確認してください。");setMemberNumber(profile.user_number);setGrantSeen(window.localStorage.getItem(`turedure-number-granted-${accountId}`)==="seen")}).catch(error=>{if(!active)return;const detail=error&&typeof error==="object"&&"message" in error?String(error.message):JSON.stringify(error);setAccountError(detail||"不明なエラー")});return()=>{active=false}},[signedIn,accountId,retry]);
  if(!ready)return <AuthLoading/>;
  if(!signedIn)return <AuthPage/>;
  if(accountError)return <AccountError message={accountError} onRetry={()=>setRetry(value=>value+1)} onSignOut={()=>{void signOut()}}/>;
  if(memberNumber===undefined)return <AuthLoading/>;
  if(!grantSeen)return <NumberGranted number={memberNumber} onContinue={()=>{if(accountId)window.localStorage.setItem(`turedure-number-granted-${accountId}`,"seen");setGrantSeen(true)}}/>;
  return <AuthenticatedHome initialNumber={memberNumber}/>;
}
