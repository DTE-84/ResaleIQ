-- Evaluate auth.uid() once per query instead of once per row.
-- Same access rules as before; this only changes how Postgres plans the check.
alter policy "Users can view their own inventory" on public.inventory
  using ((select auth.uid()) = user_id);

alter policy "Users can insert their own inventory" on public.inventory
  with check ((select auth.uid()) = user_id);

alter policy "Users can update their own inventory" on public.inventory
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete their own inventory" on public.inventory
  using ((select auth.uid()) = user_id);
