"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { addExchangePoem, beginExchange as saveExchange, ensureUser, getAwarePoemIds, getExchanges, getMyPoemAwareCount, getMyPoems, getPendingResults, getPeekPoems, getPinnedPoemIds, getPoems, getPoemsByIds, getPublicExchanges, getTodayMatches, getTodayTheme, getViewedExchangePoemIds, markExchangePoemsViewed, markResultsViewed, recordGlimpse, replacePinned, setAware, signIn, signOut, signUp, submitPoem, vote as saveVote, type DbTheme, type PendingResults } from "@/lib/supabase/repository";
import { supabase } from "@/lib/supabase/client";

type View = "gathering" | "utaawase" | "heartkeep" | "letters" | "mine";
type TimePeriod = "morning"|"day"|"evening"|"night";
type Season = "spring"|"summer"|"autumn"|"winter";
type ScentKey = "baika"|"kayo"|"kikka"|"kurobo";
type BranchKey = "ume"|"yamabuki"|"fuji"|"tachibana"|"unohana"|"hasu"|"hagi"|"susuki"|"kiku"|"matsu"|"ume_winter"|"snow_branch";
type Poem = { id: number; dbId?: string; userId?: string; author: string; lines: string[]; season?: string; theme?: string; aware?: boolean; response?: string };
type GiftMode = { kind: "reply" | "letter"; recipient: string; recipientId?: string; poem?: Poem; exchangeId?: number|string;visibility?:"public"|"private" };
type Exchange = { id: number|string; person: string; visibility: "public" | "private"; waiting: boolean; participant?:boolean; poems: { id?:string; senderUserId?:string; fromMe: boolean; lines: string[]; scentKey?:ScentKey|null; branchKey?:BranchKey|null }[] };
type OwnPoem = { id:string; lines:string[]; date:string; theme:string };
type InitState = "loading"|"ready"|"no-theme"|"error";
const ThemeContext=createContext<DbTheme|null>(null);
const useTodayTheme=()=>useContext(ThemeContext);
const TimeContext=createContext<TimePeriod>("day");
const CurrentSeasonContext=createContext<Season>("autumn");

const scents:Record<ScentKey,{name:string;note:string}>={baika:{name:"梅花",note:"早春の、凛とした気配"},kayo:{name:"荷葉",note:"夏の水辺を思わせる気配"},kikka:{name:"菊花",note:"秋の夜に残る、澄んだ気配"},kurobo:{name:"黒方",note:"夜更けに沈む、深い気配"}};
const branches:Record<BranchKey,{name:string;season:Season}>={ume:{name:"梅",season:"spring"},yamabuki:{name:"山吹",season:"spring"},fuji:{name:"藤",season:"spring"},tachibana:{name:"橘",season:"summer"},unohana:{name:"卯の花",season:"summer"},hasu:{name:"蓮",season:"summer"},hagi:{name:"萩",season:"autumn"},susuki:{name:"薄",season:"autumn"},kiku:{name:"菊",season:"autumn"},matsu:{name:"松",season:"winter"},ume_winter:{name:"寒梅",season:"winter"},snow_branch:{name:"雪折れの枝",season:"winter"}};
const seasonBranches:Record<Season,BranchKey[]>={spring:["ume","yamabuki","fuji"],summer:["tachibana","unohana","hasu"],autumn:["hagi","susuki","kiku"],winter:["matsu","ume_winter","snow_branch"]};

const monthNames=["睦月","如月","弥生","卯月","皐月","水無月","文月","葉月","長月","神無月","霜月","師走"];
function japaneseDay(day:number){const digits=["〇","一","二","三","四","五","六","七","八","九"];if(day<10)return digits[day];if(day===10)return "十";if(day<20)return `十${digits[day-10]}`;const tens=day===20?"二十":"三十";return day%10===0?tens:`${tens}${digits[day%10]}`;}
function japaneseDate(date:string){const [,month,day]=date.split("-").map(Number);return `${monthNames[month-1]} ${japaneseDay(day)}日`;}
function poemCountLabel(count:number){return `${count<=31?japaneseDay(count):count}首`;}
function seasonFromDate(date:string):Season{const month=Number(date.split("-")[1]);return month>=3&&month<=5?"spring":month>=6&&month<=8?"summer":month>=9&&month<=11?"autumn":"winter";}

const linesFromRow=(row:any):string[]=>[row.line_1,row.line_2,row.line_3,row.line_4,row.line_5];
const mapExchange=(exchange:any,userId:string):Exchange=>{
  const other=exchange.initiator_user_id===userId?exchange.recipient:exchange.initiator;
  const root=exchange.root?[{fromMe:exchange.root.user_id===userId,lines:linesFromRow(exchange.root)}]:[];
  const replies=[...(exchange.exchange_poems??[])].sort((a:any,b:any)=>a.created_at.localeCompare(b.created_at)).map((poem:any)=>({id:poem.id,senderUserId:poem.sender_user_id,fromMe:poem.sender_user_id===userId,lines:linesFromRow(poem),scentKey:poem.scent_key as ScentKey|null,branchKey:poem.branch_key as BranchKey|null}));
  return{id:exchange.id,person:String(other?.user_number??"—"),visibility:exchange.visibility,waiting:exchange.last_sender_user_id===userId,participant:[exchange.initiator_user_id,exchange.recipient_user_id].includes(userId),poems:[...root,...replies]};
};

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

function Nav({ view, setView, unlocked, letterCount }: { view: View; setView: (v: View) => void; unlocked: boolean; letterCount:number }) {
  return <nav className="bottom-nav" aria-label="主要な頁">{nav.map((item) => {const awaseLocked=item.id==="utaawase"&&!unlocked;return <button key={item.id} className={view === item.id ? "active" : ""} disabled={awaseLocked} aria-label={awaseLocked?"歌合（本日の歌を詠んだ後に開きます）":item.id==="letters"&&letterCount?`文箱、届きし文 ${letterCount}首`:item.label} onClick={() => {if(!awaseLocked)setView(item.id)}}><span>{item.label}{item.id==="letters"&&letterCount>0&&<small className="letter-count">{poemCountLabel(letterCount)}</small>}</span>{((item.id === "gathering"||item.id==="utaawase") && !unlocked) && <i className="lock-dot" />}</button>})}</nav>;
}

