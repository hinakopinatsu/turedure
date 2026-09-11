import { supabase } from "./client";

function dbError(context:string,error:{message?:string;code?:string}|null):asserts error is null {
  if(error)throw new Error(`${context}: ${error.message??"不明なエラー"}${error.code?` (${error.code})`:""}`);
}

export type DbPoem = { id:string; user_id:string; theme_id:string; line_1:string; line_2:string; line_3:string; line_4:string; line_5:string; created_at:string; users:{user_number:number}|null };

export async function ensureUser() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error("ログインが必要です");
  const { data: profile, error } = await supabase.from("users").select("id,user_number").eq("id",session.user.id).single();
  dbError("利用者番号の取得",error);
  return { user: session.user, profile };
}

export async function signIn(email:string,password:string) {
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error)throw error;return data;
}

export async function signUp(email:string,password:string) {
  const {data,error}=await supabase.auth.signUp({email,password});
  if(error)throw error;return data;
}

export async function signOut() {
  const {error}=await supabase.auth.signOut();if(error)throw error;
}

export async function getTodayTheme() {
  const date = new Date().toLocaleDateString("sv-SE", { timeZone:"Asia/Tokyo" });
  const { data,error } = await supabase.from("themes").select("*").eq("date",date).single();
  dbError("本日の題の取得",error); return data;
}

export async function getPoems(themeId:string) {
  const { data,error } = await supabase.from("poems").select("*,users(user_number)").eq("theme_id",themeId).order("created_at");
  dbError("歌会の取得",error); return (data ?? []) as unknown as DbPoem[];
}

export async function getMyPoems(userId:string) {
  const { data,error } = await supabase.from("poems").select("*,themes(date,title)").eq("user_id",userId).order("created_at",{ascending:false});
  dbError("我が歌の取得",error); return data ?? [];
}

export async function getPinnedPoemIds(userId:string) {
  const {data,error}=await supabase.from("pinned_poems").select("poem_id,display_order").eq("user_id",userId).order("display_order");
  dbError("心に留めし歌の取得",error);return (data??[]).map(row=>row.poem_id as string);
}

export async function submitPoem(userId:string,themeId:string,lines:string[]) {
  const { data,error } = await supabase.from("poems").insert({user_id:userId,theme_id:themeId,line_1:lines[0],line_2:lines[1],line_3:lines[2],line_4:lines[3],line_5:lines[4]}).select().single();
  if (error) throw error; return data;
}

export async function getAwarePoemIds(userId:string) {
  const { data,error } = await supabase.from("reactions").select("poem_id").eq("user_id",userId).eq("reaction_type","aware");
  if (error) throw error; return (data ?? []).map(row=>row.poem_id as string);
}

export async function setAware(userId:string,poemId:string,active:boolean) {
  const query = active ? supabase.from("reactions").insert({user_id:userId,poem_id:poemId,reaction_type:"aware"}) : supabase.from("reactions").delete().eq("user_id",userId).eq("poem_id",poemId).eq("reaction_type","aware");
  const { error } = await query; if(error) throw error;
}

export async function replacePinned(poemIds:string[]) {
  const {error}=await supabase.rpc("replace_pinned_poems",{p_poem_ids:poemIds});if(error)throw error;
}

export async function recordGlimpse(viewerId:string,viewedId:string) {
  const {error}=await supabase.from("user_glimpses").upsert({viewer_user_id:viewerId,viewed_user_id:viewedId},{onConflict:"viewer_user_id,viewed_user_id"});if(error)throw error;
}

export async function beginExchange(recipientId:string,rootPoemId:string|null,kind:"reply"|"letter",visibility:"public"|"private",lines:string[]) {
  const {data,error}=await supabase.rpc("begin_exchange",{p_recipient:recipientId,p_root_poem:rootPoemId,p_kind:kind,p_visibility:visibility,p_lines:lines});if(error)throw error;return data;
}

export async function addExchangePoem(exchangeId:string,lines:string[]) {
  const {data,error}=await supabase.rpc("add_exchange_poem",{p_exchange_id:exchangeId,p_lines:lines});if(error)throw error;return data;
}

export async function getExchanges(userId:string) {
  const {data,error}=await supabase.from("poem_exchanges").select("*,initiator:users!poem_exchanges_initiator_user_id_fkey(user_number),recipient:users!poem_exchanges_recipient_user_id_fkey(user_number),exchange_poems(*)").or(`initiator_user_id.eq.${userId},recipient_user_id.eq.${userId}`).order("updated_at",{ascending:false});
  dbError("文箱の取得",error);return data??[];
}

export async function vote(matchId:string,userId:string,vote:"left"|"right"|"draw") {
  const {error}=await supabase.from("uta_awase_votes").insert({match_id:matchId,user_id:userId,vote});if(error)throw error;
}

export async function getTodayMatches() {
  const date=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
  const {data,error}=await supabase.from("uta_awase_matches").select("id,left:poems!uta_awase_matches_left_poem_id_fkey(*,users(user_number)),right:poems!uta_awase_matches_right_poem_id_fkey(*,users(user_number))").eq("battle_date",date).order("created_at");
  dbError("歌合の取得",error);return data??[];
}
