import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { markAttendance, getLiveAttendance, manualMarkAttendance, activateSession } from "./controllers/attendance.controller.js";
import { askAssistant } from "./controllers/ai.controller.js";
import { submitAssignment, getSubmissions, gradeSubmission } from "./controllers/assignments.controller.js";
import { getComplaints, replyComplaint } from "./controllers/complaints.controller.js";
import { uploadAvatar } from "./controllers/users.controller.js";
import { getAllCourses, getMyCourses, getCourseEnrollments, createCourse, updateCourse, addTimetableSlot, removeTimetableSlot } from "./controllers/courses.controller.js";
import { getMyEnrollments, enrollInCourse, dropCourse } from "./controllers/enrollments.controller.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Multer — store uploads in memory then push to Supabase Storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    // Allow localhost for local dev
    if (origin.startsWith("http://localhost")) return callback(null, true);
    // Allow all Vercel preview and production deployments
    if (origin.endsWith(".vercel.app")) return callback(null, true);
    // Allow any other origins in development
    callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.options("*", cors());

app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// ── Attendance ────────────────────────────────────────────────────────────────
app.post("/api/attendance/checkin", requireAuth, requireRole(["student"]), markAttendance);
app.post("/api/attendance/check-in", requireAuth, requireRole(["student"]), markAttendance);
app.get("/api/attendance/live/:sessionId", requireAuth, requireRole(["lecturer", "admin"]), getLiveAttendance);
app.post("/api/attendance/activate", requireAuth, requireRole(["lecturer"]), activateSession);
app.post("/api/attendance/manual", requireAuth, requireRole(["lecturer", "admin"]), manualMarkAttendance);

// ── Courses ───────────────────────────────────────────────────────────────────
app.get("/api/courses", requireAuth, getAllCourses);
app.get("/api/courses/my", requireAuth, requireRole(["lecturer"]), getMyCourses);
app.get("/api/courses/:id/enrollments", requireAuth, requireRole(["lecturer", "admin"]), getCourseEnrollments);
app.post("/api/courses", requireAuth, requireRole(["admin"]), createCourse);
app.patch("/api/courses/:id", requireAuth, requireRole(["admin"]), updateCourse);
app.post("/api/courses/:id/timetable", requireAuth, requireRole(["admin", "lecturer"]), addTimetableSlot);
app.delete("/api/courses/:id/timetable/:slotId", requireAuth, requireRole(["admin", "lecturer"]), removeTimetableSlot);

// ── Enrollments ───────────────────────────────────────────────────────────────
app.get("/api/enrollments/my", requireAuth, requireRole(["student"]), getMyEnrollments);
app.post("/api/enrollments", requireAuth, requireRole(["student"]), enrollInCourse);
app.delete("/api/enrollments/:courseId", requireAuth, requireRole(["student"]), dropCourse);

// ── AI Chatbot ────────────────────────────────────────────────────────────────
// Frontend calls POST /api/ai/chat
app.post("/api/ai/chat", requireAuth, askAssistant);
// Legacy alias
app.post("/api/ai/ask", requireAuth, askAssistant);

// ── Assignments ───────────────────────────────────────────────────────────────
app.post("/api/assignments/submit", requireAuth, requireRole(["student"]), upload.single("file"), submitAssignment);
app.get("/api/assignments/:assignmentId/submissions", requireAuth, requireRole(["lecturer", "admin"]), getSubmissions);
app.patch("/api/assignments/submissions/:submissionId/grade", requireAuth, requireRole(["lecturer"]), gradeSubmission);

// ── Complaints ────────────────────────────────────────────────────────────────
app.get("/api/complaints", requireAuth, requireRole(["lecturer", "admin"]), getComplaints);
app.patch("/api/complaints/:id/reply", requireAuth, requireRole(["lecturer", "admin"]), replyComplaint);

// ── User Profile / Avatar ──────────────────────────────────────────────────────
app.post("/api/users/avatar", requireAuth, upload.single("avatar"), uploadAvatar);

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Export for Vercel serverless
export default app;

// Start server for local development
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`✅ CPE Smart Portal backend running on http://localhost:${PORT}`);
  });
}