function SeasonMark() { const inherited=useTodayTheme();const [loaded,setLoaded]=useState<DbTheme|null>(null);useEffect(()=>{if(!inherited)getTodayTheme().then(setLoaded).catch(()=>undefined)},[inherited]);const theme=inherited??loaded;if(!theme)return null;return <div className="season"><span>{japaneseDate(theme.date)}</span><i/><span>{theme.seasonal_text??"季のあわい"}</span></div>; }

function SeasonalScenery() {
  const theme=useTodayTheme();const timePeriod=useContext(TimeContext);const currentSeason=useContext(CurrentSeasonContext);const season=theme?seasonFromDate(theme.date):currentSeason;
  return <div className={`seasonal-scene season-${season} time-${timePeriod}`} aria-hidden="true"><div className="atmosphere-light"/><div className="season-motif"><i/><i/></div></div>;
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

function ThemeUnavailable({number}:{number:number}) {
  return <div className="app-shell"><Header number={String(number)}/><main className="theme-unavailable page-in"><SeasonalScenery/><SeasonMark/><div className="misescreen"><div className="misen-line"/><div className="misen-line"/><div className="misen-line"/></div><p className="small-label">本日の歌筥</p><h1>本日の題は、<br/>まだ届いていません。</h1><p>題が届くまで、しばしお待ちください。<br/>投稿と歌会の御簾は閉じています。</p></main></div>;
}

function Today({ submitted, onBegin, submittedLines }: { submitted: boolean; onBegin: () => void; submittedLines: string[] }) {
  const theme=useTodayTheme();
  return <main className="today page-in"><SeasonalScenery /><SeasonMark /><FestiveNotice />
    <div className="sprig" aria-hidden="true"><i /><i /><i /><i /></div>
    {!submitted ? <section className="theme-block"><p>本日の題</p><h1>「{theme?.title}」</h1><div className="hairline" /><p className="invitation">胸のうちに残るものを<br />五つの句に。</p><button className="primary ink" onClick={onBegin}>詠む</button><p className="until">今宵まで、あと 8 時間</p></section>
    : <section className="after-submit"><p className="small-label">今日、詠みし歌</p><PoemText lines={submittedLines} vertical /><div className="seal">四三八</div><p className="thanks">一首、たしかに預かりました。</p><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent("navigate-gathering"))}>歌会の御簾をあげる <span>→</span></button></section>}
  </main>;
}

function Composer({ title, onCancel, onSubmit }: { title:string;onCancel: () => void; onSubmit: (lines: string[]) => void }) {
  const [lines, setLines] = useState(["", "", "", "", ""]);
  const guides = [5, 7, 5, 7, 7];
  const ready = lines.every((l) => l.trim());
  return <main className="composer page-in"><button className="close" onClick={onCancel}>閉じる</button><SeasonMark /><p className="small-label">本日の題</p><h1>{title}</h1><p className="compose-help">文字数は、目安です。<br />あなたの呼吸で詠んでください。</p><div className="line-inputs">{lines.map((line, i) => <label key={i}><span>{guides[i]}</span><input value={line} maxLength={14} autoFocus={i === 0} onChange={(e) => setLines((old) => old.map((v, x) => x === i ? e.target.value : v))} placeholder={i === 0 ? "ことばを置く" : ""} /><em>{line.length || ""}</em></label>)}</div><button className="primary" disabled={!ready} onClick={() => onSubmit(lines)}>この一首を残す</button><p className="warning">一度残した歌は、書き直せません</p></main>;
}

function PoemText({ lines, vertical = false }: { lines: string[]; vertical?: boolean }) {
  return <div className={vertical ? "poem vertical" : "poem"}>{lines.map((line, i) => <span key={i}>{line}</span>)}</div>;
}

function Gathering({ unlocked, poems, onPeek, onReply, onOpenReplies, publicExchanges, awareIds, onAware }: { unlocked: boolean; poems: Poem[]; onPeek: (poem: Poem) => void; onReply: (poem: Poem) => void; onOpenReplies: (exchanges: Exchange[]) => void; publicExchanges: Exchange[]; awareIds: number[]; onAware: (id: number) => void }) {
  const [page, setPage] = useState(0);
  const theme=useTodayTheme();
  if (!unlocked) return <main className="locked page-in"><SeasonMark /><div className="misescreen"><div className="misen-line" /><div className="misen-line" /><div className="misen-line" /></div><p className="small-label">本日の歌会</p><h1>詠まねば、<br />覗けない。</h1><p>誰かの言葉に触れる前に、<br />まず、あなたの心から。</p><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent("navigate-today"))}>本日の題へ <span>→</span></button></main>;
  const visible = poems.slice(page * 3, page * 3 + 3);
  return <main className="gathering page-in"><SeasonalScenery /><SeasonMark /><header className="section-head"><p>本日の歌会</p><h1>{theme?.title}</h1><span>{page + 1} / 2</span></header><div className="poem-list">{visible.map((p,index) => {
    const replies = publicExchanges.filter(exchange => exchange.poems[0]?.lines.join("\n") === p.lines.join("\n"));
    const replyCount = replies.reduce((total, exchange) => total + Math.max(0, exchange.poems.length - 1), 0);
    const aware = awareIds.includes(p.id);
    return <article key={p.id}><div className="poem-number">其の {page*3+index+1}</div><PoemText lines={p.lines} vertical /><footer className="poem-author"><span>— {p.author}番 <button className="peek-link" onClick={() => onPeek(p)}>垣間見</button></span><button className={aware ? "aware given" : "aware"} onClick={() => onAware(p.id)}><i />{aware ? "心に留めました" : "あはれ"}</button></footer><div className="poem-replies"><span>{replyCount > 0 && <button className="reply-count" onClick={() => onOpenReplies(replies)}><i />返歌 {replyCount}首</button>}</span><button className="reply-link" onClick={() => onReply(p)}>この歌に返す</button></div>{p.response && <p className="response">{p.response}</p>}</article>;
  })}</div><div className="pagination">{page === 1 && <button onClick={() => {setPage(0); window.scrollTo(0,0)}}>先の料紙へ</button>}<button onClick={() => {setPage(page === 0 ? 1 : 0); window.scrollTo(0,0)}}>{page === 0 ? "次なる歌を繙く" : "巻頭へ戻る"} <span>→</span></button></div></main>;
}

