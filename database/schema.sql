-- database/schema.sql
-- CPE Smart Academic Portal Database Initialization Schema

-- Cleanup existing triggers and tables
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists public.audit_logs cascade;
drop table if exists public.system_settings cascade;
drop table if exists public.faqs cascade;
drop table if exists public.complaints cascade;
drop table if exists public.announcements cascade;
drop table if exists public.assignment_submissions cascade;
drop table if exists public.assignments cascade;
drop table if exists public.attendance_records cascade;
drop table if exists public.attendance_sessions cascade;
drop table if exists public.classes cascade;
drop table if exists public.locations cascade;
drop table if exists public.courses cascade;
drop table if exists public.users cascade;

-- 1. Users table (linked to auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('student', 'lecturer', 'admin')) default 'student',
  status text not null check (status in ('pending_approval', 'active', 'banned')) default 'active',
  level text check (level in ('100', '200', '300', '400', '500')),
  department text default 'Computer Engineering',
  phone text,
  matric_number text unique,
  staff_id text unique,
  office text,
  academic_adviser text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Enable RLS for users
alter table public.users enable row level security;

-- Helper functions to check roles (security definer to avoid RLS recursion)
create or replace function public.is_admin()
returns boolean security definer as $$
begin
  return exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql;

create or replace function public.is_lecturer()
returns boolean security definer as $$
begin
  return exists (
    select 1 from public.users where id = auth.uid() and role = 'lecturer'
  );
end;
$$ language plpgsql;

-- Policies for users
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_select_all" on public.users for select using (true); -- let everyone see lecturers/students for complaints & lookups
create policy "users_insert_self" on public.users for insert with check (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "users_admin_all" on public.users for all using (public.is_admin());

-- 2. Locations table
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  building text,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz default now()
);

alter table public.locations enable row level security;
create policy "locations_select_all" on public.locations for select using (true);
create policy "locations_admin_all" on public.locations for all using (public.is_admin());

-- 3. Courses table
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  level text not null check (level in ('100', '200', '300', '400', '500')),
  lecturer_id uuid references public.users(id) on delete set null,
  semester integer check (semester in (1, 2)) default 1,
  session text default '2025/2026',
  created_at timestamptz default now()
);

alter table public.courses enable row level security;
create policy "courses_select_all" on public.courses for select using (true);
create policy "courses_lecturer_update" on public.courses for update using (auth.uid() = lecturer_id);
create policy "courses_admin_all" on public.courses for all using (public.is_admin());

-- 4. Classes table (Weekly slots)
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  day text not null check (day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time text not null, -- format "HH:MM"
  end_time text not null, -- format "HH:MM"
  location_id uuid references public.locations(id) on delete set null,
  venue text, -- custom venue override
  building text,
  latitude double precision,
  longitude double precision,
  attendance_radius double precision default 50.0, -- in meters
  created_at timestamptz default now()
);

alter table public.classes enable row level security;
create policy "classes_select_all" on public.classes for select using (true);
create policy "classes_lecturer_all" on public.classes for all using (
  exists (
    select 1 from public.courses c
    where c.id = classes.course_id and c.lecturer_id = auth.uid()
  )
);
create policy "classes_admin_all" on public.classes for all using (public.is_admin());

-- 5. Attendance Sessions (Instance created by lecturer to unlock check-in)
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  is_test boolean default false,
  latitude double precision, -- override coordinate
  longitude double precision, -- override coordinate
  radius double precision default 50.0,
  created_at timestamptz default now()
);

alter table public.attendance_sessions enable row level security;
create policy "attendance_sessions_select_all" on public.attendance_sessions for select using (true);
create policy "attendance_sessions_lecturer_all" on public.attendance_sessions for all using (
  exists (
    select 1 from public.classes cl
    join public.courses co on co.id = cl.course_id
    where cl.id = attendance_sessions.class_id and co.lecturer_id = auth.uid()
  )
);
create policy "attendance_sessions_admin_all" on public.attendance_sessions for all using (public.is_admin());

