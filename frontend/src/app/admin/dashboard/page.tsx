"use client";

import { useEffect, useState } from "react";
import {
  LayoutGrid, Users, BookOpen, MapPin, Megaphone, BarChart3,
  Loader2, CheckCircle2, XCircle, Plus, Trash2, X, Eye
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GridBackground from "@/components/ui/GridBackground";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "users", label: "Manage Users", icon: Users },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "locations", label: "Locations", icon: MapPin },
  { key: "announcements", label: "Announcements", icon: Megaphone },
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
      {active === "locations" && <LocationsManager />}
      {active === "announcements" && <AnnouncementsManager profile={profile} />}
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
