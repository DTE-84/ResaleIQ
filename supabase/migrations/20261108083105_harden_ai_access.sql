create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
create table private.ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hour_start timestamptz not null,
  hour_count integer not null check (hour_count >= 0),
  day_start timestamptz not null,
  day_count integer not null check (day_count >= 0)
);
alter table private.ai_usage enable row level security;
revoke all on private.ai_usage from public, anon, authenticated;
grant select, insert, update on private.ai_usage to service_role;

-- A conditional upsert serializes concurrent calls per user across all instances.
-- Only the trusted Edge Function can consume quota. No prompts/images are stored.
create function public.consume_ai_quota(p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := statement_timestamp();
  v_hour timestamptz := date_trunc('hour', v_now at time zone 'UTC') at time zone 'UTC';
  v_day timestamptz := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_rows integer;
begin
  insert into private.ai_usage as usage (user_id, hour_start, hour_count, day_start, day_count)
  values (p_user_id, v_hour, 1, v_day, 1)
  on conflict (user_id) do update set
    hour_start = v_hour,
    hour_count = case when usage.hour_start = v_hour then usage.hour_count + 1 else 1 end,
    day_start = v_day,
    day_count = case when usage.day_start = v_day then usage.day_count + 1 else 1 end
  where (usage.hour_start <> v_hour or usage.hour_count < 10)
    and (usage.day_start <> v_day or usage.day_count < 30);
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
revoke all on function public.consume_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;

alter table public.inventory enable row level security;
-- Supabase's default grants can include TRUNCATE, which bypasses RLS.
revoke all on public.inventory from public, anon, authenticated;
grant select, insert, update, delete on public.inventory to authenticated;
alter policy "Users can view their own inventory" on public.inventory to authenticated;
alter policy "Users can insert their own inventory" on public.inventory to authenticated;
alter policy "Users can update their own inventory" on public.inventory to authenticated;
alter policy "Users can delete their own inventory" on public.inventory to authenticated;
alter function public.handle_updated_at() set search_path = '';

-- Older deployments also contain this user-owned table, unused by the current UI.
do $$ begin
  if to_regclass('public.listings') is not null then
    alter table public.listings enable row level security;
    revoke all on public.listings from public, anon, authenticated;
    grant select, insert, update, delete on public.listings to authenticated;
    alter policy "Users can view their own listings" on public.listings to authenticated;
    alter policy "Users can insert their own listings" on public.listings to authenticated;
    alter policy "Users can update their own listings" on public.listings to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    alter policy "Users can delete their own listings" on public.listings to authenticated;
  end if;
end $$;