function Glimpse() { const [month, setMonth] = useState("長月"); return <main className="glimpse page-in"><SeasonalScenery /><SeasonMark /><header className="title-head"><p>過ぎた日の心を、そっと覗く</p><h1>垣間見</h1></header><div className="month-nav"><button onClick={() => setMonth("葉月")}>〈</button><span>{month}<small>{month === "長月" ? "九月" : "八月"}</small></span><button onClick={() => setMonth("長月")}>〉</button></div><div className="past-list">{pastPoems.filter((_,i) => month === "長月" ? i < 2 : i === 2).map((p, i) => <article key={p.date}><header><span>{p.date}</span><em>「{p.theme}」</em></header><PoemText lines={p.lines} vertical /><footer>— {i === 0 ? "六十四" : i === 1 ? "二百十一" : "三十九"}番</footer></article>)}</div></main>; }

function Peek({ poem, pinned, onClose, onLetter, onReply }: { poem: Poem; pinned:Poem[]; onClose: () => void; onLetter: () => void; onReply: (poem: Poem) => void }) {
  return <main className="peek-page page-in"><SeasonalScenery /><button className="close" onClick={onClose}>そっと閉じる</button><header className="peek-head"><div className="number-mark">{poem.author.slice(0, 3)}</div><h1>{poem.author}番</h1><p>心に留めし歌</p></header>{pinned.length?<div className="pinned-scroll">{pinned.slice(0,3).map((p, i) => <article key={p.dbId??`${p.id}-${i}`}><span className="pin-order">{["一", "二", "三"][i]}</span><PoemText lines={p.lines} vertical /><button className="reply-link" onClick={() => onReply(p)}>この歌に返す</button></article>)}</div>:<div className="empty-keep"><p>この方が選びし歌は、<br/>まだありません。</p></div>}<div className="peek-actions"><p>名を知らぬまま、心を知る。</p><button className="primary" onClick={onLetter}>この方へ、文をしたためる</button></div></main>;
}

function GiftComposer({ mode, onClose, onSend, onDelivered }: { mode: GiftMode; onClose: () => void; onSend: (lines: string[], visibility: "public" | "private", scentKey:ScentKey|null, branchKey:BranchKey|null) => Promise<void>;onDelivered:()=>void }) {
  const theme=useTodayTheme();const currentSeason=useContext(CurrentSeasonContext);const season=theme?seasonFromDate(theme.date):currentSeason;const [lines, setLines] = useState(["", "", "", "", ""]); const [visibility, setVisibility] = useState<"public" | "private">(mode.visibility??(mode.kind === "letter" ? "private" : "public")); const [scentKey,setScentKey]=useState<ScentKey|null>(null);const [branchKey,setBranchKey]=useState<BranchKey|null>(null);const [submitting,setSubmitting]=useState(false);const [entrusted,setEntrusted]=useState(false); const submittingRef=useRef(false); const guides = [5,7,5,7,7];
  const send=async()=>{if(submittingRef.current)return;submittingRef.current=true;setSubmitting(true);try{await onSend(lines,visibility,visibility==="private"?scentKey:null,visibility==="private"?branchKey:null);setEntrusted(true);await new Promise(resolve=>window.setTimeout(resolve,650));onDelivered()}catch{}finally{submittingRef.current=false;setSubmitting(false)}};
  return <main className={`gift-compose page-in ${entrusted?"entrusted":""}`}>{entrusted&&<div className="courier-moment" role="status"><i aria-hidden="true"/><p>文は、使いの手へ渡りました</p></div>}<button className="close" disabled={submitting||entrusted} onClick={onClose}>そっと閉じる</button><SeasonMark /><header><p>{mode.recipient}番へ</p><h1>{mode.kind === "reply" ? "返歌を詠む" : "文をしたためる"}</h1></header>{mode.poem && <div className="source-poem"><p>心を寄せた歌</p><PoemText lines={mode.poem.lines} vertical /></div>}{mode.kind === "reply" && <fieldset className="visibility"><legend>この歌への返歌を</legend><label><input type="radio" checked={visibility === "public"} onChange={() => {setVisibility("public");setScentKey(null);setBranchKey(null)}} /><span>歌会に残す<small>皆が読める贈答歌として</small></span></label><label><input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} /><span>文として届ける<small>この方だけに、そっと</small></span></label></fieldset>}<div className="line-inputs">{lines.map((line,i) => <label key={i}><span>{guides[i]}</span><input value={line} onChange={e => setLines(old => old.map((v,x) => x === i ? e.target.value : v))} /><em>{line.length || ""}</em></label>)}</div>{visibility==="private"&&<div className="letter-adornments"><fieldset><legend>この文に、香を添えますか<small>添えずとも届けられます</small></legend><div className="adornment-options"><button type="button" className={scentKey===null?"chosen":""} onClick={()=>setScentKey(null)}><b>香なし</b></button>{(Object.keys(scents) as ScentKey[]).map(key=><button type="button" className={scentKey===key?"chosen":""} aria-pressed={scentKey===key} onClick={()=>setScentKey(key)} key={key}><b>{scents[key].name}</b><small>{scents[key].note}</small></button>)}</div></fieldset><fieldset><legend>一枝、添えますか<small>今の季節から、一つだけ</small></legend><div className="adornment-options branches"><button type="button" className={branchKey===null?"chosen":""} onClick={()=>setBranchKey(null)}><b>添えない</b></button>{seasonBranches[season].map(key=><button type="button" className={branchKey===key?"chosen":""} aria-pressed={branchKey===key} onClick={()=>setBranchKey(key)} key={key}><i className={`branch-line branch-${key}`} aria-hidden="true"/><b>{branches[key].name}</b></button>)}</div></fieldset></div>}<button className="primary" disabled={submitting||entrusted||!lines.every(Boolean)} aria-busy={submitting} onClick={send}>{submitting?"一首を届けています":"一首を結ぶ"}</button><p className="waiting-rule">この一首が返されるまで、<br />次の文は送れません。</p></main>;
}

