"use client";

import { useEffect, useState } from "react";
import {
  LayoutGrid, Users, BookOpen, MapPin, Megaphone, BarChart3,
  Loader2, CheckCircle2, XCircle, Plus, Trash2, X, Eye, Radio, Download, Calendar, Lock, Unlock, Navigation
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GridBackground from "@/components/ui/GridBackground";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "users", label: "Manage Users", icon: Users },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "classes", label: "Set Class", icon: Calendar },
  { key: "locations", label: "Locations", icon: MapPin },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "attendance", label: "Attendance", icon: Radio },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [active, setActive] = useState("overview");

  return (
    <DashboardLayout
      tabs={TABS}
      active={active}
      setActive={setActive}
      title="Admin Dashboard"
      portalLabel="Control Centre"
    >
      {active === "overview" && <AdminOverview />}
      {active === "users" && <UsersManager />}
      {active === "courses" && <CoursesManager />}
      {active === "classes" && <SetClass />}
      {active === "locations" && <LocationsManager />}
      {active === "announcements" && <AnnouncementsManager profile={profile} />}
      {active === "attendance" && <AdminAttendance />}
      {active === "analytics" && <Analytics />}
    </DashboardLayout>
  );
}

/* ─── Admin Overview ─── */
function AdminOverview() {
  const [stats, setStats] = useState({ students: 0, lecturers: 0, courses: 0, pending: 0 });

  useEffect(() => {
    const load = async () => {
      const [{ count: s }, { count: l }, { count: c }, { count: p }] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "lecturer"),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "pending_approval"),
      ]);
      setStats({ students: s || 0, lecturers: l || 0, courses: c || 0, pending: p || 0 });
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="relative bg-[#0a0a0a] text-white rounded-3xl p-6 sm:p-10 overflow-hidden">
        <GridBackground size={40} />
        <p className="relative text-sm text-white/40 mb-2">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h2 className="relative text-2xl sm:text-3xl font-medium mb-6">
          Admin{" "}
          <span className="font-voice italic font-normal text-green-400">Command Centre</span>
        </h2>
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Students", value: String(stats.students) },
            { label: "Lecturers", value: String(stats.lecturers) },
            { label: "Courses", value: String(stats.courses) },
            { label: "Pending approval", value: String(stats.pending), alert: stats.pending > 0 },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl p-4 min-h-[76px] flex flex-col justify-between ${(s as any).alert ? "bg-amber-400/10" : "bg-white/5"}`}>
              <p className="text-xs text-white/40 mb-1 leading-snug">{s.label}</p>
              <p className={`text-xl font-medium ${(s as any).alert ? "text-amber-400" : "text-green-400"}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {stats.pending > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="font-medium text-amber-900 mb-1">⚠️ {stats.pending} lecturer{stats.pending !== 1 ? "s" : ""} awaiting approval</h3>
          <p className="text-sm text-amber-700">
            Visit the <strong>Manage Users</strong> tab to review and approve or reject pending lecturer accounts.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Users Manager ─── */
function UsersManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending_approval" | "student" | "lecturer">("all");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("users").select("*").order("created_at", { ascending: false });
    if (filter === "pending_approval") q = q.eq("status", "pending_approval");
    else if (filter === "student") q = q.eq("role", "student");
    else if (filter === "lecturer") q = q.eq("role", "lecturer");
    const { data } = await q;
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const approve = async (userId: string) => {
    setActing(userId);
    await supabase.from("users").update({ status: "active" }).eq("id", userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: "active" } : u));
    setActing(null);
  };

  const ban = async (userId: string, currentStatus: string) => {
    setActing(userId);
    const newStatus = currentStatus === "banned" ? "active" : "banned";
    await supabase.from("users").update({ status: newStatus }).eq("id", userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u));
    setActing(null);
  };

  const setLevel = async (userId: string, level: string) => {
    setActing(userId);
    await supabase.from("users").update({ level }).eq("id", userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, level } : u));
    setActing(null);
  };

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 w-fit">
        {(["all", "pending_approval", "student", "lecturer"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filter === f ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
          >
            {f === "pending_approval" ? "Pending" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
          <Loader2 size={16} className="animate-spin" /> Loading users...
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u: any) => (
            <div key={u.id} className="rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      u.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.email} · <span className="capitalize">{u.role}</span>{u.level ? ` · ${u.level} Level` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
                    u.status === "active" ? "bg-green-50 text-green-700"
                    : u.status === "banned" ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-700"
                  }`}>
                    {u.status.replace("_", " ")}
                  </span>
                  {/* Level selector for students */}
                  {u.role === "student" && (
                    <select
                      value={u.level || ""}
                      onChange={(e) => setLevel(u.id, e.target.value)}
                      disabled={acting === u.id}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-400/50 disabled:opacity-50"
                    >
                      <option value="">Set level</option>
                      {["100","200","300","400","500"].map((l) => (
                        <option key={l} value={l}>{l} Level</option>
                      ))}
                    </select>
                  )}
                  {u.status === "pending_approval" && (
                    <button
                      onClick={() => approve(u.id)}
                      disabled={acting === u.id}
                      className="flex items-center gap-1 bg-green-500 text-white rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-green-600 transition disabled:opacity-50"
                    >
                      {acting === u.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Approve
                    </button>
                  )}
                  {u.role !== "admin" && (
                    <button
                      onClick={() => ban(u.id, u.status)}
                      disabled={acting === u.id}
                      className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                        u.status === "banned"
                          ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          : "bg-red-50 text-red-600 hover:bg-red-100"
                      }`}
                    >
                      {u.status === "banned" ? "Unban" : "Ban"}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl px-3 py-1.5 text-xs font-medium transition"
                  >
                    <Eye size={12} />
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No users found in this category.</p>
          )}
        </div>
      )}

      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}

