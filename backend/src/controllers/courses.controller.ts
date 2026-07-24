// backend/src/controllers/courses.controller.ts
import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

/* ── GET /api/courses
   Returns all courses, joined with lecturer name and timetable slots.
   Admin & lecturers see everything; students see courses for their level. */
export const getAllCourses = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        lecturer:users!lecturer_id(id, full_name, email, avatar_url),
        classes(id, day, start_time, end_time, venue, latitude, longitude, attendance_radius,
          location:locations(name, building))
      `)
      .order('level', { ascending: true })
      .order('code', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ── GET /api/courses/my
   For lecturers: only courses where lecturer_id = current user.
   Includes enrolled student count. */
export const getMyCourses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });

    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        classes(id, day, start_time, end_time, venue, latitude, longitude, attendance_radius,
          location:locations(name, building)),
        course_enrollments(count)
      `)
      .eq('lecturer_id', userId)
      .order('code');

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ── GET /api/courses/:id/enrollments
   Lecturer sees all students enrolled in a specific course. */
export const getCourseEnrollments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('course_enrollments')
      .select(`
        id,
        enrolled_at,
        student:users!student_id(id, full_name, email, matric_number, level, avatar_url)
      `)
      .eq('course_id', id)
      .order('enrolled_at');

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ── POST /api/courses  (admin only)
   Create a new course. */
export const createCourse = async (req: Request, res: Response) => {
  try {
    const { code, title, level, semester, session, lecturer_id, credit_units } = req.body;
    const { data, error } = await supabase
      .from('courses')
      .insert({ code, title, level, semester, session, lecturer_id, credit_units })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ── PATCH /api/courses/:id  (admin only)
   Update course details (e.g. assign/reassign lecturer). */
export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('courses')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ── POST /api/courses/:id/timetable  (admin & lecturer)
   Add a timetable slot (class row) for a course. */
export const addTimetableSlot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { day, start_time, end_time, location_id, venue, latitude, longitude, attendance_radius } = req.body;
    const authReq = req as any;
    const userRole = authReq.profile?.role;
    const userId = authReq.profile?.id;

    if (userRole === 'lecturer') {
      const { data: course, error: cErr } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', id)
        .single();
      if (cErr || !course || course.lecturer_id !== userId) {
        return res.status(403).json({ error: 'You are not authorised to modify this course schedule.' });
      }
    }

    const { data, error } = await supabase
      .from('classes')
      .insert({
        course_id: id,
        day,
        start_time,
        end_time,
        location_id: location_id || null,
        venue: venue || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        attendance_radius: attendance_radius ?? 10,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ── DELETE /api/courses/:id/timetable/:slotId  (admin & lecturer) */
export const removeTimetableSlot = async (req: Request, res: Response) => {
  try {
    const { slotId } = req.params;
    const authReq = req as any;
    const userRole = authReq.profile?.role;
    const userId = authReq.profile?.id;

    if (userRole === 'lecturer') {
      const { data: slot, error: sErr } = await supabase
        .from('classes')
        .select('course_id, courses!course_id(lecturer_id)')
        .eq('id', slotId)
        .single();
      const lecturerId = (slot as any)?.courses?.lecturer_id;
      if (sErr || !slot || lecturerId !== userId) {
        return res.status(403).json({ error: 'You are not authorised to modify this course schedule.' });
      }
    }

    const { error } = await supabase.from('classes').delete().eq('id', slotId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