function LetterTrace({poem}:{poem:Exchange["poems"][number]}) {
  if(!poem.scentKey&&!poem.branchKey)return null;
  return <div className="letter-trace">{poem.scentKey&&<p><span>香　{scents[poem.scentKey].name}</span><small>{scents[poem.scentKey].note}</small></p>}{poem.branchKey&&<p><i className={`branch-line branch-${poem.branchKey}`} aria-hidden="true"/><span>{branches[poem.branchKey].name}一枝を添えて</span></p>}</div>;
}

function Letters({ exchanges, unreadCounts, onOpen }: { exchanges: Exchange[]; unreadCounts:Record<string,number>; onOpen: (e: Exchange) => void }) {
  return <main className="letters page-in"><SeasonalScenery /><SeasonMark /><header className="title-head"><p>返歌のある時だけ、往来は続く</p><h1>文箱</h1></header><div className="letter-list">{exchanges.filter(e=>e.participant!==false).map(e => {const count=unreadCounts[String(e.id)]??0;return <button key={e.id} onClick={() => onOpen(e)}><span className={`folded-letter ${e.waiting ? "quiet" : ""}`} /><span><b>{e.person}番との文</b><small>{e.waiting ? "返歌を待っています" : "返歌が届いています"}</small></span><em>{count>0?<span className="arrived-count">{poemCountLabel(count)}</span>:"繙く"}</em></button>})}</div><p className="letter-note">まだ開かぬ文が、そっと待つところ。<br />言葉が返るまで、ただ待つ場所。</p></main>;
}

function ExchangeView({ exchange, onClose, onReply, returnLabel }: { exchange: Exchange; onClose: () => void; onReply: () => void; returnLabel: string }) {
  return <main className="exchange-page page-in"><button className="close" onClick={onClose}>{returnLabel}</button><header><p>{exchange.visibility === "public" ? "歌会に残る贈答歌" : "文の往来"}</p><h1>{exchange.visibility === "public" ? "返歌の往来" : `${exchange.person}番との文`}</h1></header><div className="exchange-flow">{exchange.poems.map((p,i) => <article key={p.id??i} className={p.fromMe ? "from-me" : "from-them"}><span>{i === 0 ? "元歌" : `返歌 ${i}`}</span><PoemText lines={p.lines} vertical />{exchange.visibility==="private"&&<LetterTrace poem={p}/>}<small>{p.fromMe ? "四百三十八番" : `${exchange.person}番`}</small></article>)}</div>{exchange.waiting ? <div className="waiting"><i /><p>一首を届けました。<br />返歌を、静かに待ちます。</p><small>返されるまで次の歌は送れません</small></div> : <button className="primary exchange-reply" onClick={onReply}>返歌をしたためる</button>}</main>;
}

function PublicReplies({ exchanges, onClose }: { exchanges: Exchange[]; onClose: () => void }) {
  const root = exchanges[0]?.poems[0];
  const replies = exchanges.flatMap(exchange => exchange.poems.slice(1).map((poem, index) => ({ ...poem, person: exchange.person, order: index + 1 })));
  return <main className="exchange-page public-replies-page page-in"><button className="close" onClick={onClose}>歌会へ戻る</button><header><p>歌会に残りし言の葉</p><h1>返歌 {replies.length}首</h1></header>{root && <section className="reply-root"><span>元歌</span><PoemText lines={root.lines} vertical /></section>}<div className="exchange-flow">{replies.map((reply, index) => <article key={`${reply.person}-${index}`} className={reply.fromMe ? "from-me" : "from-them"}><span>返歌 {index + 1}</span><PoemText lines={reply.lines} vertical /><small>— {reply.fromMe ? "四百三十八" : reply.person}番</small></article>)}</div><p className="all-replies-note">寄せられた返歌を、すべて。</p></main>;
}

function HeartKeep({ poems, onAware, onPeek, onReply }: { poems: Poem[]; onAware: (id: number) => void; onPeek: (p: Poem) => void; onReply: (p: Poem) => void }) {
  return <main className="heartkeep page-in"><SeasonalScenery /><SeasonMark /><header className="title-head"><p>あはれと思ひし歌</p><h1>心留め</h1></header>{poems.length === 0 ? <div className="empty-keep"><i /><p>心に留めし歌は、<br />まだありません。</p><small>歌会で「あはれ」と思う一首に出会えば、ここへ。</small></div> : <div className="kept-poems">{poems.map(poem => <article key={poem.id}><PoemText lines={poem.lines} vertical /><footer><span>— {poem.author}番</span><button onClick={() => onAware(poem.id)}>心留めから外す</button></footer><div><button onClick={() => onPeek(poem)}>垣間見</button><button onClick={() => onReply(poem)}>この歌に返す</button></div></article>)}</div>}</main>;
}