-- 6. Attendance Records
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.attendance_sessions(id) on delete cascade not null,
  student_id uuid references public.users(id) on delete cascade not null,
  marked_at timestamptz default now(),
  latitude double precision,
  longitude double precision,
  status text check (status in ('present', 'absent', 'late')) default 'present',
  unique (session_id, student_id)
);

alter table public.attendance_records enable row level security;
create policy "attendance_records_student_insert" on public.attendance_records for insert with check (auth.uid() = student_id);
create policy "attendance_records_student_select" on public.attendance_records for select using (auth.uid() = student_id);
create policy "attendance_records_lecturer_select" on public.attendance_records for select using (
  exists (
    select 1 from public.attendance_sessions s
    join public.classes cl on cl.id = s.class_id
    join public.courses co on co.id = cl.course_id
    where s.id = attendance_records.session_id and co.lecturer_id = auth.uid()
  )
);
create policy "attendance_records_admin_all" on public.attendance_records for all using (public.is_admin());

-- 7. Assignments
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  description text,
  deadline timestamptz not null,
  marks integer default 100,
  file_url text, -- optional attachment
  created_at timestamptz default now()
);

alter table public.assignments enable row level security;
create policy "assignments_select_all" on public.assignments for select using (true);
create policy "assignments_lecturer_all" on public.assignments for all using (
  exists (
    select 1 from public.courses c
    where c.id = assignments.course_id and c.lecturer_id = auth.uid()
  )
);
create policy "assignments_admin_all" on public.assignments for all using (public.is_admin());

-- 8. Assignment Submissions
create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade not null,
  student_id uuid references public.users(id) on delete cascade not null,
  file_url text not null,
  file_name text not null,
  submitted_at timestamptz default now(),
  grade numeric,
  feedback text,
  status text check (status in ('submitted', 'pending_review', 'graded', 'late')) default 'submitted',
  unique (assignment_id, student_id)
);

alter table public.assignment_submissions enable row level security;
create policy "submissions_student_insert" on public.assignment_submissions for insert with check (auth.uid() = student_id);
create policy "submissions_student_select" on public.assignment_submissions for select using (auth.uid() = student_id);
create policy "submissions_lecturer_select_update" on public.assignment_submissions for all using (
  exists (
    select 1 from public.assignments a
    join public.courses c on c.id = a.course_id
    where a.id = assignment_submissions.assignment_id and c.lecturer_id = auth.uid()
  )
);
create policy "submissions_admin_all" on public.assignment_submissions for all using (public.is_admin());

-- 9. Announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text check (type in ('announcement', 'news', 'insight')) default 'announcement',
  image_url text,
  target_role text check (target_role in ('everyone', 'student', 'lecturer')) default 'everyone',
  target_level text, -- e.g. "200" level only
  target_course_id uuid references public.courses(id) on delete cascade,
  scheduled_for timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;
create policy "announcements_select_all" on public.announcements for select using (true);
create policy "announcements_lecturer_all" on public.announcements for all using (
  public.is_lecturer() or public.is_admin()
);
create policy "announcements_admin_all" on public.announcements for all using (public.is_admin());

-- 10. Complaints
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.users(id) on delete cascade not null,
  lecturer_id uuid references public.users(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  category text check (category in ('academic', 'attendance', 'result', 'assignment', 'facilities', 'laboratory', 'lecturer', 'portal_issue', 'other')) not null,
  subject text not null,
  message text not null,
  attachment_url text,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  status text check (status in ('open', 'resolved')) default 'open',
  reply text,
  replied_at timestamptz,
  created_at timestamptz default now()
);

alter table public.complaints enable row level security;
create policy "complaints_student_all" on public.complaints for all using (auth.uid() = student_id);
create policy "complaints_lecturer_select" on public.complaints for select using (auth.uid() = lecturer_id);
create policy "complaints_lecturer_update" on public.complaints for update using (auth.uid() = lecturer_id);
create policy "complaints_admin_all" on public.complaints for all using (public.is_admin());

