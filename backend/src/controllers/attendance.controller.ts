import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { supabase, supabaseAdmin } from "../lib/supabase.js";

const DEFAULT_RADIUS = 5;

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
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("attendance_sessions")
      .select(`
        id, opens_at, closes_at, is_test, is_locked, radius, latitude, longitude,
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

    const { data: enrollment } = await supabaseAdmin
      .from("course_enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!enrollment) {
      return res.status(403).json({ error: "You are not enrolled in this course." });
    }

    const now = new Date();
    const opensAt = new Date(s.opens_at);
    const closesAt = new Date(s.closes_at);

    if (now < opensAt) return res.status(400).json({ error: "Attendance session is not open yet" });
    if (now > closesAt) return res.status(400).json({ error: "Attendance session has closed" });

    if (s.is_locked) {
      return res.status(403).json({ error: "Attendance is currently locked by the admin. Please wait for it to be unlocked." });
    }

    const { data: existing } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: "Attendance already marked for this session" });
    }

    let targetLat = s.latitude ?? s.classes?.locations?.latitude;
    let targetLon = s.longitude ?? s.classes?.locations?.longitude;
    let targetRadius = s.radius ?? s.classes?.attendance_radius ?? DEFAULT_RADIUS;

    if (targetLat == null || targetLon == null) {
      return res.status(500).json({ error: "Class location coordinates are not configured" });
    }

    const studentLat = parseFloat(latitude);
    const studentLon = parseFloat(longitude);
    const distance = getHaversineDistance(studentLat, studentLon, parseFloat(targetLat), parseFloat(targetLon));

    if (distance > targetRadius) {
      return res.status(400).json({
        error: `You are ${Math.round(distance)}m away from the lecture location. Must be within ${Math.round(targetRadius)}m.`,
        distance: Math.round(distance),
        allowedRadius: Math.round(targetRadius),
        studentLatitude: studentLat,
        studentLongitude: studentLon,
        lecturerLatitude: parseFloat(targetLat),
        lecturerLongitude: parseFloat(targetLon),
      });
    }

    const { data: record, error: insertError } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        session_id: sessionId,
        student_id: studentId,
        latitude: studentLat,
        longitude: studentLon,
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

export async function manualMarkAttendance(req: AuthenticatedRequest, res: Response) {
  const userId = req.profile?.id;
  const userRole = req.profile?.role;
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
    if (userRole !== "admin" && ownerLecturerId !== userId) {
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
          added_by: userId,
          marked_at: new Date().toISOString(),
        },
        { onConflict: "session_id,student_id" }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "manual_mark_attendance",
      details: { session_id: sessionId, student_id: studentId, status },
    });

    return res.status(200).json({ message: "Attendance manually recorded", record });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function activateSession(req: AuthenticatedRequest, res: Response) {
  const userId = req.profile?.id;
  const userRole = req.profile?.role;
  const { classId, latitude, longitude, durationMinutes = 60 } = req.body;

  if (!classId) return res.status(400).json({ error: "Missing classId" });

  try {
    const { data: classRow } = await supabaseAdmin
      .from("classes")
      .select("id, course_id, courses(lecturer_id), attendance_radius")
      .eq("id", classId)
      .single();

    if (!classRow) return res.status(404).json({ error: "Class not found" });

    if (userRole !== "admin" && (classRow as any).courses?.lecturer_id !== userId) {
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
        radius: DEFAULT_RADIUS,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ message: "Session activated", session });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function toggleSessionLock(req: AuthenticatedRequest, res: Response) {
  const userRole = req.profile?.role;
  const { sessionId } = req.body;

  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Only admin can lock/unlock attendance" });
  }

  try {
    const { data: session, error: fetchErr } = await supabaseAdmin
      .from("attendance_sessions")
      .select("id, is_locked")
      .eq("id", sessionId)
      .single();

    if (fetchErr || !session) return res.status(404).json({ error: "Session not found" });

    const newLocked = !(session as any).is_locked;

    const { error: updateErr } = await supabaseAdmin
      .from("attendance_sessions")
      .update({ is_locked: newLocked })
      .eq("id", sessionId);

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: req.profile?.id,
      action: newLocked ? "lock_attendance" : "unlock_attendance",
      details: { session_id: sessionId },
    });

    return res.status(200).json({ message: newLocked ? "Attendance locked" : "Attendance unlocked", is_locked: newLocked });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to toggle lock" });
  }
}

export async function getLiveAttendance(req: AuthenticatedRequest, res: Response) {
  const { sessionId } = req.params;

  try {
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("attendance_sessions")
      .select("id, class_id, opens_at, closes_at, is_locked, latitude, longitude, radius, classes(course_id, courses(level, title, code))")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const sessionData = session as any;
    const courseId = sessionData.classes?.course_id;

    const { data: present, error: presentError } = await supabaseAdmin
      .from("attendance_records")
      .select("id, marked_at, status, manually_added, latitude, longitude, student_id, users(full_name, email, matric_number, avatar_url)")
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

    const now = new Date();
    const isOpen = new Date(sessionData.opens_at) <= now && now <= new Date(sessionData.closes_at);

    return res.status(200).json({
      isOpen,
      isLocked: (sessionData as any).is_locked ?? false,
      presentCount: present?.length ?? 0,
      absentCount: absent.length,
      present: present || [],
      absent,
      course: sessionData.classes?.courses,
      session: { id: sessionData.id, opens_at: sessionData.opens_at, closes_at: sessionData.closes_at, is_locked: (sessionData as any).is_locked, latitude: sessionData.latitude, longitude: sessionData.longitude, radius: sessionData.radius },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch live attendance" });
  }
}

export async function getAttendanceCSV(req: AuthenticatedRequest, res: Response) {
  const { sessionId } = req.params;

  try {
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("attendance_sessions")
      .select("id, opens_at, latitude, longitude, radius, classes(course_id, courses(code, title, level))")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const s = session as any;
    const courseId = s.classes?.course_id;
    const courseCode = s.classes?.courses?.code || "Unknown";
    const courseTitle = s.classes?.courses?.title || "Unknown";

    const { data: present } = await supabaseAdmin
      .from("attendance_records")
      .select("marked_at, status, manually_added, latitude, longitude, users(full_name, email, matric_number)")
      .eq("session_id", sessionId);

    const { data: enrolled } = await supabaseAdmin
      .from("course_enrollments")
      .select("student_id, users!student_id(full_name, email, matric_number)")
      .eq("course_id", courseId);

    const presentMap = new Map((present || []).map((p: any) => [p.users?.email, p]));
    const sessionDate = new Date(s.opens_at).toLocaleDateString("en-GB");

    const headers = ["S/N", "Name", "Matric Number", "Email", "Status", "Distance (m)", "Time Marked"];
    const rows: string[][] = [];

    let sn = 1;
    for (const e of (enrolled || [])) {
      const u = (e as any).users;
      if (!u) continue;
      const record = presentMap.get(u.email);
      if (record) {
        let dist = "";
        if (record.latitude && record.longitude && s.latitude && s.longitude) {
          const d = getHaversineDistance(record.latitude, record.longitude, s.latitude, s.longitude);
          dist = String(Math.round(d));
        }
        rows.push([String(sn++), u.full_name, u.matric_number || "", u.email, "Present", dist, new Date(record.marked_at).toLocaleTimeString()]);
      } else {
        rows.push([String(sn++), u.full_name, u.matric_number || "", u.email, "Absent", "", ""]);
      }
    }

    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${courseCode.replace(/\s+/g, "_")}_${sessionDate.replace(/\//g, "-")}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to generate CSV" });
  }
}