function UtaAwase({ pairs, onVote, onLeave }: { pairs:{id?:string;theme?:DbTheme;left:Poem;right:Poem}[];onVote:(id:string|undefined,vote:"left"|"draw"|"right")=>Promise<boolean>;onLeave: () => void }) {
  const [index,setIndex] = useState(0); const [votes,setVotes] = useState<Record<number,"left"|"draw"|"right">>({}); const pair = pairs[index]; const choice = votes[index];
  if(!pair)return <main className="utaawase page-in"><SeasonMark/><div className="empty-keep"><p>本日の歌合は、<br/>まだ始まっていません。</p><button className="text-button" onClick={onLeave}>今日へ戻る</button></div></main>;
  const choose=async(value:"left"|"draw"|"right")=>{if(await onVote(pair.id,value))setVotes(old=>({...old,[index]:value}))};
  return <main className="utaawase page-in"><SeasonalScenery /><button className="close" onClick={onLeave}>歌合を辞す</button><SeasonMark /><header className="awase-head"><p>{pair.theme?`${japaneseDate(pair.theme.date)}の歌合`:"本日の歌合"}</p><h1>題「{pair.theme?.title??""}」</h1><span>第 {index+1} 組 ／ {pairs.length} 組</span></header><div className="match-sheet"><section><b>左</b><PoemText lines={pair.left.lines} vertical />{choice && <small>— {pair.left.author}番</small>}</section><i className="match-divider" /><section><b>右</b><PoemText lines={pair.right.lines} vertical />{choice && <small>— {pair.right.author}番</small>}</section></div>{!choice ? <fieldset className="vote-choices"><legend>いずれに心寄る</legend><button onClick={() => choose("left")}>左に<br />心寄る</button><button onClick={() => choose("draw")}>持</button><button onClick={() => choose("right")}>右に<br />心寄る</button></fieldset> : <div className="vote-done"><p>{choice === "draw" ? "いずれも、心に残りました。" : `${choice === "left" ? "左" : "右"}の歌へ、心を寄せました。`}</p>{index < pairs.length-1 ? <button className="primary" onClick={() => setIndex(index+1)}>次なる組へ</button> : <button className="primary" onClick={onLeave}>歌合を納める</button>}</div>}</main>;
}

function Results({ selection, onContinue }: { selection:PendingResults;onContinue:()=>void }) {
  return <main className="results page-in"><SeasonalScenery/><header className="result-head"><p>一昨日の歌合の結果</p><h1>{japaneseDate(selection.theme.date)}</h1><span>題「{selection.theme.title}」</span><div className="result-story"><span>二日前　詠む</span><i/><span>昨日　歌合</span><i/><span>今日　撰歌</span></div><p className="result-copy">二日前に詠まれ、<br/>昨日の歌合で競われた歌より、<br/>今宵、三首を撰びました。</p><h2>撰歌</h2></header><div className="selected-poems">{selection.results.map((result)=>{const poem=result.poem!;return <article key={poem.id}><b>{["一の歌","二の歌","三の歌"][result.rank-1]}</b><PoemText lines={linesFromRow(poem)} vertical/><small>— {poem.users?.user_number??"—"}番</small></article>})}</div><button className="primary" onClick={onContinue}>今日へ</button></main>;
}

function Mine({ submitted, lines, onBegin }: { submitted: boolean; lines: string[]; onBegin: () => void }) { const theme=useTodayTheme(); const [pinned, setPinned] = useState<number[]>([0,1]); const togglePin = (id: number) => setPinned(old => old.includes(id) ? old.filter(x => x !== id) : old.length < 3 ? [...old,id] : old); return <main className="mine page-in"><SeasonalScenery /><SeasonMark /><section className="my-today"><p>本日の題</p><h1>「{theme?.title??""}」</h1>{submitted ? <><span>本日の一首は、歌筥に納まりました。</span><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent("navigate-gathering"))}>歌会の御簾をあげる　→</button></> : <><span>今日という日に、一首だけ。</span><button className="primary ink" onClick={onBegin}>詠む</button></>}</section><header className="mine-head"><div className="number-mark">四三八</div><p>四百三十八番の歌筥</p><h1>詠みし歌</h1><span>{submitted ? "四首" : "三首"}</span><small>心に留めし歌　{pinned.length} / 3</small></header><div className="season-counts"><span>春　〇首</span><span>夏　二首</span><span>秋　{submitted ? "二" : "一"}首</span><span>冬　〇首</span></div><div className="chronology"><span>今</span><i /><span>往時</span></div><div className="my-poems">{submitted && <article className="new"><header><span>{theme?japaneseDate(theme.date):""}</span><em>{theme?.title??""}</em></header><PoemText lines={lines} vertical /><p className="aware-total">あはれ　〇</p><button className="pin-button" onClick={() => togglePin(9)}>{pinned.includes(9) ? "留めし歌から外す" : pinned.length === 3 ? "三首を選定済み" : "心に留めし歌にする"}</button></article>}{pastPoems.map((p,i) => <article key={p.date}><header><span>{p.date}</span><em>{p.theme}</em></header><PoemText lines={p.lines} vertical /><p className="aware-total">あはれ　{["七","三","十一"][i]}</p><button className={`pin-button ${pinned.includes(i) ? "selected" : ""}`} onClick={() => togglePin(i)}>{pinned.includes(i) ? `心に留めし歌　${pinned.indexOf(i)+1}` : pinned.length === 3 ? "三首を選定済み" : "心に留めし歌にする"}</button></article>)}</div><p className="collection-note">選びし三首だけが、垣間見に現れます。<br />プロフィールの代わりに、三首。</p></main>; }

function ConnectedMine({ poems,pinned,awareCounts,onPin,onBegin,submitted,userNumber }: { poems:OwnPoem[];pinned:string[];awareCounts:Record<string,number>;onPin:(id:string)=>void;onBegin:()=>void;submitted:boolean;userNumber:number }) {
  const theme=useTodayTheme();return <main className="mine page-in"><SeasonalScenery/><SeasonMark/><section className="my-today"><p>本日の題</p><h1>「{theme?.title??""}」</h1>{submitted?<><span>本日の一首は、歌筥に納まりました。</span><button className="text-button" onClick={()=>window.dispatchEvent(new CustomEvent("navigate-gathering"))}>歌会の御簾をあげる　→</button></>:<><span>今日という日に、一首だけ。</span><button className="primary ink" onClick={onBegin}>詠む</button></>}</section><header className="mine-head"><div className="number-mark">{userNumber}</div><p>{userNumber}番の歌筥</p><h1>詠みし歌</h1><span>{poems.length}首</span><small>心に留めし歌　{pinned.length} / 3</small></header><div className="chronology"><span>今</span><i/><span>往時</span></div><div className="my-poems">{poems.map(poem=><article key={poem.id}><header><span>{poem.date}</span><em>{poem.theme}</em></header><PoemText lines={poem.lines} vertical/><p className="aware-total">あはれ　{awareCounts[poem.id]??0}</p><button className={`pin-button ${pinned.includes(poem.id)?"selected":""}`} onClick={()=>onPin(poem.id)}>{pinned.includes(poem.id)?`心に留めし歌　${pinned.indexOf(poem.id)+1}`:pinned.length>=3?"三首を選定済み":"心に留めし歌にする"}</button></article>)}</div></main>;
}

