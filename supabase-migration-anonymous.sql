alter table public.motions
  add column if not exists is_anonymous boolean not null default false;