-- 11. FAQs
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  created_at timestamptz default now()
);

alter table public.faqs enable row level security;
create policy "faqs_select_all" on public.faqs for select using (true);
create policy "faqs_admin_all" on public.faqs for all using (public.is_admin());

-- 12. System Settings
create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table public.system_settings enable row level security;
create policy "settings_select_all" on public.system_settings for select using (true);
create policy "settings_admin_all" on public.system_settings for all using (public.is_admin());

-- 13. Audit Logs
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;
create policy "audit_logs_admin_all" on public.audit_logs for all using (public.is_admin());

-- Trigger Function for creating user in public.users automatically upon Auth Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, full_name, email, role, status, level, department, phone, matric_number, staff_id, office, academic_adviser)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    case 
      when coalesce(new.raw_user_meta_data->>'role', 'student') = 'lecturer' then 'pending_approval'
      else 'active'
    end,
    new.raw_user_meta_data->>'level',
    coalesce(new.raw_user_meta_data->>'department', 'Computer Engineering'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'matric_number',
    new.raw_user_meta_data->>'staff_id',
    new.raw_user_meta_data->>'office',
    new.raw_user_meta_data->>'academic_adviser'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Connect Auth trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- --- SEED DATA -------------------------------------------------------------

-- Seed Locations (Engineering Buildings / Labs)
insert into public.locations (name, building, latitude, longitude) values
('Engr. Lecture Hall 1', 'Faculty of Engineering Building', 6.90385, 3.92981),
('Engr. Lecture Hall 2', 'Faculty of Engineering Building', 6.90390, 3.92985),
('CPE Lab A', 'Computer Engineering Block', 6.90375, 3.92975),
('CPE Lab B', 'Computer Engineering Block', 6.90370, 3.92970);

-- Seed Core Courses for Computer Engineering
insert into public.courses (code, title, level, semester, session) values
('CPE 201', 'Circuit Theory I', '200', 1, '2025/2026'),
('CPE 203', 'Introduction to Computer Engineering', '200', 1, '2025/2026'),
('CPE 205', 'Digital Systems', '200', 1, '2025/2026'),
('MEE 201', 'Engineering Mechanics', '200', 1, '2025/2026'),
('MAT 201', 'Mathematical Methods I', '200', 1, '2025/2026'),
('CPE 301', 'Digital Logic Design', '300', 1, '2025/2026'),
('CPE 401', 'Embedded Systems', '400', 1, '2025/2026'),
('CPE 501', 'Advanced Computer Architecture', '500', 1, '2025/2026');

-- Seed FAQs for AI knowledge RAG
insert into public.faqs (question, answer, category) values
('Who teaches CPE 201?', 'CPE 201 (Circuit Theory I) is taught by Dr. Adeyemi.', 'Academics'),
('Where is the Computer Engineering Department library?', 'The CPE department library is located on the first floor of the Engineering Building, Room 104.', 'Facilities'),
('What is the passing grade for Engineering courses?', 'The passing grade for all core engineering courses (CPE) in OOU is 40% (E grade). A minimum CGPA of 1.5 is required to stay in good academic standing.', 'Academics'),
('How can I contact my level adviser?', 'You can find your level adviser''s name on your Profile page. You can contact them during their office hours or book a consultation through their profile details on the portal.', 'Support'),
('What is the attendance policy?', 'Students are expected to maintain at least 75% attendance in all lectures to be eligible for examination.', 'Attendance'),
('How does GPS attendance check-in work?', 'When a lecturer starts an attendance session, click the "Mark Attendance" button on your dashboard. Ensure your device GPS is turned on and that you are inside the classroom (within 50-100 meters of the class location).', 'Attendance');

-- Seed initial settings
insert into public.system_settings (key, value) values
('default_attendance_radius_meters', '50'),
('allow_student_self_registration', 'true'),
('academic_calendar', '{"semester": 1, "session": "2025/2026", "exam_start_date": "2026-09-14"}');
