import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { supabase, supabaseAdmin } from "../lib/supabase.js";

// Haversine distance calculator in meters
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

export async function markAttendance(req: AuthenticatedRequest, res: Response) {
  const studentId = req.profile?.id;
  const studentLevel = req.profile?.level;
  const { sessionId, latitude, longitude } = req.body;

  if (!sessionId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "Missing sessionId, latitude, or longitude" });
  }

  try {
    // 1. Fetch the attendance session details
    // We join the class, location and course to perform full validation
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("attendance_sessions")
      .select(`
        id,
        opens_at,
        closes_at,
        is_test,
        radius,
        latitude,
        longitude,
        classes (
          id,
          attendance_radius,
          courses (
            id,
            code,
            level
          ),
          locations (
            name,
            latitude,
            longitude
          )
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: "Attendance session not found" });
    }

    const sessionData = session as any;
    const courseLevel = sessionData.classes?.courses?.level;
    const classId = sessionData.classes?.id;

    // 2. Validate Student Enrollment / Level matching
    if (courseLevel !== studentLevel) {
      return res.status(403).json({
        error: `Enrolled course level mismatch. Course is for ${courseLevel} level, but you are in ${studentLevel} level.`,
      });
    }

    // 3. Validate Time Window
    const now = new Date();
    const opensAt = new Date(sessionData.opens_at);
    const closesAt = new Date(sessionData.closes_at);

    if (now < opensAt) {
      return res.status(400).json({ error: "Attendance session is not open yet" });
    }
    if (now > closesAt) {
      return res.status(400).json({ error: "Attendance session has closed" });
    }

    // 4. Validate if already marked
    const { data: existingRecord, error: recordError } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existingRecord) {
      return res.status(400).json({ error: "Attendance has already been marked for this session" });
    }

    // 5. GPS Geofencing Check
    // Coordinates precedence: Session-specific coordinate override -> Location table coordinate -> Class coordinates
    let targetLat = sessionData.latitude;
    let targetLon = sessionData.longitude;
    let targetRadius = sessionData.radius || sessionData.classes?.attendance_radius || 50;

    if (targetLat === null || targetLon === null || targetLat === undefined) {
      targetLat = sessionData.classes?.locations?.latitude;
      targetLon = sessionData.classes?.locations?.longitude;
    }

    if (targetLat === null || targetLon === null || targetLat === undefined) {
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
        error: `Out of range. You are ${Math.round(distance)}m away from the classroom. The allowed radius is ${targetRadius}m.`,
        distance: Math.round(distance),
        allowedRadius: targetRadius,
      });
    }

    // 6. Record the Attendance Check-in
    const { data: record, error: insertError } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        session_id: sessionId,
        student_id: studentId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: "present",
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    // Log administrative action
    await supabaseAdmin.from("audit_logs").insert({
      user_id: studentId,
      action: "mark_attendance",
      details: { session_id: sessionId, distance: Math.round(distance) },
    });

    return res.status(200).json({
      message: "Attendance marked successfully",
      record,
      distance: Math.round(distance),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to mark attendance" });
  }
}

export async function getLiveAttendance(req: AuthenticatedRequest, res: Response) {
  const { sessionId } = req.params;

  try {
    // Check session first
    const { data: session, error: sessionErr } = await supabase
      .from("attendance_sessions")
      .select("id, class_id, classes(course_id, courses(level, title, code))")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const sessionData = session as any;
    const courseLevel = sessionData.classes?.courses?.level;

    // Fetch present students
    const { data: present, error: presentError } = await supabase
      .from("attendance_records")
      .select("marked_at, status, users(full_name, email, matric_number)")
      .eq("session_id", sessionId);

    if (presentError) {
      return res.status(500).json({ error: presentError.message });
    }

    // Fetch all active students in the target course level to find who is absent
    const { data: allStudents, error: studentsError } = await supabase
      .from("users")
      .select("id, full_name, email, matric_number")
      .eq("role", "student")
      .eq("status", "active")
      .eq("level", courseLevel);

    if (studentsError) {
      return res.status(500).json({ error: studentsError.message });
    }

    const presentStudentIds = new Set(present.map((p: any) => p.student_id));
    const absent = allStudents.filter((student: any) => !presentStudentIds.has(student.id));

    return res.status(200).json({
      presentCount: present.length,
      absentCount: absent.length,
      present,
      absent,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to fetch live attendance" });
  }
}
