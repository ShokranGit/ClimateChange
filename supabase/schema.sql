-- ClimateChange — course membership and student layers.
-- Run this in the Supabase SQL editor of the new project.
--
-- The anon key shipped to the browser is public by design. Everything below
-- assumes that and puts row-level security in front of every table.

create extension if not exists "pgcrypto";

-- ── courses ────────────────────────────────────────────────────────────────
create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  title       text not null,
  term        text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'student' check (role in ('student','instructor')),
  created_at  timestamptz not null default now(),
  unique (course_id, user_id)
);

-- ── student layers ─────────────────────────────────────────────────────────
-- A "layer" is what a student makes and exports. The word matters in a GIS
-- course: what leaves this system is a layer, not a map.
create table if not exists public.layers (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid references public.courses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  geom_type   text not null check (geom_type in ('point','line','polygon','mixed')),
  columns     jsonb not null default '[]'::jsonb,  -- the student's own column definitions
  shared      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.features (
  id          uuid primary key default gen_random_uuid(),
  layer_id    uuid not null references public.layers(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  geometry    jsonb not null,   -- GeoJSON geometry, WGS84
  properties  jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists features_layer_idx on public.features(layer_id);

-- Fieldnotes keep the ethnographic prompts as first-class columns rather than
-- free text, so they can be compared across a class.
create table if not exists public.fieldnotes (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid references public.courses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  feature_id  uuid references public.features(id) on delete set null,
  geometry    jsonb,
  sight       text, sound text, smell text,
  people      text, activity text, surprise text,
  water       text,    -- added for this course: what the water is doing here
  body        text,
  observed_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ── helpers ────────────────────────────────────────────────────────────────
create or replace function public.is_member(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.course_id = p_course and m.user_id = auth.uid()
  );
$$;

create or replace function public.join_course(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select id into c from courses where upper(code) = upper(p_code);
  if c is null then raise exception 'No course with that code.'; end if;
  insert into memberships (course_id, user_id) values (c, auth.uid())
    on conflict (course_id, user_id) do nothing;
  return c;
end;
$$;

-- ── row level security ─────────────────────────────────────────────────────
alter table public.courses     enable row level security;
alter table public.memberships enable row level security;
alter table public.layers      enable row level security;
alter table public.features    enable row level security;
alter table public.fieldnotes  enable row level security;

drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select
  using (public.is_member(id) or owner_id = auth.uid());

drop policy if exists courses_write on public.courses;
create policy courses_write on public.courses for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select
  using (user_id = auth.uid() or public.is_member(course_id));

drop policy if exists memberships_self on public.memberships;
create policy memberships_self on public.memberships for delete
  using (user_id = auth.uid());

-- A student sees their own layers always, and classmates' layers only once
-- those are explicitly shared.
drop policy if exists layers_read on public.layers;
create policy layers_read on public.layers for select
  using (user_id = auth.uid() or (shared and public.is_member(course_id)));

drop policy if exists layers_write on public.layers;
create policy layers_write on public.layers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists features_read on public.features;
create policy features_read on public.features for select
  using (exists (select 1 from layers l where l.id = layer_id
                 and (l.user_id = auth.uid() or (l.shared and public.is_member(l.course_id)))));

drop policy if exists features_write on public.features;
create policy features_write on public.features for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists fieldnotes_read on public.fieldnotes;
create policy fieldnotes_read on public.fieldnotes for select
  using (user_id = auth.uid());

drop policy if exists fieldnotes_write on public.fieldnotes;
create policy fieldnotes_write on public.fieldnotes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
