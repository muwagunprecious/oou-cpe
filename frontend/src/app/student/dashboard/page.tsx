"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LayoutGrid, ClipboardList, CalendarCheck, MessageCircle, Newspaper, BookOpen,
  Upload, Loader2, AlertCircle, CheckCircle2, Clock, Camera, User, LogOut, CheckCheck, XCircle, MapPin
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import AttendanceCheckIn from "@/components/dashboard/AttendanceCheckIn";
import AIChatWidget from "@/components/dashboard/AIChatWidget";
import GridBackground from "@/components/ui/GridBackground";

const TABS = [
  { key: "overview", label: "Weekly Overview", icon: LayoutGrid },
  { key: "courses", label: "My Courses", icon: BookOpen },
  { key: "attendance", label: "Attendance", icon: CalendarCheck },
  { key: "assignments", label: "Assignments", icon: ClipboardList },
  { key: "complaint", label: "Submit Complaint", icon: MessageCircle },
  { key: "news", label: "News", icon: Newspaper },
];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function StudentDashboard() {
  const { profile, loading: authLoading, session, refreshProfile, signOut } = useAuth();
  const [active, setActive] = useState("overview");
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const fetchEnrollments = useCallback(async () => {
    if (authLoading || !profile) return;
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/enrollments/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setEnrollments(data || []); }
    } finally { setClassesLoading(false); }
  }, [authLoading, profile?.id]);

  const fetchAssignments = useCallback(async () => {
    if (authLoading || !profile?.level) { setAssignmentsLoading(false); return; }
    const { data: levelCourses } = await supabase.from("courses").select("id").eq("level", profile.level);
    const courseIds = (levelCourses || []).map((c: any) => c.id);
    if (!courseIds.length) { setAssignments([]); setAssignmentsLoading(false); return; }
    const { data } = await supabase.from("assignments").select("*, courses(code, title)").in("course_id", courseIds).order("deadline", { ascending: true });
    setAssignments(data || []);
    setAssignmentsLoading(false);
  }, [authLoading, profile?.level]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);
  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // Flatten classes from enrollments for overview schedule
  const classes = enrollments.flatMap((e: any) => (e.course?.classes || []).map((cl: any) => ({ ...cl, courses: { code: e.course?.code, title: e.course?.title, level: e.course?.level }, locations: cl.location })));

  return (
    <>
      <DashboardLayout
        tabs={TABS}
        active={active}
        setActive={setActive}
        title="Student Dashboard"
        portalLabel="Department portal"
      >
        {active === "overview" && (
          <WeeklyOverview profile={profile} classes={classes} loading={classesLoading} assignments={assignments} />
        )}
        {active === "courses" && (
          <CoursesView profile={profile} enrollments={enrollments} onRefresh={fetchEnrollments} />
        )}
        {active === "attendance" && (
          <AttendanceView enrollments={enrollments} loading={classesLoading} />
        )}
        {active === "assignments" && (
          <AssignmentsView assignments={assignments} loading={assignmentsLoading} profile={profile} />
        )}
        {active === "complaint" && <ComplaintForm profile={profile} />}
        {active === "news" && <NewsView />}
      </DashboardLayout>
      <AIChatWidget />

      {!authLoading && profile && !profile.avatar_url && (
        <AvatarUploadModal session={session} refreshProfile={refreshProfile} signOut={signOut} />
      )}
    </>
  );
}

