-- ============================================================
-- CPE Smart Portal — Migration v2
-- Run this in Supabase SQL Editor (do NOT re-run schema.sql)
-- ============================================================

-- 1. course_enrollments: tracks which students picked which courses
create table if not exists public.course_enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references public.users(id) on delete cascade not null,
  course_id   uuid references public.courses(id) on delete cascade not null,
  enrolled_at timestamptz default now(),
  unique (student_id, course_id)
);

alter table public.course_enrollments enable row level security;

create policy "enrollments_student_all"
  on public.course_enrollments for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy "enrollments_lecturer_select"
  on public.course_enrollments for select
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_enrollments.course_id
        and c.lecturer_id = auth.uid()
    )
  );

create policy "enrollments_admin_all"
  on public.course_enrollments for all
  using (public.is_admin());

-- 2. Shrink default attendance radius to 10 m
alter table public.attendance_sessions
  alter column radius set default 10.0;

alter table public.classes
  alter column attendance_radius set default 10.0;

-- 3. Add manual-override columns to attendance_records
alter table public.attendance_records
  add column if not exists manually_added boolean default false;

alter table public.attendance_records
  add column if not exists added_by uuid references public.users(id) on delete set null;

-- 4. Let lecturers INSERT records for their courses (manual override)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'attendance_records'
      and policyname = 'attendance_records_lecturer_insert'
  ) then
    create policy "attendance_records_lecturer_insert"
      on public.attendance_records for insert
      with check (
        exists (
          select 1 from public.attendance_sessions s
          join public.classes cl on cl.id = s.class_id
          join public.courses co on co.id = cl.course_id
          where s.id = attendance_records.session_id
            and co.lecturer_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'attendance_records'
      and policyname = 'attendance_records_lecturer_update'
  ) then
    create policy "attendance_records_lecturer_update"
      on public.attendance_records for update
      using (
        exists (
          select 1 from public.attendance_sessions s
          join public.classes cl on cl.id = s.class_id
          join public.courses co on co.id = cl.course_id
          where s.id = attendance_records.session_id
            and co.lecturer_id = auth.uid()
        )
      );
  end if;
end $$;

-- 5. Add credit_units column to courses (optional but useful)
alter table public.courses
  add column if not exists credit_units integer default 3;

-- 6. Allow admin to update courses (assign lecturer etc.)
-- (policy courses_admin_all already covers this via is_admin())
-- Ensure lecturers can also read their enrollment counts via courses
-- (courses_select_all already allows this)

-- 7. Add marked_at column to attendance_records for manual override tracking
alter table public.attendance_records
  add column if not exists marked_at timestamptz default now();

-- 8. unique constraint for upsert (session_id, student_id)
-- Only add if it doesn't exist
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_records_session_id_student_id_key'
  ) then
    alter table public.attendance_records
      add constraint attendance_records_session_id_student_id_key
      unique (session_id, student_id);
  end if;
end $$;
