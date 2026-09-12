-- 一首ごとの香と文付枝。既存行はNULLのまま保つ。
alter table public.exchange_poems
  add column if not exists scent_key text,
  add column if not exists branch_key text;

alter table public.exchange_poems
  add constraint exchange_poems_scent_key_allowed check (
    scent_key is null or scent_key in ('baika','kayo','kikka','kurobo')
  ),
  add constraint exchange_poems_branch_key_allowed check (
    branch_key is null or branch_key in (
      'ume','yamabuki','fuji','tachibana','unohana','hasu',
      'hagi','susuki','kiku','matsu','ume_winter','snow_branch'
    )
  );

-- RPC以外の管理経路でも、公開往来へ装飾が保存されることを防ぐ。
create function public.enforce_private_exchange_adornments()
returns trigger language plpgsql set search_path=public as $$
begin
  if (new.scent_key is not null or new.branch_key is not null)
    and not exists (
      select 1 from public.poem_exchanges e
      where e.id=new.exchange_id and e.visibility='private'
    )
  then
    raise exception 'adornments are private only';
  end if;
  return new;
end $$;

create trigger exchange_poems_private_adornments
before insert or update of scent_key,branch_key on public.exchange_poems
for each row execute function public.enforce_private_exchange_adornments();

-- 末尾の任意引数により、香・枝なしの既存クライアントも同じ呼び方を続けられる。
drop function if exists public.begin_exchange(uuid,uuid,public.exchange_kind,public.exchange_visibility,text[]);
create function public.begin_exchange(
  p_recipient uuid,
  p_root_poem uuid,
  p_kind public.exchange_kind,
  p_visibility public.exchange_visibility,
  p_lines text[],
  p_scent_key text default null,
  p_branch_key text default null
)
returns public.poem_exchanges
language plpgsql security definer set search_path=public as $$
declare ex public.poem_exchanges; uid uuid:=auth.uid();
begin
  if uid is null or uid=p_recipient then raise exception 'invalid recipient'; end if;
  if array_length(p_lines,1)<>5 then raise exception 'a poem must have five lines'; end if;
  if (p_kind='reply' and p_root_poem is null) or (p_kind='letter' and p_root_poem is not null) then raise exception 'invalid root poem'; end if;
  if p_scent_key is not null and p_scent_key not in ('baika','kayo','kikka','kurobo') then raise exception 'invalid scent'; end if;
  if p_branch_key is not null and p_branch_key not in ('ume','yamabuki','fuji','tachibana','unohana','hasu','hagi','susuki','kiku','matsu','ume_winter','snow_branch') then raise exception 'invalid branch'; end if;
  if (p_scent_key is not null or p_branch_key is not null) and p_visibility<>'private' then raise exception 'adornments are private only'; end if;
  if p_kind='reply' and not exists(select 1 from public.poems where id=p_root_poem and user_id=p_recipient) then raise exception 'recipient must own root poem'; end if;
  if p_kind='letter' and not exists(select 1 from public.user_glimpses where viewer_user_id=uid and viewed_user_id=p_recipient) then raise exception 'recipient must first be glimpsed'; end if;
  insert into public.poem_exchanges(initiator_user_id,recipient_user_id,root_poem_id,exchange_type,visibility,last_sender_user_id)
  values(uid,p_recipient,p_root_poem,p_kind,p_visibility,uid) returning * into ex;
  insert into public.exchange_poems(exchange_id,sender_user_id,line_1,line_2,line_3,line_4,line_5,scent_key,branch_key)
  values(ex.id,uid,p_lines[1],p_lines[2],p_lines[3],p_lines[4],p_lines[5],p_scent_key,p_branch_key);
  return ex;
end $$;

drop function if exists public.add_exchange_poem(uuid,text[]);
create function public.add_exchange_poem(
  p_exchange_id uuid,
  p_lines text[],
  p_scent_key text default null,
  p_branch_key text default null
)
returns public.exchange_poems
language plpgsql security definer set search_path=public as $$
declare ex public.poem_exchanges; result public.exchange_poems; uid uuid:=auth.uid();
begin
  select * into ex from public.poem_exchanges where id=p_exchange_id for update;
  if uid is null or uid not in(ex.initiator_user_id,ex.recipient_user_id) then raise exception 'not a participant'; end if;
  if ex.last_sender_user_id=uid then raise exception 'await the other person'; end if;
  if array_length(p_lines,1)<>5 then raise exception 'a poem must have five lines'; end if;
  if p_scent_key is not null and p_scent_key not in ('baika','kayo','kikka','kurobo') then raise exception 'invalid scent'; end if;
  if p_branch_key is not null and p_branch_key not in ('ume','yamabuki','fuji','tachibana','unohana','hasu','hagi','susuki','kiku','matsu','ume_winter','snow_branch') then raise exception 'invalid branch'; end if;
  if (p_scent_key is not null or p_branch_key is not null) and ex.visibility<>'private' then raise exception 'adornments are private only'; end if;
  insert into public.exchange_poems(exchange_id,sender_user_id,line_1,line_2,line_3,line_4,line_5,scent_key,branch_key)
  values(p_exchange_id,uid,p_lines[1],p_lines[2],p_lines[3],p_lines[4],p_lines[5],p_scent_key,p_branch_key)
  returning * into result;
  update public.poem_exchanges set last_sender_user_id=uid,updated_at=now() where id=p_exchange_id;
  return result;
end $$;

revoke all on function public.begin_exchange(uuid,uuid,public.exchange_kind,public.exchange_visibility,text[],text,text) from public;
revoke all on function public.add_exchange_poem(uuid,text[],text,text) from public;
grant execute on function public.begin_exchange(uuid,uuid,public.exchange_kind,public.exchange_visibility,text[],text,text) to authenticated;
grant execute on function public.add_exchange_poem(uuid,text[],text,text) to authenticated;
