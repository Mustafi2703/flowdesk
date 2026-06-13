-- ============================================================
-- SCRUMFOLKS TMS — COMPLETE DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── PROFILES ─────────────────────────────────────────────────
create table if not exists profiles (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null check (role in ('owner','manager','team','hr','accountant','developer')),
  department    text,
  designation   text,
  avatar        text,
  is_active     boolean default true,
  leaves_total  integer default 21,
  leaves_taken  integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── BRANDS ───────────────────────────────────────────────────
create table if not exists brands (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  logo              text,
  description       text,
  client_type       text check (client_type in ('Retainer','Project-Based','One-Time','Internal')),
  priority          text check (priority in ('P1','P2','P3','P4')),
  short_term_goals  text[] default '{}',
  long_term_goals   text[] default '{}',
  responsibilities  text,
  assigned_members  uuid[] default '{}',
  created_by        uuid references profiles(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── TASKS ─────────────────────────────────────────────────────
create table if not exists tasks (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  description       text,
  brand_id          uuid references brands(id) on delete set null,
  assigned_to       uuid[] default '{}',
  assigned_managers uuid[] default '{}',
  created_by        uuid references profiles(id),
  type              text,
  task_mode         text default 'standard' check (task_mode in ('standard','project')),
  priority          text check (priority in ('Critical','High','Medium','Low')),
  status            text default 'Not Started' check (status in ('Not Started','In Progress','Under Review','Revision Needed','Completed','On Hold','Struggling','Needs Attention')),
  start_date        date,
  due_date          date,
  requires_review   boolean default false,
  is_billable       boolean default false,
  billable_amount   numeric(12,2),
  billed_at         timestamptz,
  checklist         jsonb default '[]',
  sub_tasks         jsonb default '[]',
  recurring_config  jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists task_chats (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid references tasks(id) on delete cascade,
  sender_id  uuid references profiles(id),
  message    text,
  type       text default 'text' check (type in ('text','voice')),
  voice_url  text,
  duration   integer,
  created_at timestamptz default now()
);

create table if not exists file_attachments (
  id               uuid primary key default uuid_generate_v4(),
  entity_type      text check (entity_type in ('task','brand')),
  entity_id        uuid,
  file_name        text,
  file_path        text,
  file_size        bigint,
  mime_type        text,
  auto_delete_days integer,
  delete_at        timestamptz,
  uploaded_by      uuid references profiles(id),
  created_at       timestamptz default now()
);

create table if not exists attendance_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id),
  date         date not null,
  login_time   time,
  logout_time  time,
  hours_worked numeric(5,2) default 0,
  notes        text,
  created_at   timestamptz default now(),
  unique(user_id, date)
);

create table if not exists leave_requests (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id),
  leave_type  text check (leave_type in ('Casual','Sick','Earned','Comp-Off','Other')),
  start_date  date,
  end_date    date,
  days        integer,
  reason      text,
  status      text default 'Pending' check (status in ('Pending','Approved','Rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz default now()
);

create table if not exists announcements (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  body       text,
  priority   text default 'Normal' check (priority in ('Normal','Important','Urgent')),
  created_by uuid references profiles(id),
  read_by    uuid[] default '{}',
  created_at timestamptz default now()
);

create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references profiles(id),
  message    text,
  type       text,
  is_read    boolean default false,
  link       text,
  created_at timestamptz default now()
);

create table if not exists daily_summaries (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references profiles(id),
  date             date not null,
  tasks_worked_on  uuid[] default '{}',
  total_hours      numeric(5,2),
  notes            text,
  created_at       timestamptz default now(),
  unique(user_id, date)
);

create table if not exists sop_documents (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  category   text,
  content    text,
  version    integer default 1,
  status     text default 'Draft',
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── INDEXES ──────────────────────────────────────────────────
create index if not exists idx_tasks_brand_id      on tasks(brand_id);
create index if not exists idx_tasks_status        on tasks(status);
create index if not exists idx_tasks_due_date      on tasks(due_date);
create index if not exists idx_task_chats_task_id  on task_chats(task_id);
create index if not exists idx_attendance_user_date on attendance_logs(user_id, date);
create index if not exists idx_leave_user_id       on leave_requests(user_id);
create index if not exists idx_notifications_user  on notifications(user_id, is_read);

-- ── RLS POLICIES (permissive — auth handled in API layer) ────
alter table profiles enable row level security;
alter table brands enable row level security;
alter table tasks enable row level security;
alter table task_chats enable row level security;
alter table attendance_logs enable row level security;
alter table leave_requests enable row level security;
alter table announcements enable row level security;
alter table notifications enable row level security;
alter table file_attachments enable row level security;
alter table daily_summaries enable row level security;
alter table sop_documents enable row level security;

create policy "all_profiles"        on profiles        for all using (true);
create policy "all_brands"          on brands          for all using (true);
create policy "all_tasks"           on tasks           for all using (true);
create policy "all_chats"           on task_chats      for all using (true);
create policy "all_attendance"      on attendance_logs for all using (true);
create policy "all_leave"           on leave_requests  for all using (true);
create policy "all_announcements"   on announcements   for all using (true);
create policy "all_notifications"   on notifications   for all using (true);
create policy "all_files"           on file_attachments for all using (true);
create policy "all_summaries"       on daily_summaries for all using (true);
create policy "all_sops"            on sop_documents   for all using (true);

-- ── SEED USERS — password for all is 'scrumfolks2026' ────────
-- The bcrypt hash below is for 'scrumfolks2026' (10 rounds)
insert into profiles (id, name, email, password_hash, role, department, designation, avatar) values
  ('11111111-0000-0000-0000-000000000001', 'Rushabh Shah',  'owner@scrumfolks.com',      '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'owner',      'Leadership',   'Director',                'RS'),
  ('11111111-0000-0000-0000-000000000002', 'Priya Mehta',   'manager@scrumfolks.com',    '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'manager',    'Creative',     'Creative Manager',        'PM'),
  ('11111111-0000-0000-0000-000000000003', 'Arjun Patel',   'team@scrumfolks.com',       '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'team',       'Design',       'Senior Designer',         'AP'),
  ('11111111-0000-0000-0000-000000000004', 'Neha Joshi',    'hr@scrumfolks.com',         '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'hr',         'HR',           'HR Manager',              'NJ'),
  ('11111111-0000-0000-0000-000000000005', 'Ravi Kumar',    'ravi@scrumfolks.com',       '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'team',       'Content',      'Content Writer',          'RK'),
  ('11111111-0000-0000-0000-000000000006', 'Sonal Shah',    'sonal@scrumfolks.com',      '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'team',       'Social Media', 'Social Media Executive',  'SS'),
  ('11111111-0000-0000-0000-000000000007', 'Kavita Rao',    'accountant@scrumfolks.com', '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'accountant', 'Finance',      'Accountant',              'KR'),
  ('11111111-0000-0000-0000-000000000008', 'Dev Sharma',    'dev@scrumfolks.com',        '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'developer',  'Technology',   'Full Stack Developer',    'DS'),
  ('11111111-0000-0000-0000-000000000009', 'Amit Verma',    'amit@scrumfolks.com',       '$2b$10$rBKXRRuERxD1ueMc/9BEI.jWt5SuwquyOKqPtSMk0jWR0mvNHBV.K', 'manager',    'Digital',      'Digital Manager',         'AV')
on conflict (email) do nothing;

-- ── SEED BRANDS ──────────────────────────────────────────────
insert into brands (id, name, logo, description, client_type, priority, short_term_goals, long_term_goals, responsibilities, assigned_members) values
  ('22222222-0000-0000-0000-000000000001', 'Dinamoo Lighting', 'DL', 'Premium architectural and commercial lighting pole manufacturer based in Raipur, Chhattisgarh.', 'Retainer',      'P1', ARRAY['Launch dealer portal','Complete 30 new product listings'],  ARRAY['Achieve 200 dealer network','Pan-India brand presence'], 'Social media, dealer content, brochures, photography, digital ads',     ARRAY['11111111-0000-0000-0000-000000000003'::uuid,'11111111-0000-0000-0000-000000000005'::uuid]),
  ('22222222-0000-0000-0000-000000000002', 'Ayodhya Group',    'AG', 'Real estate group — residential and commercial projects across Gujarat.',                           'Retainer',      'P1', ARRAY['Q3 lead generation campaign','New project launch content'],   ARRAY['13,500+ leads pipeline','350+ deal closures'],            'Lead gen, hoardings, social media, event management',                  ARRAY['11111111-0000-0000-0000-000000000003'::uuid,'11111111-0000-0000-0000-000000000006'::uuid]),
  ('22222222-0000-0000-0000-000000000003', 'SmartiQo',         'SQ', 'Smart home automation company based in Ahmedabad.',                                                 'Retainer',      'P2', ARRAY['Product launch campaign','Website revamp'],                   ARRAY['Market leadership in Gujarat smart home'],                'Digital marketing, product photography, B2B content, lead gen',        ARRAY['11111111-0000-0000-0000-000000000005'::uuid,'11111111-0000-0000-0000-000000000006'::uuid]),
  ('22222222-0000-0000-0000-000000000004', 'Minotti India',    'MI', 'Premium Italian furniture brand for the Indian luxury market.',                                     'Project-Based', 'P2', ARRAY['Instagram content calendar','Brand story reels'],             ARRAY['Premium brand positioning','10K Instagram followers'],   'Social media strategy, content creation, campaign management',         ARRAY['11111111-0000-0000-0000-000000000003'::uuid,'11111111-0000-0000-0000-000000000006'::uuid]),
  ('22222222-0000-0000-0000-000000000005', 'GESIA ICT',        'GE', 'Gujarat apex ICT industry association.',                                                            'Retainer',      'P3', ARRAY['GESIA Connect portal launch','Member newsletter'],            ARRAY['Digital-first member engagement'],                       'Web portal, event content, social media, member communications',       ARRAY['11111111-0000-0000-0000-000000000005'::uuid])
on conflict (id) do nothing;

-- ============================================================
-- DONE. Login at tasks.scrumfolks.com with password: scrumfolks2026
-- ============================================================
