"use client";

import { useEffect, useState } from "react";
import {
  LayoutGrid, Calendar, Users, ClipboardList, Megaphone,
  Loader2, CheckCircle2, XCircle, Clock, Plus, Radio, MapPin, Trash2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GridBackground from "@/components/ui/GridBackground";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "classes", label: "My Classes", icon: Calendar },
  { key: "attendance", label: "Attendance Sessions", icon: Radio },
  { key: "assignments", label: "Assignments", icon: ClipboardList },
  { key: "complaints", label: "Complaints", icon: Users },
  { key: "announcements", label: "Announcements", icon: Megaphone },
];

export default function LecturerDashboard() {
  const { profile } = useAuth();
  const [active, setActive] = useState("overview");

  return (
    <DashboardLayout
      tabs={TABS}
      active={active}
      setActive={setActive}
      title="Lecturer Dashboard"
      portalLabel="Department portal"
    >
      {active === "overview" && <LecturerOverview profile={profile} />}
      {active === "classes" && <MyClasses profile={profile} />}
      {active === "attendance" && <AttendanceSessions profile={profile} />}
      {active === "assignments" && <AssignmentsManager profile={profile} />}
      {active === "complaints" && <ComplaintsManager profile={profile} />}
      {active === "announcements" && <AnnouncementsManager profile={profile} />}
    </DashboardLayout>
  );
}

