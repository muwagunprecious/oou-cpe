import { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * GET /api/complaints
 * Lecturer fetches all complaints directed at them.
 */
export async function getComplaints(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const statusFilter = req.query.status as string | undefined;

    let query = supabaseAdmin
      .from("complaints")
      .select("*, student:users!student_id(full_name, email), courses(code, title)")
      .order("created_at", { ascending: false });

    // Admins see all; lecturers only see theirs
    if (user.role === "lecturer") {
      query = query.eq("lecturer_id", user.id);
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ complaints: data });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PATCH /api/complaints/:id/reply
 * Lecturer replies to and resolves a complaint.
 */
export async function replyComplaint(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    const user = (req as any).user;

    if (!reply?.trim()) {
      res.status(400).json({ error: "Reply text is required" });
      return;
    }

    // Verify ownership (unless admin)
    if (user.role !== "admin") {
      const { data: complaint } = await supabaseAdmin
        .from("complaints")
        .select("lecturer_id")
        .eq("id", id)
        .single();

      if (complaint?.lecturer_id !== user.id) {
        res.status(403).json({ error: "You can only reply to complaints addressed to you" });
        return;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("complaints")
      .update({ reply: reply.trim(), status: "resolved" })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, complaint: data });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
}
