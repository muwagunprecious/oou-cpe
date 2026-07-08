"use client";

import { useEffect, useState } from "react";
import {
  LayoutGrid, Calendar, Users, ClipboardList, Megaphone,
  Loader2, CheckCircle2, XCircle, Clock, Plus, Radio
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
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("courses")
        .select("*, classes(*, locations(name, building))")
        .eq("lecturer_id", profile.id);
      setCourses(data || []);
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
      <Loader2 size={16} className="animate-spin" /> Loading courses...
    </div>
  );

  return (
    <div className="space-y-4">
      {courses.length === 0 ? (
        <div className="rounded-3xl border border-gray-100 p-16 flex flex-col items-center text-center">
          <Calendar size={32} className="text-gray-200 mb-4" strokeWidth={1.5} />
          <p className="text-gray-400">No courses assigned yet. Contact the administrator.</p>
        </div>
      ) : (
        courses.map((course: any) => (
          <div key={course.id} className="rounded-3xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-1">{course.code}</span>
                <h3 className="font-medium mt-2">{course.title}</h3>
                <p className="text-sm text-gray-400">{course.level} Level · Semester {course.semester}</p>
              </div>
            </div>
            {course.classes?.length > 0 && (
              <div className="border-t border-gray-50 pt-4 space-y-2">
                {course.classes.map((cls: any) => (
                  <div key={cls.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{cls.day} · {cls.start_time}–{cls.end_time}</span>
                    <span className="text-gray-400">{cls.locations?.name || "Location TBD"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ─── Attendance Sessions ─── */
function AttendanceSessions({ profile }: any) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({ classId: "", duration: "60", radius: "75" });
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, code, title, classes(*, locations(name, latitude, longitude))")
        .eq("lecturer_id", profile.id);

      const allClasses: any[] = [];
      courses?.forEach((c: any) => {
        c.classes?.forEach((cls: any) => allClasses.push({ ...cls, courseCode: c.code, courseTitle: c.title }));
      });
      setClasses(allClasses);

      const classIds = allClasses.map((c) => c.id);
      if (classIds.length > 0) {
        const { data: sess } = await supabase
          .from("attendance_sessions")
          .select("*, classes(*, courses(code))")
          .in("class_id", classIds)
          .order("opens_at", { ascending: false })
          .limit(10);
        setSessions(sess || []);
      }
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.classId) return;
    setCreating(true);

    const selectedClass = classes.find((c) => c.id === form.classId);
    const opens = new Date();
    const closes = new Date(opens.getTime() + parseInt(form.duration) * 60 * 1000);

    await supabase.from("attendance_sessions").insert({
      class_id: form.classId,
      opens_at: opens.toISOString(),
      closes_at: closes.toISOString(),
      radius: parseInt(form.radius),
      latitude: selectedClass?.locations?.latitude,
      longitude: selectedClass?.locations?.longitude,
    });

    setCreating(false);
    setForm({ classId: "", duration: "60", radius: "75" });

    // Reload
    const classIds = classes.map((c) => c.id);
    const { data: sess } = await supabase
      .from("attendance_sessions")
      .select("*, classes(*, courses(code))")
      .in("class_id", classIds)
      .order("opens_at", { ascending: false })
      .limit(10);
    setSessions(sess || []);
  };

  const now = new Date();

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Open session form */}
      <form onSubmit={handleOpen} className="rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-medium">Open attendance window</h2>
          <p className="text-sm text-gray-400">Students will mark attendance via GPS within the set radius</p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Class</label>
          <select
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
            value={form.classId}
            onChange={(e) => setForm({ ...form, classId: e.target.value })}
          >
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.courseCode} · {c.day} {c.start_time}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">Duration (mins)</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            >
              {["15", "30", "45", "60", "90", "120"].map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">GPS Radius (m)</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              value={form.radius}
              onChange={(e) => setForm({ ...form, radius: e.target.value })}
            >
              <option value="50">50 m (tight)</option>
              <option value="75">75 m (default)</option>
              <option value="100">100 m</option>
              <option value="150">150 m (large hall)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={creating || !form.classId}
          className="flex items-center gap-2 bg-green-500 text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-green-600 transition disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
          {creating ? "Opening..." : "Open attendance"}
        </button>
      </form>

      {/* Recent sessions */}
      <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-lg font-medium">Recent sessions</h2>
        <p className="text-sm text-gray-400 mb-6">Last 10 attendance windows</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Loading...
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-400">No sessions opened yet.</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s: any) => {
              const active = new Date(s.opens_at) <= now && new Date(s.closes_at) >= now;
              return (
                <li key={s.id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{s.classes?.courses?.code}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {active ? "🟢 Live" : "Closed"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(s.opens_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" → "}
                    {new Date(s.closes_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" · "}{s.radius}m radius
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
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
