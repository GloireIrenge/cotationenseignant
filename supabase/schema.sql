create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  post_name text not null,
  last_name text not null,
  academic_grade text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  title text not null,
  domain text not null,
  promotion text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text not null,
  share_token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.criteria (
  id uuid primary key,
  label text not null unique,
  position smallint not null unique check (position > 0)
);

insert into public.criteria (id, label, position) values
  ('00000000-0000-4000-8000-000000000001', 'Régularité', 1),
  ('00000000-0000-4000-8000-000000000002', 'Respect de la charge horaire', 2),
  ('00000000-0000-4000-8000-000000000003', 'Présentation du contenu et des objectifs du cours', 3),
  ('00000000-0000-4000-8000-000000000004', 'Maîtrise et communication de la matière', 4),
  ('00000000-0000-4000-8000-000000000005', 'Maîtrise de la langue française', 5),
  ('00000000-0000-4000-8000-000000000006', 'Communication de la bibliographie du cours', 6),
  ('00000000-0000-4000-8000-000000000007', 'Utilisation des TIC (outils informatiques)', 7),
  ('00000000-0000-4000-8000-000000000008', 'Organisation des interrogations', 8),
  ('00000000-0000-4000-8000-000000000009', 'Syllabus du cours livré à temps', 9),
  ('00000000-0000-4000-8000-000000000010', 'Sens de responsabilité', 10),
  ('00000000-0000-4000-8000-000000000011', 'Interaction et participation des étudiants', 11)
on conflict (id) do nothing;

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  respondent_id uuid not null,
  created_at timestamptz not null default now(),
  unique (evaluation_id, respondent_id)
);

create table if not exists public.ratings (
  response_id uuid not null references public.responses (id) on delete cascade,
  criterion_id uuid not null references public.criteria (id) on delete restrict,
  value smallint not null check (value between 0 and 10),
  primary key (response_id, criterion_id)
);

create index if not exists courses_teacher_id_idx on public.courses (teacher_id);
create index if not exists evaluations_course_id_idx on public.evaluations (course_id);
create index if not exists responses_evaluation_id_idx on public.responses (evaluation_id);
create index if not exists ratings_criterion_id_idx on public.ratings (criterion_id);

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.teachers, public.courses, public.evaluations to authenticated;
grant select on public.criteria, public.responses, public.ratings to authenticated;
revoke all on public.profiles, public.teachers, public.courses, public.evaluations,
  public.criteria, public.responses, public.ratings from anon;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.evaluations enable row level security;
alter table public.criteria enable row level security;
alter table public.responses enable row level security;
alter table public.ratings enable row level security;

drop policy if exists "Profiles are visible to their owner or admins" on public.profiles;
create policy "Profiles are visible to their owner or admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "Admins manage teachers" on public.teachers;
create policy "Admins manage teachers"
  on public.teachers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage courses" on public.courses;
create policy "Admins manage courses"
  on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage evaluations" on public.evaluations;
create policy "Admins manage evaluations"
  on public.evaluations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read criteria" on public.criteria;
create policy "Admins read criteria"
  on public.criteria for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins read responses" on public.responses;
create policy "Admins read responses"
  on public.responses for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins read ratings" on public.ratings;
create policy "Admins read ratings"
  on public.ratings for select to authenticated
  using (public.is_admin());

create or replace function public.get_public_evaluation(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'course', jsonb_build_object(
      'title', c.title,
      'domain', c.domain,
      'promotion', c.promotion
    ),
    'teacher', jsonb_build_object(
      'name', concat_ws(' ', t.first_name, t.post_name, t.last_name),
      'academic_grade', t.academic_grade
    ),
    'criteria', (
      select jsonb_agg(jsonb_build_object('id', cr.id, 'label', cr.label) order by cr.position)
      from public.criteria cr
    )
  )
  from public.evaluations e
  join public.courses c on c.id = e.course_id
  join public.teachers t on t.id = c.teacher_id
  where e.share_token = p_token and e.is_active = true;
$$;

create or replace function public.submit_public_evaluation(
  p_token uuid,
  p_respondent_id uuid,
  p_ratings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evaluation_id uuid;
  v_response_id uuid;
  v_item jsonb;
  v_expected_count integer;
begin
  select id into v_evaluation_id
  from public.evaluations
  where share_token = p_token and is_active = true;

  if v_evaluation_id is null then
    return jsonb_build_object('ok', false, 'error', 'Cette évaluation est fermée ou indisponible.');
  end if;

  select count(*) into v_expected_count from public.criteria;
  if jsonb_typeof(p_ratings) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'Veuillez noter chacun des critères.');
  end if;

  if jsonb_array_length(p_ratings) <> v_expected_count then
    return jsonb_build_object('ok', false, 'error', 'Veuillez noter chacun des critères.');
  end if;

  for v_item in select value from jsonb_array_elements(p_ratings)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item -> 'criterion_id') is distinct from 'string'
      or (v_item ->> 'criterion_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(v_item -> 'value') is distinct from 'number'
      or (v_item ->> 'value') !~ '^(0|[1-9]|10)$' then
      return jsonb_build_object('ok', false, 'error', 'Une ou plusieurs notes sont invalides.');
    end if;

    if not exists (
      select 1 from public.criteria cr where cr.id = (v_item ->> 'criterion_id')::uuid
    ) then
      return jsonb_build_object('ok', false, 'error', 'Une ou plusieurs notes sont invalides.');
    end if;
  end loop;

  if (
    select count(distinct (item ->> 'criterion_id')::uuid)
    from jsonb_array_elements(p_ratings) item
  ) <> v_expected_count then
    return jsonb_build_object('ok', false, 'error', 'Chaque critère doit être noté une seule fois.');
  end if;

  insert into public.responses (evaluation_id, respondent_id)
  values (v_evaluation_id, p_respondent_id)
  on conflict (evaluation_id, respondent_id) do nothing
  returning id into v_response_id;

  if v_response_id is null then
    return jsonb_build_object('ok', false, 'error', 'Une réponse a déjà été enregistrée depuis ce navigateur.');
  end if;

  for v_item in select value from jsonb_array_elements(p_ratings)
  loop
    insert into public.ratings (response_id, criterion_id, value)
    values (v_response_id, (v_item ->> 'criterion_id')::uuid, (v_item ->> 'value')::smallint);
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_public_evaluation(uuid) from public;
revoke all on function public.submit_public_evaluation(uuid, uuid, jsonb) from public;
grant execute on function public.get_public_evaluation(uuid) to anon, authenticated;
grant execute on function public.submit_public_evaluation(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- Après avoir créé un utilisateur dans Supabase Auth, attribuez-lui le rôle admin :
-- update public.profiles set role = 'admin' where id = 'UUID_DE_L_UTILISATEUR';