function AuthenticatedHome({initialNumber}:{initialNumber:number}) {
  const [initState,setInitState]=useState<InitState>("loading");
  const [todayTheme,setTodayTheme]=useState<DbTheme|null>(null);
  const [pendingResults,setPendingResults]=useState<PendingResults|null>(null);
  const [resultsChecked,setResultsChecked]=useState(false);
  const [peekPinned,setPeekPinned]=useState<Poem[]>([]);
  const [publicExchanges,setPublicExchanges]=useState<Exchange[]>([]);
  const [entered,setEntered]=useState(false);
  const [view,setView]=useState<View>("mine");
  const [awareIds,setAwareIds]=useState<number[]>([]);
  const [keptPoems,setKeptPoems]=useState<Poem[]>([]);
  const [livePoems,setLivePoems]=useState<Poem[]>([]);
  const [liveMatches,setLiveMatches]=useState<{id?:string;theme?:DbTheme;left:Poem;right:Poem}[]>([]);
  const [ownPoems,setOwnPoems]=useState<OwnPoem[]>([]);
  const [ownAwareCounts,setOwnAwareCounts]=useState<Record<string,number>>({});
  const [pinnedDbIds,setPinnedDbIds]=useState<string[]>([]);
  const [dbUserId,setDbUserId]=useState<string>();
  const [themeId,setThemeId]=useState<string>();
  const [userNumber,setUserNumber]=useState<number>(initialNumber);
  const [dbError,setDbError]=useState<string>();
  const [composing,setComposing]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [lines,setLines]=useState<string[]>([]);
  const [peeked,setPeeked]=useState<Poem|null>(null);
  const [gift,setGift]=useState<GiftMode|null>(null);
  const [openExchange,setOpenExchange]=useState<Exchange|null>(null);
  const [openReplyGroup,setOpenReplyGroup]=useState<Exchange[]|null>(null);
  const [exchangeReturn,setExchangeReturn]=useState<"letters"|"gathering">("letters");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [viewedExchangePoemIds,setViewedExchangePoemIds]=useState<string[]|null>(null);
  useEffect(()=>setUserNumber(initialNumber),[initialNumber]);
  useEffect(()=>{let active=true;setLivePoems([]);setKeptPoems([]);setLiveMatches([]);setOwnPoems([]);setExchanges([]);setPublicExchanges([]);(async()=>{try{const account=await ensureUser();if(!active)return;setDbUserId(account.user.id);setUserNumber(account.profile.user_number);const theme=await getTodayTheme();if(!active)return;if(!theme){setThemeId(undefined);setInitState("no-theme");return}setThemeId(theme.id);const [rows,myRows]=await Promise.all([getPoems(theme.id),getMyPoems(account.user.id)]);if(!active)return;const mapped:Poem[]=rows.map((row,index)=>({id:index+1,dbId:row.id,userId:row.user_id,author:String(row.users?.user_number??"—"),lines:linesFromRow(row)}));const own=rows.find(row=>row.user_id===account.user.id);setLivePoems(mapped);setOwnPoems(myRows.map((row:any)=>({id:row.id,lines:linesFromRow(row),date:row.themes?.date??"",theme:row.themes?.title??""})));setSubmitted(Boolean(own));setLines(own?linesFromRow(own):[]);setInitState("ready");const optional=await Promise.allSettled([getAwarePoemIds(account.user.id),getPinnedPoemIds(account.user.id),getTodayMatches(),getExchanges(account.user.id),getPublicExchanges()]);if(!active)return;const warnings:string[]=[];const value=<T,>(result:PromiseSettledResult<T>,fallback:T):T=>{if(result.status==="fulfilled")return result.value;warnings.push(result.reason instanceof Error?result.reason.message:String(result.reason));return fallback};const awareDbIds=value(optional[0],[] as string[]);try{const awareRows=await getPoemsByIds(awareDbIds);if(!active)return;const kept=awareRows.map((row,index)=>mapped.find(poem=>poem.dbId===row.id)??({id:100000+index,dbId:row.id,userId:row.user_id,author:String(row.users?.user_number??"—"),lines:linesFromRow(row)}));setKeptPoems(kept);setAwareIds(kept.map(poem=>poem.id))}catch(error){warnings.push(error instanceof Error?error.message:String(error));setKeptPoems([]);setAwareIds([])}setPinnedDbIds(value(optional[1],[] as string[]));const matchRows=value(optional[2],[] as any[]);const mapMatchPoem=(row:any,index:number):Poem=>({id:2000+index,dbId:row.id,userId:row.user_id,author:String(row.users?.user_number??"—"),lines:linesFromRow(row)});setLiveMatches(matchRows.filter((match:any)=>match.left&&match.right).map((match:any,index)=>({id:match.id,theme:match.theme as DbTheme|undefined,left:mapMatchPoem(match.left,index*2),right:mapMatchPoem(match.right,index*2+1)})));setExchanges(value(optional[3],[] as any[]).map((exchange:any)=>mapExchange(exchange,account.user.id)));setPublicExchanges(value(optional[4],[] as any[]).map((exchange:any)=>mapExchange(exchange,account.user.id)));if(warnings.length)setDbError(warnings.join(" / "));}catch(error){if(active){setInitState("error");setDbError(error instanceof Error?error.message:"必須データを読み込めませんでした")}}})();return()=>{active=false}},[]);
  useEffect(()=>{if(initState!=="ready")return;let active=true;getTodayTheme().then(theme=>{if(active)setTodayTheme(theme)}).catch(error=>{if(active)setDbError(error instanceof Error?error.message:"本日の題を表示できませんでした")});return()=>{active=false}},[initState]);
  useEffect(()=>{if(initState!=="ready"||!dbUserId)return;let active=true;setResultsChecked(false);getPendingResults(dbUserId).then(result=>{if(active)setPendingResults(result)}).catch(error=>{if(active)setDbError(error instanceof Error?error.message:"撰歌を読み込めませんでした")}).finally(()=>{if(active)setResultsChecked(true)});return()=>{active=false}},[initState,dbUserId]);
  useEffect(()=>{if(initState!=="ready"||!dbUserId)return;let active=true;getViewedExchangePoemIds(dbUserId).then(ids=>{if(active)setViewedExchangePoemIds(ids)}).catch(error=>{if(active)setDbError(error instanceof Error?error.message:"届きし文の数を読み込めませんでした")});return()=>{active=false}},[initState,dbUserId]);
  useEffect(()=>{if(initState!=="ready"||ownPoems.length===0)return;let active=true;Promise.allSettled(ownPoems.map(async poem=>[poem.id,await getMyPoemAwareCount(poem.id)] as const)).then(results=>{if(!active)return;const counts:Record<string,number>={};const errors:string[]=[];results.forEach(result=>{if(result.status==="fulfilled")counts[result.value[0]]=result.value[1];else errors.push(result.reason instanceof Error?result.reason.message:String(result.reason))});setOwnAwareCounts(counts);if(errors.length)setDbError(errors[0])});return()=>{active=false}},[initState,ownPoems]);
  useEffect(() => { const gathering = () => setView("gathering"); const mine = () => setView("mine"); window.addEventListener("navigate-gathering", gathering); window.addEventListener("navigate-today", mine); return () => { window.removeEventListener("navigate-gathering", gathering); window.removeEventListener("navigate-today", mine); }; }, []);
  const toggleAware = async (id: number) => { const poem=livePoems.find(item=>item.id===id)??keptPoems.find(item=>item.id===id);const active=!awareIds.includes(id);setAwareIds(old=>active?[...old,id]:old.filter(value=>value!==id));setKeptPoems(old=>active&&poem?[poem,...old.filter(item=>item.dbId!==poem.dbId)]:old.filter(item=>item.id!==id));if(dbUserId&&poem?.dbId){try{await setAware(dbUserId,poem.dbId,active)}catch(error){setAwareIds(old=>active?old.filter(value=>value!==id):[...old,id]);setKeptPoems(old=>active?old.filter(item=>item.id!==id):[poem,...old]);setDbError(error instanceof Error?error.message:"あはれを保存できませんでした")}} };
  const openPeek = async (poem:Poem) => {if(!dbUserId||!poem.userId)return;try{await recordGlimpse(dbUserId,poem.userId);const rows=await getPeekPoems(poem.userId);setPeekPinned(rows.slice(0,3).map((row:any,index)=>({id:3000+index,dbId:row.poem_id,userId:row.user_id,author:poem.author,lines:linesFromRow(row)})));setPeeked(poem)}catch(error){setDbError(error instanceof Error?error.message:"垣間見を開けませんでした")}};
  const togglePinDb=async(poemId:string)=>{if(!dbUserId)return;const active=!pinnedDbIds.includes(poemId);if(active&&pinnedDbIds.length>=3)return;const next=active?[...pinnedDbIds,poemId]:pinnedDbIds.filter(id=>id!==poemId);setPinnedDbIds(next);try{await replacePinned(next)}catch(error){setPinnedDbIds(pinnedDbIds);setDbError(error instanceof Error?error.message:"ピン留めを保存できませんでした")}};
  const viewedIds=viewedExchangePoemIds??[];
  const unreadByExchange=viewedExchangePoemIds===null?{}:Object.fromEntries(exchanges.filter(exchange=>exchange.participant!==false).map(exchange=>[String(exchange.id),exchange.poems.filter(poem=>!poem.fromMe&&poem.id&&!viewedIds.includes(poem.id)).length]));
  const unreadLetterCount=Object.values(unreadByExchange).reduce((total,count)=>total+count,0);
  const openLetter=(exchange:Exchange)=>{setExchangeReturn("letters");setOpenExchange(exchange);if(!dbUserId||viewedExchangePoemIds===null)return;const unseen=exchange.poems.filter(poem=>!poem.fromMe&&poem.id&&!viewedIds.includes(poem.id)).map(poem=>poem.id!);if(!unseen.length)return;void markExchangePoemsViewed(dbUserId,unseen).then(()=>setViewedExchangePoemIds(old=>Array.from(new Set([...(old??[]),...unseen])))).catch(error=>setDbError(error instanceof Error?error.message:"届きし文を確認済みにできませんでした"))};
  const themed=(content:React.ReactNode)=><ThemeContext.Provider value={todayTheme}>{content}</ThemeContext.Provider>;
  if(initState==="loading")return <AuthLoading/>;
  if(initState==="no-theme")return <ThemeUnavailable number={userNumber}/>;
  if(initState==="error")return <AccountError message={dbError??"必須データを読み込めませんでした"} onRetry={()=>window.location.reload()} onSignOut={()=>{void signOut()}}/>;
  if(!todayTheme)return <AuthLoading/>;
  if(!resultsChecked)return <AuthLoading/>;
  if(pendingResults)return <Results selection={pendingResults} onContinue={async()=>{const result=pendingResults;setPendingResults(null);setView("mine");if(dbUserId)try{await markResultsViewed(dbUserId,result.theme.id)}catch(error){setDbError(error instanceof Error?error.message:"撰歌の閲覧を記録できませんでした")}}}/>;
  if (!entered) return <Welcome onEnter={() => { setEntered(true); }} />;
  if (composing) return <Composer title={todayTheme.title} onCancel={() => setComposing(false)} onSubmit={async(value) => {try{if(dbUserId&&themeId){await submitPoem(dbUserId,themeId,value);const [rows,myRows]=await Promise.all([getPoems(themeId),getMyPoems(dbUserId)]);setLivePoems(rows.map((row,index)=>({id:index+1,dbId:row.id,userId:row.user_id,author:String(row.users?.user_number??"—"),lines:[row.line_1,row.line_2,row.line_3,row.line_4,row.line_5]})));setOwnPoems(myRows.map((row:any)=>({id:row.id,lines:[row.line_1,row.line_2,row.line_3,row.line_4,row.line_5],date:row.themes?.date??"",theme:row.themes?.title??""})));}setLines(value);setSubmitted(true);setComposing(false)}catch(error){setDbError(error instanceof Error?error.message:"歌を保存できませんでした")}}} />;
  if (gift) return <GiftComposer mode={gift} onClose={() => setGift(null)} onDelivered={()=>setGift(null)} onSend={async(sentLines, visibility, scentKey, branchKey) => { if (gift.exchangeId) { const current = exchanges.find(exchange => exchange.id === gift.exchangeId); if (!current) throw new Error("往来を確かめられませんでした");try{const saved=typeof gift.exchangeId==="string"?await addExchangePoem(gift.exchangeId,sentLines,scentKey,branchKey):null;const next = { ...current, waiting: true, poems: [...current.poems, { id:saved?.id,fromMe: true, lines: sentLines,scentKey,branchKey }] }; setExchanges(old => old.map(exchange => exchange.id === next.id ? next : exchange));setOpenExchange(next);return}catch(error){setDbError("文を届けられませんでした。しばし後に、もう一度お試しください。");throw error} } try{if(!gift.recipientId)throw new Error("届け先を確かめられませんでした");const saved=await saveExchange(gift.recipientId,gift.poem?.dbId??null,gift.kind,visibility,sentLines,scentKey,branchKey);const next: Exchange = { id:saved?.id??Date.now(), person: gift.recipient, visibility, waiting: true, poems: [...(gift.poem ? [{ fromMe: false, lines: gift.poem.lines }] : []), { fromMe: true, lines: sentLines,scentKey,branchKey }] }; setExchanges(old => [next, ...old]);setOpenExchange(next)}catch(error){setDbError("文を届けられませんでした。しばし後に、もう一度お試しください。");throw error} }} />;
  if (peeked) return <Peek poem={peeked} pinned={peekPinned} onClose={() => setPeeked(null)} onLetter={() => {setExchangeReturn("letters");setGift({kind:"letter",recipient:peeked.author,recipientId:peeked.userId});setPeeked(null)}} onReply={(poem) => {setExchangeReturn("gathering");setGift({kind:"reply",recipient:poem.author,recipientId:poem.userId,poem});setPeeked(null)}} />;
  if (openReplyGroup) return <PublicReplies exchanges={openReplyGroup} onClose={() => {setOpenReplyGroup(null);setView("gathering")}} />;
  if (openExchange) return <ExchangeView exchange={openExchange} returnLabel={exchangeReturn === "letters" ? "文箱へ戻る" : "歌会へ戻る"} onClose={() => {setOpenExchange(null);setView(exchangeReturn)}} onReply={() => setGift({kind:"letter",recipient:openExchange.person,exchangeId:openExchange.id,visibility:openExchange.visibility})} />;
  return themed(<div className="app-shell"><Header number={String(userNumber)} />{dbError&&<button className="db-error" onClick={()=>setDbError(undefined)}>{dbError}</button>}{view === "gathering" && <Gathering unlocked={submitted} poems={livePoems} onPeek={openPeek} onReply={(poem) => {setExchangeReturn("gathering");setGift({kind:"reply",recipient:poem.author,recipientId:poem.userId,poem})}} onOpenReplies={setOpenReplyGroup} publicExchanges={exchanges.filter(exchange => exchange.visibility === "public")} awareIds={awareIds} onAware={toggleAware} />}{view === "utaawase" && <UtaAwase pairs={liveMatches} onVote={async(id,value)=>{if(!id||!dbUserId)return true;try{await saveVote(id,dbUserId,value);return true}catch(error){setDbError(error instanceof Error?error.message:"歌合の票を保存できませんでした");return false}}} onLeave={() => setView("mine")} />}{view === "heartkeep" && <HeartKeep poems={keptPoems} onAware={toggleAware} onPeek={openPeek} onReply={(poem) => setGift({kind:"reply",recipient:poem.author,recipientId:poem.userId,poem})} />}{view === "letters" && <Letters exchanges={exchanges} unreadCounts={unreadByExchange} onOpen={openLetter} />}{view === "mine" && (dbUserId?<ConnectedMine poems={ownPoems} pinned={pinnedDbIds} awareCounts={ownAwareCounts} onPin={togglePinDb} submitted={submitted} userNumber={userNumber} onBegin={()=>setComposing(true)}/>:<Mine submitted={submitted} lines={lines} onBegin={() => setComposing(true)} />)}<Nav view={view} setView={setView} unlocked={submitted} letterCount={unreadLetterCount} /></div>);
}

