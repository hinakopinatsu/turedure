-- 文箱の確認状態は本人の未確認件数にだけ使用し、相手には公開しない。
create table if not exists public.exchange_poem_views (
  user_id uuid not null references public.users(id) on delete cascade,
  exchange_poem_id uuid not null references public.exchange_poems(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, exchange_poem_id)
);

-- 複合主キーは user_id 起点の取得を担う。こちらは外部キーのcascadeと歌単位の照合用。
create index if not exists exchange_poem_views_poem_idx
  on public.exchange_poem_views(exchange_poem_id);

alter table public.exchange_poem_views enable row level security;

create policy "users see only own exchange poem views"
  on public.exchange_poem_views for select to authenticated
  using (user_id = auth.uid());

create policy "users mark only received exchange poems"
  on public.exchange_poem_views for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.exchange_poems ep
      join public.poem_exchanges e on e.id = ep.exchange_id
      where ep.id = exchange_poem_id
        and ep.sender_user_id <> auth.uid()
        and auth.uid() in (e.initiator_user_id, e.recipient_user_id)
    )
  );

grant select, insert on public.exchange_poem_views to authenticated;
revoke update, delete on public.exchange_poem_views from authenticated;
