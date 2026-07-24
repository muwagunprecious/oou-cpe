// backend/src/controllers/enrollments.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { supabase, supabaseAdmin } from '../lib/supabase.js';

/* ── GET /api/enrollments/my
   Student sees their enrolled courses with lecturer name, schedule, and active sessions. */
export const getMyEnrollments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.profile?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });


    const { data, error } = await supabase
      .from('course_enrollments')
      .select(`
        id,
        enrolled_at,
        course:courses!course_id(
          id, code, title, level, semester, session, credit_units,
          lecturer:users!lecturer_id(id, full_name, email, avatar_url, office),
          classes(
            id, day, start_time, end_time, venue, latitude, longitude, attendance_radius,
            location:locations(name, building),
            attendance_sessions(id, opens_at, closes_at, latitude, longitude, radius)
          )
        )
      `)
      .eq('student_id', userId)
      .order('enrolled_at');

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ── POST /api/enrollments
   Student enrolls in a course. Body: { course_id } */
export const enrollInCourse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.profile?.id;
    const { course_id } = req.body;
    if (!userId || !course_id) return res.status(400).json({ error: 'Missing course_id' });

    const { data, error } = await supabase
      .from('course_enrollments')
      .insert({ student_id: userId, course_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Already enrolled' });
      throw error;
    }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ── DELETE /api/enrollments/:courseId
   Student drops a course. */
export const dropCourse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.profile?.id;
    const { courseId } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });

    const { error } = await supabase
      .from('course_enrollments')
      .delete()
      .eq('student_id', userId)
      .eq('course_id', courseId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
