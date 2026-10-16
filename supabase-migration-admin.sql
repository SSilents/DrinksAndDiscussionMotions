create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read admin membership" on public.admin_users;
create policy "Admins can read admin membership"
  on public.admin_users for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can delete motions" on public.motions;
create policy "Admins can delete motions"
  on public.motions for delete
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
