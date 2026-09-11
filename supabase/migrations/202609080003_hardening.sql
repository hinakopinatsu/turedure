create or replace function public.replace_pinned_poems(p_poem_ids uuid[]) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); poem_id uuid; position smallint:=1;
begin
  if uid is null or coalesce(array_length(p_poem_ids,1),0)>3 then raise exception 'at most three poems'; end if;
  if exists(select 1 from unnest(p_poem_ids) x left join public.poems p on p.id=x where p.id is null or p.user_id<>uid) then raise exception 'only own poems can be pinned'; end if;
  delete from public.pinned_poems where user_id=uid;
  foreach poem_id in array p_poem_ids loop
    insert into public.pinned_poems(user_id,poem_id,display_order) values(uid,poem_id,position);
    position:=position+1;
  end loop;
end $$;

revoke all on function public.replace_pinned_poems(uuid[]) from public;
grant execute on function public.replace_pinned_poems(uuid[]) to authenticated;
revoke all on function public.begin_exchange(uuid,uuid,public.exchange_kind,public.exchange_visibility,text[]) from public;
revoke all on function public.add_exchange_poem(uuid,text[]) from public;
revoke all on function public.my_poem_aware_count(uuid) from public;
grant execute on function public.begin_exchange(uuid,uuid,public.exchange_kind,public.exchange_visibility,text[]) to authenticated;
grant execute on function public.add_exchange_poem(uuid,text[]) to authenticated;
grant execute on function public.my_poem_aware_count(uuid) to authenticated;
