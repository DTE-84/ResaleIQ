-- Evaluate auth.uid() once per query instead of once per row (same access rules).
-- listings only exists on older deployments, so guard like the hardening migration.
do $$ begin
  if to_regclass('public.listings') is not null then
    alter policy "Users can view their own listings" on public.listings
      using ((select auth.uid()) = user_id);
    alter policy "Users can insert their own listings" on public.listings
      with check ((select auth.uid()) = user_id);
    alter policy "Users can delete their own listings" on public.listings
      using ((select auth.uid()) = user_id);
  end if;
end $$;
