alter table public.motions
  drop column if exists motion;

alter table public.motions
  alter column supporting_argument set not null;

alter table public.motions
  drop constraint if exists motions_supporting_argument_check;

alter table public.motions
  add constraint motions_supporting_argument_check
  check (char_length(supporting_argument) between 1 and 3000);
