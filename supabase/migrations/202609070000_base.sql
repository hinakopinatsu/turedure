create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  user_number integer,
  created_at timestamptz not null default now()
);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  title text not null check(length(trim(title))>0),
  seasonal_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.poems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  line_1 text not null check(length(trim(line_1))>0),
  line_2 text not null check(length(trim(line_2))>0),
  line_3 text not null check(length(trim(line_3))>0),
  line_4 text not null check(length(trim(line_4))>0),
  line_5 text not null check(length(trim(line_5))>0),
  selected_as_daily_pick boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,theme_id)
);

alter table public.users enable row level security;
alter table public.themes enable row level security;
alter table public.poems enable row level security;

create policy "numbers are readable" on public.users for select to authenticated using(true);
create policy "own user row" on public.users for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "themes are readable" on public.themes for select to authenticated using(true);
create policy "own poems insert" on public.poems for insert to authenticated with check(user_id=auth.uid());
create policy "own poems readable" on public.poems for select to authenticated using(user_id=auth.uid());
create or replace function public.has_submitted_to_theme(p_theme_id uuid) returns boolean
language sql security definer stable set search_path=public as $$
  select exists(select 1 from public.poems where theme_id=p_theme_id and user_id=auth.uid())
$$;
create policy "past poems or unlocked gathering readable" on public.poems for select to authenticated using(
  exists (
    select 1 from public.themes target
    where target.id=theme_id and (
      target.date<current_date or public.has_submitted_to_theme(target.id)
    )
  )
);

-- Auth登録時に公開ユーザー行を作る。番号は次migrationのassign_user_number triggerが採番する。
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.users(id) values(new.id) on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

insert into public.users(id) select id from auth.users on conflict(id) do nothing;

-- プロトタイプで使う本日の題。運営投入時はupsertで差し替えられる。
insert into public.themes(date,title,seasonal_text)
values(current_date,'言えなかったこと','白露') on conflict(date) do nothing;
