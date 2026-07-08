import { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * POST /api/assignments/submit
 * Student submits a file for an assignment.
 * Multer puts the file in req.file (memory buffer).
 * We upload to Supabase Storage then insert a submission record.
 */
export async function submitAssignment(req: Request, res: Response): Promise<void> {
  try {
    const student = (req as any).user;
    const { assignmentId } = req.body;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!assignmentId) {
      res.status(400).json({ error: "assignmentId is required" });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Verify the assignment exists and isn't past deadline
    const { data: assignment, error: assignErr } = await supabaseAdmin
      .from("assignments")
      .select("id, deadline")
      .eq("id", assignmentId)
      .single();

    if (assignErr || !assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    if (assignment.deadline && new Date(assignment.deadline) < new Date()) {
      res.status(400).json({ error: "This assignment deadline has passed" });
      return;
    }

    // Check for existing submission
    const { data: existing } = await supabaseAdmin
      .from("assignment_submissions")
      .select("id")
      .eq("assignment_id", assignmentId)
      .eq("student_id", student.id)
      .single();

    if (existing) {
      res.status(409).json({ error: "You have already submitted this assignment" });
      return;
    }

    // Upload file to Supabase Storage
    const ext = file.originalname.split(".").pop();
    const filePath = `submissions/${assignmentId}/${student.id}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("assignments")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      res.status(500).json({ error: "File upload failed" });
      return;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from("assignments").getPublicUrl(filePath);

    // Insert submission record
    const { data: submission, error: insertErr } = await supabaseAdmin
      .from("assignment_submissions")
      .insert({
        assignment_id: assignmentId,
        student_id: student.id,
        file_url: urlData.publicUrl,
        file_name: file.originalname,
        status: "submitted",
      })
      .select()
      .single();

    if (insertErr) {
      res.status(500).json({ error: insertErr.message });
      return;
    }

    res.status(201).json({ success: true, submission });
  } catch (err: any) {
    console.error("submitAssignment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/assignments/:assignmentId/submissions
 * Lecturer views all student submissions for an assignment.
 */
export async function getSubmissions(req: Request, res: Response): Promise<void> {
  try {
    const { assignmentId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("assignment_submissions")
      .select("*, student:users!student_id(full_name, email)")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ submissions: data });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PATCH /api/assignments/submissions/:submissionId/grade
 * Lecturer grades a student submission.
 */
export async function gradeSubmission(req: Request, res: Response): Promise<void> {
  try {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;

    if (grade === undefined || grade === null) {
      res.status(400).json({ error: "Grade is required" });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("assignment_submissions")
      .update({ grade: Number(grade), feedback: feedback || null, status: "graded" })
      .eq("id", submissionId)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, submission: data });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
}
