-- ============================================================
-- CPE Smart Portal — Migration v3
-- Attendance lock/unlock + 5m geofence enforcement
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add is_locked column to attendance_sessions (locked = students cannot mark)
alter table public.attendance_sessions
  add column if not exists is_locked boolean default false;

-- 2. Shrink default radius to 5 metres for stricter geofencing
alter table public.attendance_sessions
  alter column radius set default 5.0;

alter table public.classes
  alter column attendance_radius set default 5.0;

-- 3. Allow admin to toggle lock status via UPDATE
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'attendance_sessions'
      and policyname = 'attendance_sessions_admin_update'
  ) then
    create policy "attendance_sessions_admin_update"
      on public.attendance_sessions for update
      using (public.is_admin());
  end if;
end $$;