function HomeContent() {
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

function AtmosphereProvider({children}:{children:React.ReactNode}) {
  const [timePeriod,setTimePeriod]=useState<TimePeriod>("day");
  const [season,setSeason]=useState<Season>("autumn");
  useEffect(()=>{const update=()=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Tokyo",hour:"2-digit",hourCycle:"h23",month:"numeric"}).formatToParts(new Date());const hour=Number(parts.find(part=>part.type==="hour")?.value??12);const month=Number(parts.find(part=>part.type==="month")?.value??9);const next:TimePeriod=hour>=5&&hour<11?"morning":hour>=11&&hour<17?"day":hour>=17&&hour<20?"evening":"night";setTimePeriod(next);setSeason(month>=3&&month<=5?"spring":month>=6&&month<=8?"summer":month>=9&&month<=11?"autumn":"winter");document.documentElement.dataset.timePeriod=next};update();const timer=window.setInterval(update,60_000);return()=>{window.clearInterval(timer);delete document.documentElement.dataset.timePeriod}},[]);
  return <TimeContext.Provider value={timePeriod}><CurrentSeasonContext.Provider value={season}>{children}</CurrentSeasonContext.Provider></TimeContext.Provider>;
}

export default function Home(){return <AtmosphereProvider><HomeContent/></AtmosphereProvider>}
