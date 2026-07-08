import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groqApiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: groqApiKey });

export async function askAssistant(req: AuthenticatedRequest, res: Response) {
  const userProfile = req.profile;
  const { question } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  try {
    let contextData = "";

    // If student, perform RAG fetching from database
    if (userProfile && userProfile.role === "student") {
      const studentId = userProfile.id;
      const level = userProfile.level;

      // Run database queries in parallel
      const [
        { data: courses },
        { data: classes },
        { data: assignments },
        { data: attendanceRecords },
        { data: totalSessions },
        { data: complaints },
        { data: announcements },
        { data: faqs }
      ] = await Promise.all([
        // 1. Courses for student's level
        supabaseAdmin.from("courses").select("code, title, semester").eq("level", level || ""),
        // 2. Weekly classes schedule
        supabaseAdmin.from("classes").select("day, start_time, end_time, venue, locations(name, building)").eq("courses.level", level || ""),
        // 3. Pending assignments
        supabaseAdmin.from("assignments").select("title, deadline, marks, courses(code)").eq("courses.level", level || ""),
        // 4. Student's attendance records
        supabaseAdmin.from("attendance_records").select("session_id, marked_at, status").eq("student_id", studentId),
        // 5. Total open sessions for their level courses to calculate attendance rate
        supabaseAdmin.from("attendance_sessions").select("id, opens_at, classes!inner(course_id, courses!inner(level))").eq("classes.courses.level", level || ""),
        // 6. Student's complaints status
        supabaseAdmin.from("complaints").select("subject, status, reply").eq("student_id", studentId),
        // 7. General announcements
        supabaseAdmin.from("announcements").select("title, body, created_at").order("created_at", { ascending: false }).limit(5),
        // 8. Department FAQs
        supabaseAdmin.from("faqs").select("question, answer")
      ]);

      // Calculate attendance statistics
      const totalClassesOpened = totalSessions?.length || 0;
      const classesAttended = attendanceRecords?.filter((r: any) => r.status === "present").length || 0;
      const attendanceRate = totalClassesOpened > 0 ? Math.round((classesAttended / totalClassesOpened) * 100) : 100;

      // Compile contextual prompt
      contextData = `
### STUDENT PROFILE
- Name: ${userProfile.full_name}
- Email: ${userProfile.email}
- Role: Student
- Level: ${level} Level
- Current Department: Computer Engineering, Olabisi Onabanjo University (OOU)
- Current Date/Time: ${new Date().toLocaleString()}

### COURSES ASSIGNED TO LEVEL ${level}:
${courses && courses.length > 0 ? courses.map(c => `- ${c.code}: ${c.title} (Semester ${c.semester})`).join("\n") : "None"}

### WEEKLY TIMETABLE/CLASSES:
${classes && classes.length > 0 ? classes.map(c => `- ${c.day} at ${c.start_time}-${c.end_time} | Venue: ${c.venue || (c.locations as any)?.name || "TBD"} (${(c.locations as any)?.building || ""})`).join("\n") : "No classes currently scheduled."}

### PENDING/UPCOMING ASSIGNMENTS:
${assignments && assignments.length > 0 ? assignments.map(a => `- Course: ${(a.courses as any)?.code} | Title: ${a.title} | Deadline: ${new Date(a.deadline).toLocaleDateString()} | Marks: ${a.marks}`).join("\n") : "No assignments due."}

### ATTENDANCE SUMMARY:
- Classes Attended: ${classesAttended} out of ${totalClassesOpened} session(s)
- Current Attendance Rate: ${attendanceRate}%
- Attendance status warnings: ${attendanceRate < 75 ? "WARNING: Attendance is below the required 75% threshold!" : "Good standing."}

### MY RECENT COMPLAINTS:
${complaints && complaints.length > 0 ? complaints.map(c => `- Subject: ${c.subject} | Status: ${c.status} | Reply: ${c.reply || "No reply yet"}`).join("\n") : "No complaints submitted."}

### RECENT DEPARTMENT ANNOUNCEMENTS:
${announcements && announcements.length > 0 ? announcements.map(a => `- Title: ${a.title} | Content: ${a.body} (Posted: ${new Date(a.created_at).toLocaleDateString()})`).join("\n") : "No recent announcements."}

### DEPARTMENT FREQUENTLY ASKED QUESTIONS (FAQs):
${faqs && faqs.length > 0 ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") : "No general FAQ available."}
`;
    } else if (userProfile && userProfile.role === "lecturer") {
      // Fetch lecturer context
      const lecturerId = userProfile.id;
      const [
        { data: courses },
        { data: classes },
        { data: pendingComplaints }
      ] = await Promise.all([
        supabaseAdmin.from("courses").select("code, title, level").eq("lecturer_id", lecturerId),
        supabaseAdmin.from("classes").select("day, start_time, end_time, venue, courses(code)").eq("courses.lecturer_id", lecturerId),
        supabaseAdmin.from("complaints").select("subject, status").eq("lecturer_id", lecturerId).eq("status", "open")
      ]);

      contextData = `
### LECTURER PROFILE
- Name: ${userProfile.full_name}
- Email: ${userProfile.email}
- Role: Department Lecturer
- Current Date/Time: ${new Date().toLocaleString()}

### COURSES YOU TEACH:
${courses && courses.length > 0 ? courses.map(c => `- ${c.code}: ${c.title} (${c.level} Level)`).join("\n") : "No courses assigned."}

### YOUR WEEKLY LECTURES SCHEDULE:
${classes && classes.length > 0 ? classes.map(c => `- ${c.day} at ${c.start_time}-${c.end_time} | Course: ${(c.courses as any)?.code} | Venue: ${c.venue}`).join("\n") : "No lectures scheduled."}

### OPEN COMPLAINTS SENT TO YOU:
- Pending Complaints: ${pendingComplaints?.length || 0} open case(s)
`;
    }

    // System instructions for the LLM
    const systemPrompt = `
You are the CPE Smart Academic Portal Assistant, a helpful AI tutor and administrative guide for the Computer Engineering Department at Olabisi Onabanjo University (OOU).

Use the following Context to answer student or lecturer questions about their schedules, levels, courses, deadlines, attendance, and department FAQs.

Strict rules for departmental information:
1. Speak professionally, warmly, and clearly.
2. Rely ONLY on the provided Context to answer department-specific or user-specific questions (e.g. "Who teaches CPE 201?", "What is my timetable today?", "Which assignments are due?").
3. Do not invent course codes, lecturer names, venues, dates, or deadlines.
4. If a question is about department details or schedules but the answer is not in the Context, politely respond: "I am sorry, but I do not have that specific information in my database. Please contact the department administrator or check the official notice boards."
5. If the user asks general academic, programming, or engineering tutoring questions (e.g. "Explain data structures", "Solve this C programming question", "What is an FPGA?"), you can answer them fully using your training data, as a helpful tutor. Explain clearly, step-by-step, with code snippets or diagrams when appropriate.

Context:
---
${contextData}
---
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2, // Keep temperature low to prevent hallucination of details
      max_tokens: 1024,
    });

    const reply = chatCompletion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    // Log the audit log
    if (userProfile) {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userProfile.id,
        action: "ai_chat",
        details: { question: question.slice(0, 100), response_preview: reply.slice(0, 100) },
      });
    }

    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error("AI Assistant Error:", err);
    return res.status(500).json({ error: err.message || "Failed to process question via AI Assistant" });
  }
}
