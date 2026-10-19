create table if not exists public.motion_interests (
  motion_id bigint not null references public.motions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (motion_id, user_id)
);

alter table public.motion_interests enable row level security;

drop policy if exists "Anyone can read debate interest" on public.motion_interests;
create policy "Anyone can read debate interest"
  on public.motion_interests for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can add debate interest" on public.motion_interests;
create policy "Users can add debate interest"
  on public.motion_interests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their debate interest" on public.motion_interests;
create policy "Users can remove their debate interest"
  on public.motion_interests for delete
  to authenticated
  using (auth.uid() = user_id);
