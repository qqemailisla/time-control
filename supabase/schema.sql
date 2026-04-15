-- 学业时间管理应用 Supabase 数据库脚本
-- 执行位置：Supabase SQL Editor

create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  view text not null default 'tasks',
  show_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.tasks add column if not exists start_at timestamptz;
alter table public.tasks add column if not exists end_at timestamptz;

create table if not exists public.pomodoro_logs (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  work text not null,
  efficiency text not null default 'normal',
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_sec integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_user_created on public.projects (user_id, created_at desc);
create index if not exists idx_tasks_project_created on public.tasks (project_id, created_at desc);
create index if not exists idx_tasks_user_created on public.tasks (user_id, created_at desc);
create index if not exists idx_pomodoro_project_created on public.pomodoro_logs (project_id, created_at desc);
create index if not exists idx_pomodoro_user_created on public.pomodoro_logs (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.pomodoro_logs enable row level security;

-- projects policies
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
on public.projects
for select
using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects
for insert
with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
on public.projects
for delete
using (auth.uid() = user_id);

-- tasks policies
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks
for select
using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks
for delete
using (auth.uid() = user_id);

-- pomodoro_logs policies
drop policy if exists "pomodoro_select_own" on public.pomodoro_logs;
create policy "pomodoro_select_own"
on public.pomodoro_logs
for select
using (auth.uid() = user_id);

drop policy if exists "pomodoro_insert_own" on public.pomodoro_logs;
create policy "pomodoro_insert_own"
on public.pomodoro_logs
for insert
with check (auth.uid() = user_id);

drop policy if exists "pomodoro_update_own" on public.pomodoro_logs;
create policy "pomodoro_update_own"
on public.pomodoro_logs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "pomodoro_delete_own" on public.pomodoro_logs;
create policy "pomodoro_delete_own"
on public.pomodoro_logs
for delete
using (auth.uid() = user_id);
