-- ツレヅレ: 番号・垣間見・贈答歌の基盤
create extension if not exists pgcrypto;

alter table public.users add column if not exists user_number integer;
alter table public.users add constraint users_number_range check (user_number between 0 and 9999);
create unique index if not exists users_user_number_unique on public.users(user_number);

-- 0番は管理者だけ。一般番号は空いている番号からDB内で無作為に選ぶ。
create or replace function public.assign_user_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare chosen integer;
begin
  perform pg_advisory_xact_lock(4389999);
  if new.user_number = 0 and coalesce((auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'user number 0 is reserved';
  end if;
  if new.user_number is null then
    select n into chosen from generate_series(1,9999) n
    where not exists (select 1 from public.users u where u.user_number = n)
    order by random() limit 1;
    if chosen is null then raise exception 'no user number remains'; end if;
    new.user_number := chosen;
  end if;
  return new;
end $$;
drop trigger if exists users_assign_number on public.users;
create trigger users_assign_number before insert on public.users for each row execute function public.assign_user_number();

create table if not exists public.pinned_poems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  poem_id uuid not null references public.poems(id) on delete cascade,
  display_order smallint not null check (display_order between 1 and 3),
  created_at timestamptz not null default now(),
  unique(user_id, poem_id), unique(user_id, display_order)
);
create table if not exists public.user_glimpses (
  viewer_user_id uuid not null references public.users(id) on delete cascade,
  viewed_user_id uuid not null references public.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key(viewer_user_id,viewed_user_id), check(viewer_user_id<>viewed_user_id)
);

create type public.exchange_kind as enum ('reply','letter');
create type public.exchange_visibility as enum ('public','private');
create table if not exists public.poem_exchanges (
  id uuid primary key default gen_random_uuid(),
  initiator_user_id uuid not null references public.users(id),
  recipient_user_id uuid not null references public.users(id),
  root_poem_id uuid references public.poems(id),
  exchange_type public.exchange_kind not null,
  visibility public.exchange_visibility not null,
  last_sender_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (initiator_user_id <> recipient_user_id),
  check ((exchange_type = 'reply' and root_poem_id is not null) or (exchange_type = 'letter' and root_poem_id is null))
);
create table if not exists public.exchange_poems (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.poem_exchanges(id) on delete cascade,
  sender_user_id uuid not null references public.users(id),
  line_1 text not null check (length(trim(line_1)) > 0), line_2 text not null check (length(trim(line_2)) > 0),
  line_3 text not null check (length(trim(line_3)) > 0), line_4 text not null check (length(trim(line_4)) > 0),
  line_5 text not null check (length(trim(line_5)) > 0), created_at timestamptz not null default now()
);

create or replace function public.begin_exchange(p_recipient uuid, p_root_poem uuid, p_kind public.exchange_kind, p_visibility public.exchange_visibility, p_lines text[])
returns public.poem_exchanges language plpgsql security definer set search_path = public as $$
declare ex public.poem_exchanges; uid uuid := auth.uid();
begin
  if uid is null or uid=p_recipient then raise exception 'invalid recipient'; end if;
  if array_length(p_lines,1)<>5 then raise exception 'a poem must have five lines'; end if;
  if (p_kind='reply' and p_root_poem is null) or (p_kind='letter' and p_root_poem is not null) then raise exception 'invalid root poem'; end if;
  if p_kind='letter' and not exists (
    select 1 from public.user_glimpses where viewer_user_id=uid and viewed_user_id=p_recipient
  ) then raise exception 'recipient must first be glimpsed'; end if;
  insert into public.poem_exchanges(initiator_user_id,recipient_user_id,root_poem_id,exchange_type,visibility,last_sender_user_id)
  values(uid,p_recipient,p_root_poem,p_kind,p_visibility,uid) returning * into ex;
  insert into public.exchange_poems(exchange_id,sender_user_id,line_1,line_2,line_3,line_4,line_5)
  values(ex.id,uid,p_lines[1],p_lines[2],p_lines[3],p_lines[4],p_lines[5]);
  return ex;
end $$;

-- 追加送信はRPCだけを使用。参加者・交互性を行ロック下で検証する。
create or replace function public.add_exchange_poem(p_exchange_id uuid, p_lines text[])
returns public.exchange_poems language plpgsql security definer set search_path = public as $$
declare ex public.poem_exchanges; result public.exchange_poems; uid uuid := auth.uid();
begin
  select * into ex from public.poem_exchanges where id = p_exchange_id for update;
  if uid is null or uid not in (ex.initiator_user_id, ex.recipient_user_id) then raise exception 'not a participant'; end if;
  if ex.last_sender_user_id = uid then raise exception 'await the other person'; end if;
  if array_length(p_lines,1) <> 5 then raise exception 'a poem must have five lines'; end if;
  insert into public.exchange_poems(exchange_id,sender_user_id,line_1,line_2,line_3,line_4,line_5)
  values(p_exchange_id,uid,p_lines[1],p_lines[2],p_lines[3],p_lines[4],p_lines[5]) returning * into result;
  update public.poem_exchanges set last_sender_user_id=uid,updated_at=now() where id=p_exchange_id;
  return result;
end $$;

alter table public.pinned_poems enable row level security;
alter table public.user_glimpses enable row level security;
alter table public.poem_exchanges enable row level security;
alter table public.exchange_poems enable row level security;

create policy "owner manages pinned poems" on public.pinned_poems for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "authenticated sees pinned selection" on public.pinned_poems for select to authenticated using (true);
create policy "viewer records and sees own glimpses" on public.user_glimpses for all using (viewer_user_id=auth.uid()) with check (viewer_user_id=auth.uid());
create policy "participants see private; all see public" on public.poem_exchanges for select to authenticated using (visibility='public' or auth.uid() in (initiator_user_id,recipient_user_id));
create policy "exchange poems follow exchange visibility" on public.exchange_poems for select to authenticated using (exists (select 1 from public.poem_exchanges e where e.id=exchange_id and (e.visibility='public' or auth.uid() in (e.initiator_user_id,e.recipient_user_id))));

-- 他人の全履歴を公開せず、垣間見用の最大三首だけ返す。
create or replace view public.peek_poems with (security_invoker=true) as
select pp.user_id, pp.display_order, p.id poem_id, p.line_1,p.line_2,p.line_3,p.line_4,p.line_5
from public.pinned_poems pp join public.poems p on p.id=pp.poem_id
order by pp.user_id,pp.display_order;

revoke insert,update,delete on public.exchange_poems from authenticated;
revoke insert,update,delete on public.poem_exchanges from authenticated;
grant execute on function public.begin_exchange(uuid,uuid,public.exchange_kind,public.exchange_visibility,text[]) to authenticated;
grant execute on function public.add_exchange_poem(uuid,text[]) to authenticated;
