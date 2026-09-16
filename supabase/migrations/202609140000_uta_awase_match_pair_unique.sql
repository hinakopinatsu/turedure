-- 日次処理の冪等な upsert に必要な競合キー。
-- 既存データに重複がある場合は削除・統合せず、適用を停止する。
do $$
begin
  if exists (
    select 1
    from public.uta_awase_matches
    group by theme_id, left_poem_id, right_poem_id
    having count(*) > 1
  ) then
    raise exception 'duplicate uta_awase match pairs exist; unique index was not created';
  end if;
end
$$;

create unique index if not exists uta_awase_matches_pair_unique
  on public.uta_awase_matches (theme_id, left_poem_id, right_poem_id);