/* ─── Weekly Overview ─── */
function WeeklyOverview({ profile, classes, loading, assignments }: any) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const byDay = (day: string) => classes.filter((c: any) => c.day === day);
  const pending = assignments.filter((a: any) => !a.deadline || new Date(a.deadline) >= new Date());
  const upcoming = pending.slice(0, 4);

  // Warn if this student's level hasn't been set yet
  const levelMissing = !loading && !profile?.level;

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative bg-[#0a0a0a] text-white rounded-3xl p-6 sm:p-10 overflow-hidden">
        <GridBackground size={40} />
        <p className="relative text-sm text-white/40 mb-2">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h2 className="relative text-2xl sm:text-3xl font-medium mb-6">
          {greeting},{" "}
          <span className="font-voice italic font-normal text-green-400">
            {profile?.full_name?.split(" ")[0] || "there"}
          </span>
        </h2>
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Classes this week", value: String(classes.length) },
            { label: "Pending assignments", value: String(pending.length) },
            { label: "Department", value: "Comp. Eng." },
            { label: "Level", value: profile?.level ? `${profile.level} Level` : "—" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 rounded-2xl p-4 min-h-[76px] flex flex-col justify-between">
              <p className="text-xs text-white/40 mb-1 leading-snug">{s.label}</p>
              <p className="text-lg sm:text-xl font-medium text-green-400">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Level not configured warning */}
      {levelMissing && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Your study level is not set</p>
            <p className="text-amber-700 mt-0.5">
              Your account doesn't have a level assigned yet (e.g. 100, 200, 300 Level).
              Please contact the department administrator to update your profile.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Weekly schedule */}
        <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-lg font-medium">Weekly schedule</h3>
          <p className="text-sm text-gray-400 mb-6">All lectures for the coming week</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </div>
          ) : (
            <div className="space-y-4">
              {WEEKDAYS.map((day) => (
                <div key={day} className="flex items-start justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <p className="text-xs font-medium text-gray-400 tracking-wide w-28 pt-0.5">{day.toUpperCase()}</p>
                  <div className="flex-1 text-right">
                    {byDay(day).length === 0 ? (
                      <p className="text-sm text-gray-300">No classes</p>
                    ) : (
                      byDay(day).map((c: any) => (
                        <p key={c.id} className="text-sm">
                          {c.courses?.code} · {c.start_time}–{c.end_time}
                          {c.locations?.name ? ` · ${c.locations.name}` : ""}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming deadlines */}
        <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
          <h3 className="text-lg font-medium">Upcoming deadlines</h3>
          <p className="text-sm text-gray-400 mb-6">Next 4 assignments</p>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 size={28} className="text-green-200 mb-3" />
              <p className="text-sm text-gray-400">No upcoming deadlines 🎉</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((a: any) => (
                <li key={a.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium">{a.courses?.code} · {a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock size={11} />
                    Due {a.deadline ? new Date(a.deadline).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Assignments View ─── */
function AssignmentsView({ assignments, loading, profile }: any) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  const handleUpload = async (assignmentId: string, file: File) => {
    setSubmitting(assignmentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("assignmentId", assignmentId);

      await fetch(`${backendUrl}/api/assignments/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      setSubmittedIds((prev) => new Set([...prev, assignmentId]));
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
      <Loader2 size={16} className="animate-spin" /> Loading assignments...
    </div>
  );

  if (assignments.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-100 p-10 sm:p-16 flex flex-col items-center text-center">
        <ClipboardList size={32} className="text-gray-200 mb-4" strokeWidth={1.5} />
        <p className="text-gray-400">No assignments yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.map((a: any) => {
        const overdue = a.deadline && new Date(a.deadline) < new Date();
        const submitted = submittedIds.has(a.id);
        return (
          <div key={a.id} className="rounded-3xl border border-gray-100 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs text-green-700 font-medium">{a.courses?.code}</p>
                <p className="text-sm font-medium mt-0.5">{a.title}</p>
                {a.description && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{a.description}</p>}
              </div>
              <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${overdue ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {a.deadline
                  ? `${overdue ? "Closed" : "Due"} ${new Date(a.deadline).toLocaleDateString([], { month: "short", day: "numeric" })}`
                  : "No deadline"}
              </span>
            </div>

            {!overdue && (
              submitted ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 size={15} /> Submitted
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.zip"
                    className="hidden"
                    disabled={submitting === a.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(a.id, file);
                    }}
                  />
                  <span className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-4 py-2 text-xs font-medium hover:bg-gray-800 transition">
                    {submitting === a.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    {submitting === a.id ? "Uploading..." : "Submit PDF / DOCX / ZIP"}
                  </span>
                </label>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Attendance View ─── */
/* ─── Courses View — student enrolls/drops courses and sees lecturers ─── */
function CoursesView({ profile, enrollments, onRefresh }: any) {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const enrolledIds = new Set(enrollments.map((e: any) => e.course?.id));

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("courses")
        .select("*, lecturer:users!lecturer_id(id, full_name, email, avatar_url), classes(id, day, start_time, end_time, location:locations(name, building))")
        .eq("level", profile?.level || "")
        .order("code");
      setAllCourses(data || []);
      setLoading(false);
    };
    if (profile?.level) load();
  }, [profile?.level]);

  const enroll = async (courseId: string) => {
    setActing(courseId);
    const token = await getToken();
    const res = await fetch(`${BACKEND}/api/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ course_id: courseId }),
    });
    if (res.ok) await onRefresh();
    setActing(null);
  };

  const drop = async (courseId: string) => {
    setActing(courseId);
    const token = await getToken();
    await fetch(`${BACKEND}/api/enrollments/${courseId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await onRefresh();
    setActing(null);
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-gray-400 py-10"><Loader2 size={16} className="animate-spin" /> Loading courses...</div>;

  return (
    <div className="space-y-6">
      {/* Enrolled summary */}
      {enrollments.length > 0 && (
        <div className="rounded-3xl border border-gray-100 p-6">
          <h3 className="text-lg font-medium mb-1">Enrolled Courses</h3>
          <p className="text-sm text-gray-400 mb-4">{enrollments.length} courses registered for this semester</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {enrollments.map((e: any) => {
              const c = e.course;
              if (!c) return null;
              const slots = c.classes || [];
              return (
                <div key={e.id} className="rounded-2xl border border-green-100 bg-green-50/30 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">{c.code}</span>
                        <span className="text-xs text-gray-400">{c.credit_units || 3} units</span>
                      </div>
                      <p className="text-sm font-medium">{c.title}</p>
                      {c.lecturer ? (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-6 w-6 rounded-full bg-gray-200 overflow-hidden shrink-0">
                            {c.lecturer.avatar_url ? <img src={c.lecturer.avatar_url} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-[9px] font-bold text-gray-600">{c.lecturer.full_name?.charAt(0)}</span>}
                          </div>
                          <p className="text-xs text-gray-500">{c.lecturer.full_name}</p>
                        </div>
                      ) : <p className="text-xs text-gray-400 mt-1">No lecturer assigned</p>}
                      {slots.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {slots.map((sl: any) => (
                            <p key={sl.id} className="text-xs text-gray-500">📅 {sl.day} · {sl.start_time}–{sl.end_time} {sl.location?.name ? `· ${sl.location.name}` : ""}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => drop(c.id)} disabled={acting === c.id} className="shrink-0 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-2 py-1 transition disabled:opacity-50">
                      {acting === c.id ? <Loader2 size={12} className="animate-spin" /> : "Drop"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Browse all level courses */}
      <div className="rounded-3xl border border-gray-100 p-6">
        <h3 className="text-lg font-medium mb-1">All {profile?.level} Level Courses</h3>
        <p className="text-sm text-gray-400 mb-4">Click Enroll to add a course to your list</p>
        {allCourses.length === 0 ? (
          <p className="text-sm text-gray-400">No courses available for your level yet.</p>
        ) : (
          <div className="space-y-2">
            {allCourses.map((c: any) => {
              const isEnrolled = enrolledIds.has(c.id);
              return (
                <div key={c.id} className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${isEnrolled ? "border-green-200 bg-green-50/20" : "border-gray-100"}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">{c.code}</span>
                      <span className="text-xs text-gray-400">Sem {c.semester}</span>
                      {isEnrolled && <CheckCheck size={13} className="text-green-500" />}
                    </div>
                    <p className="text-sm font-medium mt-0.5">{c.title}</p>
                    <p className="text-xs text-gray-400">{c.lecturer?.full_name || "Unassigned"}</p>
                  </div>
                  {isEnrolled ? (
                    <button onClick={() => drop(c.id)} disabled={acting === c.id} className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 transition disabled:opacity-50">
                      {acting === c.id ? <Loader2 size={11} className="animate-spin" /> : "Drop"}
                    </button>
                  ) : (
                    <button onClick={() => enroll(c.id)} disabled={acting === c.id} className="text-xs bg-[#0a0a0a] text-white rounded-lg px-3 py-1.5 hover:bg-gray-800 transition disabled:opacity-50">
                      {acting === c.id ? <Loader2 size={11} className="animate-spin" /> : "Enroll"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Attendance View — smart, enrollment-based, GPS pre-checked ─── */
function AttendanceView({ enrollments, loading }: any) {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const [activeSessionsMap, setActiveSessionsMap] = useState<{ [classId: string]: any }>({});
  const [distanceMap, setDistanceMap] = useState<{ [classId: string]: number | null }>({});
  const [marking, setMarking] = useState<{ [sessionId: string]: boolean }>({});
  const [results, setResults] = useState<{ [sessionId: string]: { ok: boolean; msg: string } }>({});

  const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];

  // Gather all classes from enrolled courses that are scheduled TODAY
  const todayClasses = enrollments.flatMap((e: any) => {
    const course = e.course;
    if (!course) return [];
    return (course.classes || [])
      .filter((cl: any) => cl.day === todayName)
      .map((cl: any) => ({ ...cl, course }));
  });

  useEffect(() => {
    // For each today class, check if there's an active attendance session now
    const now = new Date();
    const map: { [classId: string]: any } = {};
    todayClasses.forEach((cl: any) => {
      (cl.attendance_sessions || []).forEach((s: any) => {
        if (new Date(s.opens_at) <= now && now <= new Date(s.closes_at)) {
          map[cl.id] = s;
        }
      });
    });
    setActiveSessionsMap(map);
  }, [enrollments]);

  const checkDistance = (session: any): Promise<number> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject("Geolocation not supported");
      navigator.geolocation.getCurrentPosition(pos => {
        const lat1 = pos.coords.latitude, lon1 = pos.coords.longitude;
        const lat2 = session.latitude, lon2 = session.longitude;
        if (lat2 == null || lon2 == null) return resolve(0);
        const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
        resolve(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      }, reject);
    });
  };

  const markAttendance = async (cl: any, session: any) => {
    setMarking(m => ({ ...m, [session.id]: true }));
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      const { data: { session: authSess } } = await supabase.auth.getSession();
      const token = authSess?.access_token || "";
      const r = await fetch(`${BACKEND}/api/attendance/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: session.id, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      });
      const data = await r.json();
      setResults(prev => ({ ...prev, [session.id]: { ok: r.ok, msg: r.ok ? `✅ Marked! (${data.distance}m away)` : data.error } }));
    } catch (e: any) {
      setResults(prev => ({ ...prev, [session.id]: { ok: false, msg: e.message || "GPS error" } }));
    } finally {
      setMarking(m => ({ ...m, [session.id]: false }));
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-gray-400 py-10"><Loader2 size={16} className="animate-spin" /> Loading attendance...</div>;

  if (enrollments.length === 0) return (
    <div className="rounded-3xl border border-gray-100 p-10 flex flex-col items-center text-center">
      <CalendarCheck size={32} className="text-gray-200 mb-4" strokeWidth={1.5} />
      <p className="text-gray-500 font-medium">No enrolled courses</p>
      <p className="text-sm text-gray-400 mt-1">Enroll in courses from the <strong>My Courses</strong> tab first.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 text-sm text-gray-600">
        📅 Showing attendance for <strong>{todayName}</strong> — only sessions your lecturer has activated will appear here.
      </div>

      {todayClasses.length === 0 ? (
        <div className="rounded-3xl border border-gray-100 p-10 flex flex-col items-center text-center">
          <CalendarCheck size={32} className="text-gray-200 mb-4" strokeWidth={1.5} />
          <p className="text-gray-400">No classes scheduled for today</p>
        </div>
      ) : (
        todayClasses.map((cl: any) => {
          const session = activeSessionsMap[cl.id];
          const result = session ? results[session.id] : null;
          const isMarking = session ? marking[session.id] : false;

          return (
            <div key={cl.id} className={`rounded-3xl border p-6 ${session ? "border-green-200 bg-green-50/20" : "border-gray-100"}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">{cl.course?.code}</span>
                    <span className="text-xs text-gray-400">{cl.start_time}–{cl.end_time}</span>
                  </div>
                  <p className="text-sm font-medium">{cl.course?.title}</p>
                  {cl.location?.name && <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><MapPin size={11} /> {cl.location.name}</p>}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${session ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {session ? "Session Open" : "No Active Session"}
                </span>
              </div>

              {session ? (
                result ? (
                  <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {result.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {result.msg}
                  </div>
                ) : (
                  <button
                    onClick={() => markAttendance(cl, session)}
                    disabled={isMarking}
                    className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-2xl px-5 py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 w-full justify-center"
                  >
                    {isMarking ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
                    {isMarking ? "Getting your location..." : "Mark My Attendance (GPS)"}
                  </button>
                )
              ) : (
                <p className="text-xs text-gray-400 italic mt-1">Your lecturer hasn't started attendance yet. Check back when class begins.</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}


/* ─── Complaint Form ─── */
function ComplaintForm({ profile }: any) {
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [form, setForm] = useState({ lecturerId: "", courseId: "", subject: "", message: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const [{ data: lecs }, { data: crs }, { data: myComplaints }] = await Promise.all([
        supabase.from("users").select("id, full_name").eq("role", "lecturer"),
        supabase.from("courses").select("id, code, title").eq("level", profile.level),
        supabase
          .from("complaints")
          .select("*, lecturer:users!lecturer_id(full_name), courses(code)")
          .eq("student_id", profile.id)
          .order("created_at", { ascending: false }),
      ]);
      setLecturers(lecs || []);
      setCourses(crs || []);
      setMine(myComplaints || []);
    };
    load();
  }, [profile?.id, profile?.level]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.lecturerId || !form.subject.trim() || !form.message.trim()) {
      setError("Pick a lecturer and fill in the subject and message.");
      return;
    }
    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("complaints")
      .insert({
        student_id: profile.id,
        lecturer_id: form.lecturerId,
        course_id: form.courseId || null,
        subject: form.subject,
        message: form.message,
        status: "open",
      })
      .select("*, lecturer:users!lecturer_id(full_name), courses(code)")
      .single();
    setSaving(false);

    if (insertError) { setError(insertError.message); return; }
    setMine([data, ...mine]);
    setForm({ lecturerId: "", courseId: "", subject: "", message: "" });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-medium">Submit a complaint</h2>
          <p className="text-sm text-gray-400">Send an official message to a lecturer</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2" htmlFor="lecturer">Lecturer</label>
            <select
              id="lecturer"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              value={form.lecturerId}
              onChange={(e) => setForm({ ...form, lecturerId: e.target.value })}
            >
              <option value="">Select lecturer</option>
              {lecturers.map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2" htmlFor="course">Course (optional)</label>
            <select
              id="course"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            >
              <option value="">Select course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.title}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2" htmlFor="subject">Subject</label>
          <input
            id="subject"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
            placeholder="Short summary"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-2" htmlFor="message">Message</label>
          <textarea
            id="message"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-green-400/30 resize-none"
            placeholder="Describe your concern..."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Sending..." : "Send complaint"}
        </button>
      </form>

      {/* My complaints */}
      <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-lg font-medium">My complaints</h2>
        <p className="text-sm text-gray-400 mb-6">Recent submissions and their status</p>
        {mine.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageCircle size={28} className="text-gray-200 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-400">Nothing submitted yet</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {mine.map((c: any) => (
              <li key={c.id} className="border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{c.subject}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.status === "resolved" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  To {c.lecturer?.full_name || "—"}{c.courses?.code ? ` · ${c.courses.code}` : ""}
                </p>
                {c.reply && (
                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-xl px-3 py-2">
                    Reply: {c.reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── News View ─── */
function NewsView() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      setNews(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
      <Loader2 size={16} className="animate-spin" /> Loading news...
    </div>
  );

  if (news.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-100 p-10 sm:p-16 flex flex-col items-center text-center">
        <Newspaper size={32} className="text-gray-200 mb-4" strokeWidth={1.5} />
        <p className="text-gray-400">No news yet</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {news.map((n: any) => (
        <article key={n.id} className="rounded-3xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="aspect-[16/10] bg-gray-100 shrink-0 overflow-hidden">
            {n.image_url ? (
              <img src={n.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Newspaper size={26} className="text-gray-300" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="p-5 flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] uppercase tracking-wide font-medium text-green-700 bg-green-400/10 rounded-full px-2 py-0.5">
                {n.type}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(n.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
              </span>
            </div>
            <h3 className="text-base font-medium leading-snug line-clamp-2 min-h-[2.75rem]">{n.title}</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-3">{n.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ─── Avatar Upload Modal ─── */
function AvatarUploadModal({ session, refreshProfile, signOut }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const token = session?.access_token;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

      const res = await fetch(`${backendUrl}/api/users/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 && data.error?.includes("profile")) {
          throw new Error("Your department portal profile could not be verified. Please try signing out and signing back in, or contact your administrator.");
        }
        throw new Error(data.error || "Failed to upload picture.");
      }

      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col items-center">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
          <GridBackground size={24} />
        </div>

        <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-5 relative">
          <Camera className="text-green-600" size={22} />
        </div>

        <h2 className="text-xl font-medium text-center mb-2">Upload Profile Picture</h2>
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
          To finalize your account setup, please upload a clear, high-quality portrait of yourself. This is required for course rosters and exams.
        </p>

        {error && (
          <div className="w-full flex items-start gap-2 bg-red-50 text-red-600 text-xs rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Dropzone */}
        <div className="w-full aspect-square max-w-[200px] border-2 border-dashed border-gray-200 rounded-3xl overflow-hidden relative group flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100/50 hover:border-green-400 transition cursor-pointer mb-6">
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center p-4">
              <User size={36} className="text-gray-300 group-hover:text-green-400 transition mb-2" strokeWidth={1.5} />
              <span className="text-xs text-gray-400 group-hover:text-gray-500 transition text-center font-medium">Select photo</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            disabled={uploading}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={onUpload}
            disabled={!file || uploading}
            className="w-full bg-[#0a0a0a] text-white rounded-full py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={14} />
                Set profile picture
              </>
            )}
          </button>

          <button
            onClick={() => signOut()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-red-500 transition py-2 font-medium"
          >
            <LogOut size={14} />
            Sign out of portal
          </button>
        </div>
      </div>
    </div>
  );
}