/* ─── Lecturer Overview ─── */
function LecturerOverview({ profile }: any) {
  const [stats, setStats] = useState({ courses: 0, assignments: 0, complaints: 0 });

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const [{ count: c }, { count: a }, { count: comp }] = await Promise.all([
        supabase.from("courses").select("*", { count: "exact", head: true }).eq("lecturer_id", profile.id),
        supabase.from("assignments").select("*", { count: "exact", head: true }).eq("created_by", profile.id),
        supabase.from("complaints").select("*", { count: "exact", head: true }).eq("lecturer_id", profile.id).eq("status", "open"),
      ]);
      setStats({ courses: c || 0, assignments: a || 0, complaints: comp || 0 });
    };
    load();
  }, [profile?.id]);

  return (
    <div className="space-y-6">
      <div className="relative bg-[#0a0a0a] text-white rounded-3xl p-6 sm:p-10 overflow-hidden">
        <GridBackground size={40} />
        <p className="relative text-sm text-white/40 mb-2">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h2 className="relative text-2xl sm:text-3xl font-medium mb-6">
          Welcome back,{" "}
          <span className="font-voice italic font-normal text-green-400">
            {profile?.full_name?.split(" ")[0] || "Lecturer"}
          </span>
        </h2>
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Courses assigned", value: String(stats.courses) },
            { label: "Assignments published", value: String(stats.assignments) },
            { label: "Open complaints", value: String(stats.complaints) },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 rounded-2xl p-4 min-h-[76px] flex flex-col justify-between">
              <p className="text-xs text-white/40 mb-1 leading-snug">{s.label}</p>
              <p className="text-xl font-medium text-green-400">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-gray-100 p-6 bg-green-50">
          <h3 className="font-medium text-green-900 mb-1">Tip: Open an attendance session</h3>
          <p className="text-sm text-green-700 leading-relaxed">
            Navigate to <strong>Attendance Sessions</strong> to open a timed check-in window for any class. Students must be within the set GPS radius to mark attendance.
          </p>
        </div>
        <div className="rounded-3xl border border-gray-100 p-6 bg-amber-50">
          <h3 className="font-medium text-amber-900 mb-1">Respond to student complaints</h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            You have {stats.complaints} open complaint{stats.complaints !== 1 ? "s" : ""} awaiting your response. Visit the <strong>Complaints</strong> tab to reply.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── My Classes ─── */
function MyClasses({ profile }: any) {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const [courses, setCourses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];

  const [form, setForm] = useState({
    courseId: "",
    day: todayName,
    startTime: "08:00",
    endTime: "10:00",
    locationId: "",
    venue: "",
    latitude: "",
    longitude: "",
    attendanceRadius: "10"
  });

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const loadCourses = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("courses")
      .select("*, classes(*, locations(name, building))")
      .eq("lecturer_id", profile.id);
    setCourses(data || []);
  };

  const loadLocations = async () => {
    const { data } = await supabase
      .from("locations")
      .select("*")
      .order("name");
    setLocations(data || []);
  };

  useEffect(() => {
    if (!profile?.id) return;
    const init = async () => {
      await Promise.all([loadCourses(), loadLocations()]);
      setLoading(false);
    };
    init();
  }, [profile?.id]);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId) return;
    setSaving(true);

    try {
      const token = await getToken();
      const loc = locations.find(l => l.id === form.locationId);

      const res = await fetch(`${BACKEND}/api/courses/${form.courseId}/timetable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          day: form.day,
          start_time: form.startTime,
          end_time: form.endTime,
          location_id: form.locationId || null,
          venue: form.venue || null,
          latitude: form.latitude ? parseFloat(form.latitude) : (loc?.latitude || null),
          longitude: form.longitude ? parseFloat(form.longitude) : (loc?.longitude || null),
          attendance_radius: form.attendanceRadius ? parseFloat(form.attendanceRadius) : 10
        })
      });

      if (res.ok) {
        await loadCourses();
        setShowAddForm(false);
        setForm({
          courseId: "",
          day: todayName,
          startTime: "08:00",
          endTime: "10:00",
          locationId: "",
          venue: "",
          latitude: "",
          longitude: "",
          attendanceRadius: "10"
        });
      } else {
        const err = await res.json();
        alert(err.error || "Failed to schedule class");
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSlot = async (courseId: string, slotId: string) => {
    if (!confirm("Are you sure you want to remove this class slot? This will cancel any scheduled sessions for it.")) return;

    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/courses/${courseId}/timetable/${slotId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        await loadCourses();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete slot");
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
      <Loader2 size={16} className="animate-spin" /> Loading classes...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium">My Courses & Timetable</h2>
          <p className="text-sm text-gray-400">Manage scheduled lectures and room locations</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-gray-800 transition"
        >
          <Plus size={16} /> {showAddForm ? "Hide Form" : "Schedule Class Today"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddSlot} className="rounded-3xl border border-gray-100 p-6 space-y-4 bg-gray-50/50">
          <h3 className="font-medium text-sm">Schedule a Class Slot</h3>
          
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Course</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.courseId}
                onChange={e => setForm({ ...form, courseId: e.target.value })}
                required
              >
                <option value="">Select a course</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} · {c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Day</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.day}
                onChange={e => setForm({ ...form, day: e.target.value })}
                required
              >
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                  <option key={d} value={d}>{d} {d === todayName ? "(Today)" : ""}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Predefined Location</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.locationId}
                onChange={e => {
                  const loc = locations.find(l => l.id === e.target.value);
                  setForm({
                    ...form,
                    locationId: e.target.value,
                    latitude: loc?.latitude?.toString() || "",
                    longitude: loc?.longitude?.toString() || ""
                  });
                }}
              >
                <option value="">Custom Venue Override</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name} — {l.building}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Start Time</label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.startTime}
                onChange={e => setForm({ ...form, startTime: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">End Time</label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.endTime}
                onChange={e => setForm({ ...form, endTime: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Custom Venue Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. ETF Hall"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.venue}
                onChange={e => setForm({ ...form, venue: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">GPS Latitude (Optional)</label>
              <input
                type="number"
                step="any"
                placeholder="6.9038"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.latitude}
                onChange={e => setForm({ ...form, latitude: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">GPS Longitude (Optional)</label>
              <input
                type="number"
                step="any"
                placeholder="3.9298"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.longitude}
                onChange={e => setForm({ ...form, longitude: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Attendance Radius (m)</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
                value={form.attendanceRadius}
                onChange={e => setForm({ ...form, attendanceRadius: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="border border-gray-200 text-gray-600 rounded-full px-5 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-green-500 text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-green-600 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Class Slot"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {courses.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 p-16 flex flex-col items-center text-center">
            <Calendar size={32} className="text-gray-200 mb-4" strokeWidth={1.5} />
            <p className="text-gray-400">No courses assigned yet. Contact the administrator.</p>
          </div>
        ) : (
          courses.map((course: any) => (
            <div key={course.id} className="rounded-3xl border border-gray-100 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                <div>
                  <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-2.5 py-1">{course.code}</span>
                  <h3 className="font-medium mt-2">{course.title}</h3>
                  <p className="text-xs text-gray-400">{course.level} Level · Semester {course.semester} · {course.credit_units} Units</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled Classes</h4>
                {course.classes && course.classes.length > 0 ? (
                  <div className="space-y-2">
                    {course.classes.map((cls: any) => (
                      <div key={cls.id} className="flex items-center justify-between text-sm bg-gray-50/50 rounded-2xl px-4 py-3 border border-gray-50">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${cls.day === todayName ? "text-green-600" : "text-gray-700"}`}>
                              {cls.day} {cls.day === todayName ? "(Today)" : ""}
                            </span>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-600">{cls.start_time} – {cls.end_time}</span>
                          </div>
                          {cls.locations?.name && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <MapPin size={12} /> {cls.locations.name} {cls.venue ? `(${cls.venue})` : ""}
                            </p>
                          )}
                          {!cls.locations?.name && cls.venue && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <MapPin size={12} /> {cls.venue}
                            </p>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleRemoveSlot(course.id, cls.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                          title="Remove scheduled class"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No classes scheduled for this course yet.</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Attendance Sessions ─── */
function AttendanceSessions({ profile }: any) {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [activeSessionMap, setActiveSessionMap] = useState<{ [classId: string]: any }>({});
  const [liveData, setLiveData] = useState<{ [sessionId: string]: any }>({});
  const [manualMarking, setManualMarking] = useState<{ [key: string]: boolean }>({});
  const [duration, setDuration] = useState("60");

  const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const loadCourses = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("courses")
      .select("id, code, title, level, classes(id, day, start_time, end_time, attendance_radius, latitude, longitude, location:locations(name))")
      .eq("lecturer_id", profile.id);
    setMyCourses(data || []);
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, [profile?.id]);

  // Compute today's classes across all courses
  const todayClasses = myCourses.flatMap(c =>
    (c.classes || []).filter((cl: any) => cl.day === todayName).map((cl: any) => ({ ...cl, course: c }))
  );

  // Check for currently active sessions
  useEffect(() => {
    const now = new Date();
    const fetchSessions = async () => {
      if (!todayClasses.length) return;
      const classIds = todayClasses.map(c => c.id);
      const { data } = await supabase
        .from("attendance_sessions")
        .select("*")
        .in("class_id", classIds)
        .gte("closes_at", now.toISOString());
      const map: { [classId: string]: any } = {};
      (data || []).forEach((s: any) => { map[s.class_id] = s; });
      setActiveSessionMap(map);
    };
    fetchSessions();
  }, [myCourses]);

  const activateAttendance = async (cl: any) => {
    setActivating(cl.id);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
      const token = await getToken();
      const r = await fetch(`${BACKEND}/api/attendance/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ classId: cl.id, latitude: pos.coords.latitude, longitude: pos.coords.longitude, durationMinutes: parseInt(duration) }),
      });
      if (r.ok) {
        const { session } = await r.json();
        setActiveSessionMap(prev => ({ ...prev, [cl.id]: session }));
      }
    } catch (e: any) { alert("Could not get GPS location: " + e.message); }
    setActivating(null);
  };

  const fetchLive = async (sessionId: string) => {
    const token = await getToken();
    const r = await fetch(`${BACKEND}/api/attendance/live/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { const data = await r.json(); setLiveData(prev => ({ ...prev, [sessionId]: data })); }
  };

  const manualMark = async (sessionId: string, studentId: string) => {
    const key = `${sessionId}-${studentId}`;
    setManualMarking(m => ({ ...m, [key]: true }));
    const token = await getToken();
    await fetch(`${BACKEND}/api/attendance/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, studentId, status: "present" }),
    });
    await fetchLive(sessionId);
    setManualMarking(m => ({ ...m, [key]: false }));
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-gray-400 py-10"><Loader2 size={16} className="animate-spin" /> Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Today is <strong>{todayName}</strong></p>
          <p className="text-xs text-gray-400 mt-0.5">Only your classes scheduled for today are shown below</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Duration:</label>
          <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" value={duration} onChange={e => setDuration(e.target.value)}>
            {["15","30","45","60","90","120"].map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
      </div>

      {todayClasses.length === 0 ? (
        <div className="rounded-3xl border border-gray-100 p-10 flex flex-col items-center text-center">
          <Radio size={32} className="text-gray-200 mb-4" strokeWidth={1.5} />
          <p className="text-gray-400">No classes scheduled for today</p>
          <p className="text-sm text-gray-400 mt-1">Check the timetable set by admin for your courses.</p>
        </div>
      ) : (
        todayClasses.map(cl => {
          const session = activeSessionMap[cl.id];
          const live = session ? liveData[session.id] : null;
          const now = new Date();
          const isLive = session && new Date(session.opens_at) <= now && now <= new Date(session.closes_at);

          return (
            <div key={cl.id} className={`rounded-3xl border overflow-hidden ${isLive ? "border-green-200" : "border-gray-100"}`}>
              <div className={`flex items-center justify-between px-5 py-4 ${isLive ? "bg-green-50/40" : "bg-gray-50/50"}`}>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">{cl.course?.code}</span>
                    <span className="text-xs text-gray-400">{cl.course?.level} Level</span>
                    <span className="text-xs text-gray-400">{cl.start_time}–{cl.end_time}</span>
                    {cl.location?.name && <span className="text-xs text-gray-400">· {cl.location.name}</span>}
                  </div>
                  <p className="text-sm font-medium">{cl.course?.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">GPS radius: {cl.attendance_radius || 10}m</p>
                </div>
                <div className="flex items-center gap-2">
                  {isLive ? (
                    <>
                      <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">🟢 Live</span>
                      <button onClick={() => fetchLive(session.id)} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">Refresh Roll</button>
                    </>
                  ) : (
                    <button
                      onClick={() => activateAttendance(cl)}
                      disabled={activating === cl.id}
                      className="flex items-center gap-1.5 bg-green-500 text-white rounded-xl px-4 py-2 text-xs font-medium hover:bg-green-600 transition disabled:opacity-50"
                    >
                      {activating === cl.id ? <Loader2 size={12} className="animate-spin" /> : <Radio size={12} />}
                      {activating === cl.id ? "Starting..." : "Activate Attendance"}
                    </button>
                  )}
                </div>
              </div>

              {/* Live roll-call */}
              {isLive && live && (
                <div className="px-5 pb-5 pt-3 space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-700 font-medium">✅ Present: {live.presentCount}</span>
                    <span className="text-red-500 font-medium">❌ Absent: {live.absentCount}</span>
                  </div>

                  {/* Present students */}
                  {live.present?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Present</p>
                      <div className="space-y-1.5">
                        {live.present.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-sm bg-green-50/50 rounded-xl px-3 py-2">
                            <div className="h-7 w-7 rounded-full bg-green-100 overflow-hidden shrink-0">
                              {r.users?.avatar_url ? <img src={r.users.avatar_url} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-green-700">{r.users?.full_name?.charAt(0)}</span>}
                            </div>
                            <span className="flex-1">{r.users?.full_name} <span className="text-gray-400 text-xs">· {r.users?.matric_number}</span></span>
                            {r.manually_added && <span className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">Manual</span>}
                            <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Absent students — with manual mark button */}
                  {live.absent?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Absent — Mark Manually if Complaint</p>
                      <div className="space-y-1.5">
                        {live.absent.map((u: any) => {
                          const key = `${session.id}-${u.id}`;
                          return (
                            <div key={u.id} className="flex items-center gap-2 text-sm bg-red-50/30 rounded-xl px-3 py-2">
                              <div className="h-7 w-7 rounded-full bg-gray-100 overflow-hidden shrink-0">
                                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500">{u.full_name?.charAt(0)}</span>}
                              </div>
                              <span className="flex-1">{u.full_name} <span className="text-gray-400 text-xs">· {u.matric_number}</span></span>
                              <button
                                onClick={() => manualMark(session.id, u.id)}
                                disabled={manualMarking[key]}
                                className="text-xs bg-[#0a0a0a] text-white rounded-lg px-2.5 py-1 hover:bg-gray-800 transition disabled:opacity-50"
                              >
                                {manualMarking[key] ? <Loader2 size={11} className="animate-spin inline" /> : "Mark Present"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!live.present?.length && !live.absent?.length && (
                    <p className="text-sm text-gray-400">No enrolled students yet.</p>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}


/* ─── Assignments Manager ─── */
function AssignmentsManager({ profile }: any) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [form, setForm] = useState({ courseId: "", title: "", description: "", deadline: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data: c } = await supabase.from("courses").select("id, code, title").eq("lecturer_id", profile.id);
      setCourses(c || []);
      if (c && c.length > 0) {
        const { data: a } = await supabase
          .from("assignments")
          .select("*, courses(code)")
          .in("course_id", c.map((x: any) => x.id))
          .order("created_at", { ascending: false });
        setAssignments(a || []);
      }
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId || !form.title.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("assignments")
      .insert({
        course_id: form.courseId,
        title: form.title,
        description: form.description || null,
        deadline: form.deadline || null,
        created_by: profile.id,
      })
      .select("*, courses(code)")
      .single();
    if (data) setAssignments([data, ...assignments]);
    setForm({ courseId: "", title: "", description: "", deadline: "" });
    setSaving(false);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={handleCreate} className="rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-medium">Create assignment</h2>
          <p className="text-sm text-gray-400">Publish a new task for students</p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Course</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value })}
          >
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.title}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Title</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
            placeholder="Assignment title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Description (optional)</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-green-400/30 resize-none"
            placeholder="Assignment details..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Deadline (optional)</label>
          <input
            type="datetime-local"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </div>

        <button
          type="submit"
          disabled={saving || !form.courseId || !form.title.trim()}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {saving ? "Publishing..." : "Publish assignment"}
        </button>
      </form>

      <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-lg font-medium">Published assignments</h2>
        <p className="text-sm text-gray-400 mb-6">All tasks you've created</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Loading...
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-gray-400">No assignments yet.</p>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a: any) => {
              const overdue = a.deadline && new Date(a.deadline) < new Date();
              return (
                <li key={a.id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-green-700 font-medium">{a.courses?.code}</p>
                      <p className="text-sm font-medium mt-0.5">{a.title}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${overdue ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                      {a.deadline
                        ? `${overdue ? "Closed" : "Due"} ${new Date(a.deadline).toLocaleDateString([], { month: "short", day: "numeric" })}`
                        : "No deadline"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Complaints Manager ─── */
function ComplaintsManager({ profile }: any) {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("complaints")
        .select("*, student:users!student_id(full_name), courses(code)")
        .eq("lecturer_id", profile.id)
        .order("created_at", { ascending: false });
      setComplaints(data || []);
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  const handleReply = async (id: string) => {
    const reply = replies[id]?.trim();
    if (!reply) return;
    setSaving(id);
    await supabase.from("complaints").update({ reply, status: "resolved" }).eq("id", id);
    setComplaints((prev) =>
      prev.map((c) => c.id === id ? { ...c, reply, status: "resolved" } : c)
    );
    setSaving(null);
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
      <Loader2 size={16} className="animate-spin" /> Loading complaints...
    </div>
  );

  if (complaints.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-100 p-16 flex flex-col items-center text-center">
        <CheckCircle2 size={32} className="text-gray-200 mb-4" />
        <p className="text-gray-400">No complaints received</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {complaints.map((c: any) => (
        <div key={c.id} className="rounded-3xl border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium">{c.subject}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                From {c.student?.full_name || "—"}{c.courses?.code ? ` · ${c.courses.code}` : ""}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${c.status === "resolved" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {c.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 bg-gray-50 rounded-2xl px-4 py-3 mb-4">{c.message}</p>
          {c.reply ? (
            <p className="text-xs text-gray-500 italic">Your reply: {c.reply}</p>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type a reply..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
                value={replies[c.id] || ""}
                onChange={(e) => setReplies({ ...replies, [c.id]: e.target.value })}
              />
              <button
                onClick={() => handleReply(c.id)}
                disabled={saving === c.id}
                className="flex items-center gap-1 bg-[#0a0a0a] text-white rounded-xl px-4 py-2 text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50"
              >
                {saving === c.id ? <Loader2 size={12} className="animate-spin" /> : null}
                Reply
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Announcements Manager ─── */
function AnnouncementsManager({ profile }: any) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", body: "", type: "announcement", target_role: "all", target_level: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setAnnouncements(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("announcements")
      .insert({
        title: form.title,
        body: form.body,
        type: form.type,
        target_role: form.target_role || null,
        target_level: form.target_level || null,
        created_by: profile?.id,
      })
      .select()
      .single();
    if (data) setAnnouncements([data, ...announcements]);
    setForm({ title: "", body: "", type: "announcement", target_role: "all", target_level: "" });
    setSaving(false);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={handlePost} className="rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-medium">Post announcement</h2>
          <p className="text-sm text-gray-400">Broadcast a message to students</p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Title</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
            placeholder="Announcement title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Body</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-green-400/30 resize-none"
            placeholder="Message content..."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">Type</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="announcement">Announcement</option>
              <option value="news">News</option>
              <option value="alert">Alert</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Target Level</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              value={form.target_level}
              onChange={(e) => setForm({ ...form, target_level: e.target.value })}
            >
              <option value="">All levels</option>
              <option value="100">100 Level</option>
              <option value="200">200 Level</option>
              <option value="300">300 Level</option>
              <option value="400">400 Level</option>
              <option value="500">500 Level</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !form.title.trim() || !form.body.trim()}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
          {saving ? "Posting..." : "Post announcement"}
        </button>
      </form>

      <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-lg font-medium">Recent announcements</h2>
        <p className="text-sm text-gray-400 mb-6">Last 20 posts</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Loading...
          </div>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-gray-400">No announcements yet.</p>
        ) : (
          <ul className="space-y-3">
            {announcements.map((a: any) => (
              <li key={a.id} className="border border-gray-100 rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium">{a.title}</p>
                  <span className="text-xs text-gray-400 shrink-0 ml-3">
                    {new Date(a.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
