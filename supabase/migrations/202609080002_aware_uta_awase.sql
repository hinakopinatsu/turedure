create type public.uta_awase_vote as enum ('left','right','draw');

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  poem_id uuid not null references public.poems(id) on delete cascade,
  reaction_type text not null default 'aware' check(reaction_type='aware'), created_at timestamptz not null default now(),
  unique(user_id,poem_id,reaction_type)
);
create table if not exists public.uta_awase_matches (
  id uuid primary key default gen_random_uuid(), theme_id uuid not null references public.themes(id),
  left_poem_id uuid not null references public.poems(id), right_poem_id uuid not null references public.poems(id),
  battle_date date not null, created_at timestamptz not null default now(),
  check(left_poem_id<>right_poem_id), unique(theme_id,left_poem_id,right_poem_id)
);
create table if not exists public.uta_awase_votes (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references public.uta_awase_matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade, vote public.uta_awase_vote not null,
  created_at timestamptz not null default now(), unique(match_id,user_id)
);
create table if not exists public.uta_awase_results (
  id uuid primary key default gen_random_uuid(), theme_id uuid not null references public.themes(id), poem_id uuid not null references public.poems(id),
  score numeric not null, match_count integer not null, win_count integer not null, draw_count integer not null, loss_count integer not null,
  rank smallint check(rank between 1 and 3), calculated_at timestamptz not null default now(), unique(theme_id,poem_id)
);
create table if not exists public.result_views (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade, viewed_at timestamptz not null default now(), unique(user_id,theme_id)
);

alter table public.reactions enable row level security; alter table public.uta_awase_matches enable row level security;
alter table public.uta_awase_votes enable row level security; alter table public.uta_awase_results enable row level security;
alter table public.result_views enable row level security;

create policy "own aware rows only" on public.reactions for select using(user_id=auth.uid());
create policy "aware another poem" on public.reactions for insert with check(user_id=auth.uid() and not exists(select 1 from public.poems p where p.id=poem_id and p.user_id=auth.uid()));
create policy "remove own aware" on public.reactions for delete using(user_id=auth.uid());
create policy "matches readable while active" on public.uta_awase_matches for select to authenticated using(battle_date<=current_date);
create policy "own votes readable" on public.uta_awase_votes for select using(user_id=auth.uid());
create policy "vote once and not own match" on public.uta_awase_votes for insert with check(
  user_id=auth.uid() and not exists(select 1 from public.uta_awase_matches m join public.poems l on l.id=m.left_poem_id join public.poems r on r.id=m.right_poem_id where m.id=match_id and auth.uid() in (l.user_id,r.user_id))
);
create policy "published results readable" on public.uta_awase_results for select to authenticated using(calculated_at<=now());
create policy "own result views" on public.result_views for all using(user_id=auth.uid()) with check(user_id=auth.uid());

-- 総数を返せるのは、その歌の作者だけ。reactions自体も本人の行以外は読めない。
create or replace function public.my_poem_aware_count(p_poem_id uuid) returns bigint
language sql security definer stable set search_path=public as $$
  select count(*) from public.reactions r join public.poems p on p.id=r.poem_id
  where r.poem_id=p_poem_id and p.user_id=auth.uid() and r.reaction_type='aware'
$$;
grant execute on function public.my_poem_aware_count(uuid) to authenticated;

-- 日次バッチ用。あはれは参照せず、平均得点だけを集計する。
create or replace function public.calculate_uta_awase_results(p_theme_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'admin only'; end if;
  insert into public.uta_awase_results(theme_id,poem_id,score,match_count,win_count,draw_count,loss_count,rank)
  with entries as (
    select m.theme_id,m.left_poem_id poem_id,
      avg(case v.vote when 'left' then 3 when 'draw' then 1 else 0 end) score,
      count(distinct m.id) match_count,count(*) filter(where v.vote='left') wins,count(*) filter(where v.vote='draw') draws,count(*) filter(where v.vote='right') losses
    from public.uta_awase_matches m join public.uta_awase_votes v on v.match_id=m.id where m.theme_id=p_theme_id group by 1,2
    union all
    select m.theme_id,m.right_poem_id,
      avg(case v.vote when 'right' then 3 when 'draw' then 1 else 0 end),
      count(distinct m.id),count(*) filter(where v.vote='right'),count(*) filter(where v.vote='draw'),count(*) filter(where v.vote='left')
    from public.uta_awase_matches m join public.uta_awase_votes v on v.match_id=m.id where m.theme_id=p_theme_id group by 1,2
  ), ranked as (select *,row_number() over(order by score desc,(wins::numeric/nullif(wins+draws+losses,0)) desc,random()) rank_no from entries)
  select theme_id,poem_id,score,match_count,wins,draws,losses,case when rank_no<=3 then rank_no else null end from ranked
  on conflict(theme_id,poem_id) do update set score=excluded.score,match_count=excluded.match_count,win_count=excluded.win_count,draw_count=excluded.draw_count,loss_count=excluded.loss_count,rank=excluded.rank,calculated_at=now();
end $$;
