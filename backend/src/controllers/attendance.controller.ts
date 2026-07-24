import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { supabase, supabaseAdmin } from "../lib/supabase.js";

// Haversine distance calculator in meters
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function markAttendance(req: AuthenticatedRequest, res: Response) {
  const studentId = req.profile?.id;
  const { sessionId, latitude, longitude } = req.body;

  if (!sessionId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "Missing sessionId, latitude, or longitude" });
  }

  try {
    // 1. Fetch session with class + course details
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("attendance_sessions")
      .select(`
        id, opens_at, closes_at, is_test, radius, latitude, longitude,
        classes (
          id, attendance_radius, course_id,
          courses ( id, code, level ),
          locations ( name, latitude, longitude )
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: "Attendance session not found" });
    }

    const s = session as any;
    const courseId = s.classes?.course_id;

    // 2. Check student is enrolled in this course
    const { data: enrollment } = await supabaseAdmin
      .from("course_enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!enrollment) {
      return res.status(403).json({ error: "You are not enrolled in this course." });
    }

    // 3. Time window check
    const now = new Date();
    const opensAt = new Date(s.opens_at);
    const closesAt = new Date(s.closes_at);

    if (now < opensAt) return res.status(400).json({ error: "Attendance session is not open yet" });
    if (now > closesAt) return res.status(400).json({ error: "Attendance session has closed" });

    // 4. Already marked?
    const { data: existing } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: "Attendance already marked for this session" });
    }

    // 5. GPS Geofencing — 10 m default radius
    let targetLat = s.latitude ?? s.classes?.locations?.latitude;
    let targetLon = s.longitude ?? s.classes?.locations?.longitude;
    let targetRadius = s.radius ?? s.classes?.attendance_radius ?? 10;

    if (targetLat == null || targetLon == null) {
      return res.status(500).json({ error: "Class location coordinates are not configured" });
    }

    const distance = getHaversineDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(targetLat),
      parseFloat(targetLon)
    );

    if (distance > targetRadius) {
      return res.status(400).json({
        error: `You are ${Math.round(distance)}m away from the classroom. Must be within ${targetRadius}m.`,
        distance: Math.round(distance),
        allowedRadius: targetRadius,
      });
    }

    // 6. Insert record
    const { data: record, error: insertError } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        session_id: sessionId,
        student_id: studentId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: "present",
        manually_added: false,
      })
      .select()
      .single();

    if (insertError) return res.status(500).json({ error: insertError.message });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: studentId,
      action: "mark_attendance",
      details: { session_id: sessionId, distance: Math.round(distance) },
    });

    return res.status(200).json({ message: "Attendance marked successfully", record, distance: Math.round(distance) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to mark attendance" });
  }
}

/* ── POST /api/attendance/manual
   Lecturer manually marks a specific student present in an active session. */
export async function manualMarkAttendance(req: AuthenticatedRequest, res: Response) {
  const lecturerId = req.profile?.id;
  const { sessionId, studentId, status = "present" } = req.body;

  if (!sessionId || !studentId) {
    return res.status(400).json({ error: "Missing sessionId or studentId" });
  }

  try {
    const { data: session } = await supabaseAdmin
      .from("attendance_sessions")
      .select("id, classes(course_id, courses(lecturer_id))")
      .eq("id", sessionId)
      .single();

    if (!session) return res.status(404).json({ error: "Session not found" });

    const ownerLecturerId = (session as any).classes?.courses?.lecturer_id;
    if (ownerLecturerId !== lecturerId) {
      return res.status(403).json({ error: "You do not own this course" });
    }

    const { data: record, error } = await supabaseAdmin
      .from("attendance_records")
      .upsert(
        {
          session_id: sessionId,
          student_id: studentId,
          status,
          manually_added: true,
          added_by: lecturerId,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "session_id,student_id" }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: lecturerId,
      action: "manual_mark_attendance",
      details: { session_id: sessionId, student_id: studentId, status },
    });

    return res.status(200).json({ message: "Attendance manually recorded", record });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/* ── POST /api/attendance/activate
   Lecturer activates an attendance session for a class slot. */
export async function activateSession(req: AuthenticatedRequest, res: Response) {
  const lecturerId = req.profile?.id;
  const { classId, latitude, longitude, durationMinutes = 60 } = req.body;

  if (!classId) return res.status(400).json({ error: "Missing classId" });

  try {
    const { data: classRow } = await supabaseAdmin
      .from("classes")
      .select("id, course_id, courses(lecturer_id), attendance_radius")
      .eq("id", classId)
      .single();

    if (!classRow) return res.status(404).json({ error: "Class not found" });
    if ((classRow as any).courses?.lecturer_id !== lecturerId) {
      return res.status(403).json({ error: "You do not own this class" });
    }

    const opens_at = new Date();
    const closes_at = new Date(opens_at.getTime() + durationMinutes * 60 * 1000);

    const { data: session, error } = await supabaseAdmin
      .from("attendance_sessions")
      .insert({
        class_id: classId,
        opens_at: opens_at.toISOString(),
        closes_at: closes_at.toISOString(),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        radius: (classRow as any).attendance_radius ?? 10,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ message: "Session activated", session });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getLiveAttendance(req: AuthenticatedRequest, res: Response) {
  const { sessionId } = req.params;

  try {
    const { data: session, error: sessionErr } = await supabase
      .from("attendance_sessions")
      .select("id, class_id, classes(course_id, courses(level, title, code))")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const sessionData = session as any;
    const courseId = sessionData.classes?.course_id;

    const { data: present, error: presentError } = await supabase
      .from("attendance_records")
      .select("id, marked_at, status, manually_added, student_id, users(full_name, email, matric_number, avatar_url)")
      .eq("session_id", sessionId);

    if (presentError) return res.status(500).json({ error: presentError.message });

    const { data: enrolled, error: enrolledError } = await supabaseAdmin
      .from("course_enrollments")
      .select("student_id, users!student_id(id, full_name, email, matric_number, avatar_url)")
      .eq("course_id", courseId);

    if (enrolledError) return res.status(500).json({ error: enrolledError.message });

    const presentIds = new Set((present || []).map((p: any) => p.student_id));
    const absent = (enrolled || [])
      .map((e: any) => e.users)
      .filter((u: any) => u && !presentIds.has(u.id));

    return res.status(200).json({
      presentCount: present?.length ?? 0,
      absentCount: absent.length,
      present: present || [],
      absent,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch live attendance" });
  }
}