/* ─── User Detail Modal Component ─── */
function UserDetailModal({ user, onClose }: { user: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-medium">User Profile Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Avatar and Primary Identity */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:items-start text-center sm:text-left pb-6 border-b border-gray-100">
            <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600 overflow-hidden shrink-0 border border-gray-200">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"
              )}
            </div>
            <div>
              <h4 className="text-xl font-medium">{user.full_name || "—"}</h4>
              <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize bg-gray-100 text-gray-700">
                  {user.role}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                  user.status === "active" ? "bg-green-50 text-green-700"
                  : user.status === "banned" ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-700"
                }`}>
                  {user.status?.replace("_", " ") || "—"}
                </span>
                {user.level && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-50 text-green-700">
                    {user.level} Level
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-400 font-medium mb-1">Department</p>
              <p className="text-sm font-medium">{user.department || "Computer Engineering"}</p>
            </div>
            <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-400 font-medium mb-1">Phone Number</p>
              <p className="text-sm font-medium">{user.phone || "—"}</p>
            </div>

            {user.role === "student" ? (
              <>
                <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-400 font-medium mb-1">Matric Number</p>
                  <p className="text-sm font-medium">{user.matric_number || "—"}</p>
                </div>
                <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-400 font-medium mb-1">Academic Adviser</p>
                  <p className="text-sm font-medium">{user.academic_adviser || "—"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-400 font-medium mb-1">Staff ID</p>
                  <p className="text-sm font-medium">{user.staff_id || "—"}</p>
                </div>
                <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-400 font-medium mb-1">Office Location</p>
                  <p className="text-sm font-medium">{user.office || "—"}</p>
                </div>
              </>
            )}

            <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100/50 col-span-2">
              <p className="text-xs text-gray-400 font-medium mb-1">Date Joined</p>
              <p className="text-sm font-medium">
                {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                }) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="bg-[#0a0a0a] text-white hover:bg-gray-800 rounded-full px-5 py-2.5 text-sm font-medium transition"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Courses Manager ─── */
function CoursesManager() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const [courses, setCourses] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [form, setForm] = useState({ code: "", title: "", level: "100", semester: "1", lecturerId: "", credit_units: "3" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [timetableForm, setTimetableForm] = useState({ day: "Monday", start_time: "08:00", end_time: "10:00", location_id: "", latitude: "", longitude: "", attendance_radius: "10" });
  const [savingSlot, setSavingSlot] = useState(false);
  const [assigningLecturer, setAssigningLecturer] = useState<{ [key: string]: string }>({});

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const load = async () => {
    const [{ data: c }, { data: l }, { data: loc }] = await Promise.all([
      supabase.from("courses").select("*, lecturer:users!lecturer_id(id, full_name), classes(id, day, start_time, end_time, venue, latitude, longitude, attendance_radius, location:locations(name))").order("level").order("code"),
      supabase.from("users").select("id, full_name").eq("role", "lecturer").eq("status", "active"),
      supabase.from("locations").select("id, name, building, latitude, longitude").order("name"),
    ]);
    setCourses(c || []);
    setLecturers(l || []);
    setLocations(loc || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.title) return;
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`${BACKEND}/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: form.code.toUpperCase(), title: form.title, level: form.level, semester: parseInt(form.semester), lecturer_id: form.lecturerId || null, credit_units: parseInt(form.credit_units) }),
    });
    if (res.ok) {
      setForm({ code: "", title: "", level: "100", semester: "1", lecturerId: "", credit_units: "3" });
      await load();
    }
    setSaving(false);
  };

  const assignLecturer = async (courseId: string, lecturerId: string) => {
    const token = await getToken();
    await fetch(`${BACKEND}/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lecturer_id: lecturerId || null }),
    });
    await load();
  };

  const deleteCourse = async (id: string) => {
    await supabase.from("courses").delete().eq("id", id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const addTimetableSlot = async (courseId: string) => {
    setSavingSlot(true);
    const token = await getToken();
    const loc = locations.find(l => l.id === timetableForm.location_id);
    await fetch(`${BACKEND}/api/courses/${courseId}/timetable`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        day: timetableForm.day,
        start_time: timetableForm.start_time,
        end_time: timetableForm.end_time,
        location_id: timetableForm.location_id || null,
        latitude: timetableForm.latitude ? parseFloat(timetableForm.latitude) : (loc?.latitude ?? null),
        longitude: timetableForm.longitude ? parseFloat(timetableForm.longitude) : (loc?.longitude ?? null),
        attendance_radius: parseFloat(timetableForm.attendance_radius) || 10,
      }),
    });
    await load();
    setSavingSlot(false);
  };

  const deleteSlot = async (courseId: string, slotId: string) => {
    const token = await getToken();
    await fetch(`${BACKEND}/api/courses/${courseId}/timetable/${slotId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="space-y-6">
      {/* Add course form */}
      <form onSubmit={handleCreate} className="rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-medium">Add Course</h2>
          <p className="text-sm text-gray-400">Create and assign a new department course</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">Course Code</label>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30 uppercase" placeholder="CPE 301" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Level</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              {["100","200","300","400","500"].map(l => <option key={l} value={l}>{l} Level</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Semester</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">Title</label>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" placeholder="e.g. Digital Electronics" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Assign Lecturer</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.lecturerId} onChange={(e) => setForm({ ...form, lecturerId: e.target.value })}>
              <option value="">Unassigned</option>
              {lecturers.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={saving || !form.code || !form.title} className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {saving ? "Adding..." : "Add Course"}
        </button>
      </form>

      {/* Course list */}
      <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-lg font-medium mb-1">Registered Courses</h2>
        <p className="text-sm text-gray-400 mb-5">{courses.length} total · Click a course to manage timetable</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading...</div>
        ) : (
          <div className="space-y-3">
            {courses.map((c: any) => (
              <div key={c.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                {/* Course row */}
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition" onClick={() => setExpandedCourse(expandedCourse === c.id ? null : c.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">{c.code}</span>
                    <span className="text-xs text-gray-400">{c.level} Level · Sem {c.semester}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-1">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {/* Reassign lecturer inline */}
                    <select
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      value={assigningLecturer[c.id] ?? (c.lecturer?.id || "")}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { setAssigningLecturer({ ...assigningLecturer, [c.id]: e.target.value }); assignLecturer(c.id, e.target.value); }}
                    >
                      <option value="">Unassigned</option>
                      {lecturers.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
                    </select>
                    <span className="text-xs text-gray-400 hidden sm:block">{(c.classes || []).length} slots</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteCourse(c.id); }} className="text-gray-300 hover:text-red-500 transition p-1"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Expanded timetable section */}
                {expandedCourse === c.id && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-4">
                    {/* Existing slots */}
                    {(c.classes || []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timetable Slots</p>
                        {c.classes.map((slot: any) => (
                          <div key={slot.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-2.5 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-[#0a0a0a]">{slot.day}</span>
                              <span className="text-gray-500">{slot.start_time} – {slot.end_time}</span>
                              <span className="text-gray-400 text-xs">{slot.location?.name || slot.venue || "No venue"}</span>
                              {slot.latitude && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">GPS ✓ {slot.attendance_radius}m</span>}
                            </div>
                            <button onClick={() => deleteSlot(c.id, slot.id)} className="text-gray-300 hover:text-red-500 transition p-1"><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add slot form */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add Timetable Slot</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Day</label>
                          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={timetableForm.day} onChange={e => setTimetableForm({ ...timetableForm, day: e.target.value })}>
                            {DAYS.map(d => <option key={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Start Time</label>
                          <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={timetableForm.start_time} onChange={e => setTimetableForm({ ...timetableForm, start_time: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">End Time</label>
                          <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={timetableForm.end_time} onChange={e => setTimetableForm({ ...timetableForm, end_time: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Location</label>
                          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={timetableForm.location_id} onChange={e => { const loc = locations.find(l => l.id === e.target.value); setTimetableForm({ ...timetableForm, location_id: e.target.value, latitude: loc?.latitude?.toString() || "", longitude: loc?.longitude?.toString() || "" }); }}>
                            <option value="">Custom / Manual GPS</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name} — {l.building}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">GPS Latitude</label>
                          <input type="number" step="any" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="6.9038" value={timetableForm.latitude} onChange={e => setTimetableForm({ ...timetableForm, latitude: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">GPS Longitude</label>
                          <input type="number" step="any" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="3.9298" value={timetableForm.longitude} onChange={e => setTimetableForm({ ...timetableForm, longitude: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-36">
                          <label className="text-xs text-gray-500 mb-1 block">Radius (metres)</label>
                          <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={timetableForm.attendance_radius} onChange={e => setTimetableForm({ ...timetableForm, attendance_radius: e.target.value })} />
                        </div>
                        <button onClick={() => addTimetableSlot(c.id)} disabled={savingSlot} className="mt-5 flex items-center gap-2 bg-[#0a0a0a] text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
                          {savingSlot ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add Slot
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Set Class — Admin assigns class slots to courses ─── */
function SetClass() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const [courses, setCourses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    courseId: "", day: "Monday", start_time: "08:00", end_time: "10:00",
    location_id: "", venue: "", latitude: "", longitude: "", attendance_radius: "5"
  });

  const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const load = async () => {
    const [{ data: c }, { data: loc }] = await Promise.all([
      supabase.from("courses").select("id, code, title, level, semester, lecturer:users!lecturer_id(full_name), classes(id, day, start_time, end_time, venue, latitude, longitude, attendance_radius, location:locations(name))").order("level").order("code"),
      supabase.from("locations").select("id, name, building, latitude, longitude").order("name"),
    ]);
    setCourses(c || []);
    setLocations(loc || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId) return;
    setSaving(true);
    const token = await getToken();
    const loc = locations.find(l => l.id === form.location_id);
    const res = await fetch(`${BACKEND}/api/courses/${form.courseId}/timetable`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        day: form.day, start_time: form.start_time, end_time: form.end_time,
        location_id: form.location_id || null, venue: form.venue || null,
        latitude: form.latitude ? parseFloat(form.latitude) : (loc?.latitude ?? null),
        longitude: form.longitude ? parseFloat(form.longitude) : (loc?.longitude ?? null),
        attendance_radius: parseFloat(form.attendance_radius) || 5,
      }),
    });
    if (res.ok) {
      setForm({ courseId: "", day: todayName, start_time: "08:00", end_time: "10:00", location_id: "", venue: "", latitude: "", longitude: "", attendance_radius: "5" });
      await load();
    }
    setSaving(false);
  };

  const handleDelete = async (courseId: string, slotId: string) => {
    const token = await getToken();
    await fetch(`${BACKEND}/api/courses/${courseId}/timetable/${slotId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-medium">Set a Class</h2>
          <p className="text-sm text-gray-400">Assign a class slot (timetable) to a course with day, time, and location</p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Course</label>
          <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} required>
            <option value="">Select a course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title} ({c.level} Level)</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">Day</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
              {DAYS.map(d => <option key={d} value={d}>{d} {d === todayName ? "(Today)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Start Time</label>
            <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">End Time</label>
            <input type="time" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">Location (Predefined)</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.location_id} onChange={e => {
              const loc = locations.find(l => l.id === e.target.value);
              setForm({ ...form, location_id: e.target.value, latitude: loc?.latitude?.toString() || "", longitude: loc?.longitude?.toString() || "" });
            }}>
              <option value="">Custom / Manual GPS</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name} — {l.building}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Custom Venue Name</label>
            <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" placeholder="e.g. ETF Hall" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">GPS Latitude</label>
            <input type="number" step="any" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" placeholder="6.9038" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">GPS Longitude</label>
            <input type="number" step="any" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" placeholder="3.9298" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Attendance Radius (m)</label>
            <input type="number" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.attendance_radius} onChange={e => setForm({ ...form, attendance_radius: e.target.value })} />
          </div>
        </div>

        <button type="submit" disabled={saving || !form.courseId} className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {saving ? "Saving..." : "Set Class"}
        </button>
      </form>

      {/* All classes across all courses */}
      <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-lg font-medium mb-1">All Scheduled Classes</h2>
        <p className="text-sm text-gray-400 mb-5">{courses.reduce((acc: number, c: any) => acc + (c.classes?.length || 0), 0)} total slots across {courses.length} courses</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" /> Loading...</div>
        ) : (
          <div className="space-y-3">
            {courses.map((c: any) => (
              <div key={c.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">{c.code}</span>
                    <span className="text-sm font-medium">{c.title}</span>
                    <span className="text-xs text-gray-400">{c.level} Level · {c.lecturer?.full_name || "No lecturer"}</span>
                  </div>
                  <span className="text-xs text-gray-400">{(c.classes || []).length} slots</span>
                </div>
                {(c.classes || []).length > 0 ? (
                  <div className="p-4 space-y-2">
                    {c.classes.map((slot: any) => (
                      <div key={slot.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-[#0a0a0a]">{slot.day}</span>
                          <span className="text-gray-500">{slot.start_time} – {slot.end_time}</span>
                          <span className="text-gray-400 text-xs">{slot.location?.name || slot.venue || "No venue"}</span>
                          {slot.latitude && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">GPS {slot.attendance_radius}m</span>}
                        </div>
                        <button onClick={() => handleDelete(c.id, slot.id)} className="text-gray-300 hover:text-red-500 transition p-1"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-xs text-gray-400 italic">No class slots set yet</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Locations Manager ─── */
function LocationsManager() {
  const [locations, setLocations] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", building: "", latitude: "", longitude: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("locations").select("*").order("building");
      setLocations(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.latitude || !form.longitude) return;
    setSaving(true);
    const { data } = await supabase
      .from("locations")
      .insert({
        name: form.name,
        building: form.building || null,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      })
      .select()
      .single();
    if (data) setLocations([data, ...locations]);
    setForm({ name: "", building: "", latitude: "", longitude: "" });
    setSaving(false);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={handleCreate} className="rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-medium">Add location</h2>
          <p className="text-sm text-gray-400">Register a classroom or lab with GPS coordinates</p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Room name</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
            placeholder="e.g. LT 1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Building</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
            placeholder="e.g. Engineering Block A"
            value={form.building}
            onChange={(e) => setForm({ ...form, building: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">Latitude</label>
            <input
              type="number"
              step="any"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              placeholder="6.8924"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Longitude</label>
            <input
              type="number"
              step="any"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"
              placeholder="3.7172"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !form.name || !form.latitude || !form.longitude}
          className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          {saving ? "Saving..." : "Save location"}
        </button>
      </form>

      <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-lg font-medium">Campus locations</h2>
        <p className="text-sm text-gray-400 mb-6">{locations.length} registered venues</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Loading...
          </div>
        ) : (
          <ul className="space-y-3 max-h-[400px] overflow-y-auto">
            {locations.map((loc: any) => (
              <li key={loc.id} className="border border-gray-100 rounded-2xl p-3">
                <p className="text-sm font-medium">{loc.name}</p>
                <p className="text-xs text-gray-400">{loc.building}</p>
                <p className="text-xs text-gray-300 mt-1 font-mono">{loc.latitude}, {loc.longitude}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Announcements Manager (same as lecturer's) ─── */
function AnnouncementsManager({ profile }: any) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", body: "", type: "announcement" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(20);
      setAnnouncements(data || []);
    };
    load();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    const { data } = await supabase.from("announcements").insert({ ...form, created_by: profile?.id }).select().single();
    if (data) setAnnouncements([data, ...announcements]);
    setForm({ title: "", body: "", type: "announcement" });
    setSaving(false);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={handlePost} className="rounded-3xl border border-gray-100 p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-medium">Post department announcement</h2>
          <p className="text-sm text-gray-400">Broadcast to all students and staff</p>
        </div>
        <div>
          <label className="text-sm font-medium block mb-2">Title</label>
          <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" placeholder="Announcement title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium block mb-2">Body</label>
          <textarea className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-green-400/30" placeholder="Message content..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium block mb-2">Type</label>
          <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="announcement">Announcement</option>
            <option value="news">News</option>
            <option value="alert">Alert</option>
          </select>
        </div>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
          {saving ? "Posting..." : "Post"}
        </button>
      </form>

      <div className="rounded-3xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-lg font-medium">Recent posts</h2>
        <p className="text-sm text-gray-400 mb-6">Last 20 announcements</p>
        <ul className="space-y-3 max-h-[400px] overflow-y-auto">
          {announcements.map((a: any) => (
            <li key={a.id} className="border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium">{a.title}</p>
                <span className="text-xs text-gray-400 shrink-0 ml-3">{new Date(a.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Admin Attendance ─── */
function AdminAttendance() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [activeSessionMap, setActiveSessionMap] = useState<{ [classId: string]: any }>({});
  const [liveData, setLiveData] = useState<{ [sessionId: string]: any }>({});
  const [manualMarking, setManualMarking] = useState<{ [key: string]: boolean }>({});
  const [duration, setDuration] = useState("60");
  const [useMyLocation, setUseMyLocation] = useState(true);
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [lockToggling, setLockToggling] = useState<string | null>(null);

  const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const loadCourses = async () => {
    const { data } = await supabase
      .from("courses")
      .select("id, code, title, level, lecturer:users!lecturer_id(full_name), classes(id, day, start_time, end_time, attendance_radius, latitude, longitude, location:locations(name))")
      .order("level")
      .order("code");
    setAllCourses(data || []);
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, []);

  const todayClasses = allCourses.flatMap(c =>
    (c.classes || []).filter((cl: any) => cl.day === todayName).map((cl: any) => ({ ...cl, course: c }))
  );

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
  }, [allCourses]);

  const fetchMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationLoading(false);
      },
      (err) => {
        alert("Could not get your location: " + err.message);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (useMyLocation) fetchMyLocation();
  }, [useMyLocation]);

  const activateAttendance = async (cl: any) => {
    setActivating(cl.id);
    try {
      let lat: number, lon: number;
      if (useMyLocation && myLocation) {
        lat = myLocation.lat;
        lon = myLocation.lon;
      } else {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }
      const token = await getToken();
      const r = await fetch(`${BACKEND}/api/attendance/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ classId: cl.id, latitude: lat, longitude: lon, durationMinutes: parseInt(duration) }),
      });
      if (r.ok) {
        const { session } = await r.json();
        setActiveSessionMap(prev => ({ ...prev, [cl.id]: session }));
      }
    } catch (e: any) { alert("Could not activate attendance: " + e.message); }
    setActivating(null);
  };

  const fetchLive = async (sessionId: string) => {
    const token = await getToken();
    const r = await fetch(`${BACKEND}/api/attendance/live/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { const data = await r.json(); setLiveData(prev => ({ ...prev, [sessionId]: data })); }
  };

  const toggleLock = async (sessionId: string) => {
    setLockToggling(sessionId);
    try {
      const token = await getToken();
      const r = await fetch(`${BACKEND}/api/attendance/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
      if (r.ok) {
        const { is_locked } = await r.json();
        setLiveData(prev => {
          const existing = prev[sessionId];
          if (existing) {
            return { ...prev, [sessionId]: { ...existing, isLocked: is_locked, session: { ...existing.session, is_locked } } };
          }
          return prev;
        });
        setActiveSessionMap(prev => {
          const updated = { ...prev };
          for (const [k, v] of Object.entries(updated)) {
            if (v?.id === sessionId) updated[k] = { ...v, is_locked };
          }
          return updated;
        });
      }
    } catch (e: any) { alert("Failed to toggle lock: " + e.message); }
    setLockToggling(null);
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

  const downloadCsv = (sessionId: string) => {
    window.open(`${BACKEND}/api/attendance/csv/${sessionId}`, "_blank");
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-gray-400 py-10"><Loader2 size={16} className="animate-spin" /> Loading courses...</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Today is <strong>{todayName}</strong></p>
            <p className="text-xs text-gray-400 mt-0.5">All classes scheduled for today across every course</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Duration:</label>
            <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" value={duration} onChange={e => setDuration(e.target.value)}>
              {["15","30","45","60","90","120"].map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
        </div>

        {/* Use My Location Toggle */}
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 flex-1">
            <Navigation size={14} className="text-green-600" />
            <span className="text-xs font-medium">Use My Current Location</span>
            <span className="text-[10px] text-gray-400">(GPS for attendance — 5m radius)</span>
          </div>
          <button
            onClick={() => setUseMyLocation(!useMyLocation)}
            className={`relative w-10 h-5 rounded-full transition ${useMyLocation ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition ${useMyLocation ? "translate-x-5" : ""}`} />
          </button>
          {useMyLocation && myLocation && (
            <span className="text-[10px] text-green-600 font-mono bg-green-50 px-2 py-0.5 rounded">
              {myLocation.lat.toFixed(5)}, {myLocation.lon.toFixed(5)}
            </span>
          )}
          {useMyLocation && !myLocation && (
            <button onClick={fetchMyLocation} disabled={locationLoading} className="text-[10px] text-blue-600 hover:underline disabled:opacity-50">
              {locationLoading ? "Locating..." : "Get Location"}
            </button>
          )}
        </div>
      </div>

      {todayClasses.length === 0 ? (
        <div className="rounded-3xl border border-gray-100 p-10 flex flex-col items-center text-center">
          <Radio size={32} className="text-gray-200 mb-4" strokeWidth={1.5} />
          <p className="text-gray-400">No classes scheduled for today</p>
          <p className="text-sm text-gray-400 mt-1">Add timetable slots in the Courses tab first.</p>
        </div>
      ) : (
        todayClasses.map(cl => {
          const session = activeSessionMap[cl.id];
          const live = session ? liveData[session.id] : null;
          const now = new Date();
          const isLive = session && new Date(session.opens_at) <= now && now <= new Date(session.closes_at);
          const isLocked = live?.isLocked ?? session?.is_locked ?? false;

          return (
            <div key={cl.id} className={`rounded-3xl border overflow-hidden ${isLive ? (isLocked ? "border-amber-200" : "border-green-200") : "border-gray-100"}`}>
              <div className={`flex items-center justify-between px-5 py-4 ${isLive ? (isLocked ? "bg-amber-50/40" : "bg-green-50/40") : "bg-gray-50/50"}`}>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">{cl.course?.code}</span>
                    <span className="text-xs text-gray-400">{cl.course?.level} Level</span>
                    <span className="text-xs text-gray-400">{cl.start_time}–{cl.end_time}</span>
                    {cl.location?.name && <span className="text-xs text-gray-400">· {cl.location.name}</span>}
                  </div>
                  <p className="text-sm font-medium">{cl.course?.title}</p>
                  {cl.course?.lecturer?.full_name && <p className="text-xs text-gray-500 mt-0.5">Lecturer: {cl.course.lecturer.full_name}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">GPS radius: {cl.attendance_radius || 5}m</p>
                </div>
                <div className="flex items-center gap-2">
                  {isLive ? (
                    <>
                      {isLocked ? (
                        <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                          <Lock size={11} /> Locked
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                          <Unlock size={11} /> Live
                        </span>
                      )}
                      <button
                        onClick={() => toggleLock(session.id)}
                        disabled={lockToggling === session.id}
                        className={`flex items-center gap-1 text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50 transition disabled:opacity-50 ${isLocked ? "border-green-200 text-green-600" : "border-amber-200 text-amber-600"}`}
                      >
                        {lockToggling === session.id ? <Loader2 size={11} className="animate-spin" /> : (isLocked ? <Unlock size={11} /> : <Lock size={11} />)}
                        {isLocked ? "Unlock" : "Lock"}
                      </button>
                      <button onClick={() => fetchLive(session.id)} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">Refresh</button>
                      <button onClick={() => downloadCsv(session.id)} className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
                        <Download size={11} /> CSV
                      </button>
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

              {isLive && live && (
                <div className="px-5 pb-5 pt-3 space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-700 font-medium">Present: {live.presentCount}</span>
                    <span className="text-red-500 font-medium">Absent: {live.absentCount}</span>
                    {live.session?.latitude && live.session?.longitude && (
                      <span className="text-xs text-gray-400 font-mono">
                        Admin GPS: {live.session.latitude.toFixed(5)}, {live.session.longitude.toFixed(5)}
                      </span>
                    )}
                  </div>

                  {isLocked && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
                      <Lock size={13} />
                      Attendance is <strong>locked</strong> — students cannot mark attendance until you unlock it.
                    </div>
                  )}

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

                  {live.absent?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Absent — Mark Manually</p>
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

/* ─── Analytics ─── */
function Analytics() {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [
        { count: totalStudents },
        { count: totalLecturers },
        { count: totalCourses },
        { count: totalAssignments },
        { count: openComplaints },
        { count: resolvedComplaints },
        { count: attendanceSessions },
      ] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "lecturer"),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("assignments").select("*", { count: "exact", head: true }),
        supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "resolved"),
        supabase.from("attendance_sessions").select("*", { count: "exact", head: true }),
      ]);
      setStats({ totalStudents, totalLecturers, totalCourses, totalAssignments, openComplaints, resolvedComplaints, attendanceSessions });
      setLoading(false);
    };
    load();
  }, []);

  const items = [
    { label: "Total students", value: stats.totalStudents },
    { label: "Total lecturers", value: stats.totalLecturers },
    { label: "Courses registered", value: stats.totalCourses },
    { label: "Assignments published", value: stats.totalAssignments },
    { label: "Open complaints", value: stats.openComplaints },
    { label: "Resolved complaints", value: stats.resolvedComplaints },
    { label: "Attendance sessions", value: stats.attendanceSessions },
  ];

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-10">
      <Loader2 size={16} className="animate-spin" /> Loading analytics...
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-3xl border border-gray-100 p-6 text-center">
          <p className="text-3xl font-medium mb-1">{item.value ?? "—"}</p>
          <p className="text-sm text-gray-500">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
