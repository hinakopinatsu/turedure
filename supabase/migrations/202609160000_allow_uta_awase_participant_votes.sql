-- 匿名の小規模な歌合でも投票が成立するよう、作者本人の対戦への投票を許可する。
-- 一人一票は uta_awase_votes_once_unique により引き続き保証される。
drop policy if exists "vote once and not own match" on public.uta_awase_votes;

create policy "authenticated users may vote once"
  on public.uta_awase_votes
  for insert
  to authenticated
  with check (user_id = auth.uid());
