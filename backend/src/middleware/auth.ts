import { Request, Response, NextFunction } from "express";
import { supabase, supabaseAdmin } from "../lib/supabase.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  profile?: {
    id: string;
    full_name: string;
    email: string;
    role: "student" | "lecturer" | "admin";
    status: "pending_approval" | "active" | "banned";
    level?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Invalid session token" });
    }

    // Retrieve user details from public.users table (use admin client to bypass RLS)
    let { data: profile, error: dbError } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, status, level")
      .eq("id", user.id)
      .single();

    // If profile is missing, auto-create it from auth metadata
    if (dbError || !profile) {
      const meta = user.user_metadata || {};
      const newProfile = {
        id: user.id,
        full_name: meta.full_name || user.email?.split("@")[0] || "User",
        email: user.email || "",
        role: meta.role || "student",
        status: "active" as const,
        level: meta.level || null,
        department: meta.department || "Computer Engineering",
        phone: meta.phone || null,
        matric_number: meta.matric_number || null,
      };

      // Try insert first
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("users")
        .insert(newProfile)
        .select("id, full_name, email, role, status, level")
        .single();

      if (insertErr || !inserted) {
        console.error("Failed to auto-create user profile (insert):", insertErr);

        // If insert failed (e.g. duplicate key), try upsert as fallback
        const { data: upserted, error: upsertErr } = await supabaseAdmin
          .from("users")
          .upsert(newProfile, { onConflict: "id" })
          .select("id, full_name, email, role, status, level")
          .single();

        if (upsertErr || !upserted) {
          console.error("Failed to auto-create user profile (upsert):", upsertErr);
          return res.status(403).json({ error: "User profile not found in department portal. Please contact support." });
        }

        profile = upserted;
      } else {
        profile = inserted;
      }
    }

    if (profile.status === "banned") {
      return res.status(403).json({ error: "Your account has been banned. Please contact the administrator." });
    }

    req.user = { id: user.id, email: user.email };
    req.profile = profile;

    next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server authentication error" });
  }
}

export function requireRole(roles: Array<"student" | "lecturer" | "admin">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.profile) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.profile.status === "pending_approval") {
      return res.status(403).json({ error: "Your account is pending administrator approval." });
    }

    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({ error: `Forbidden: Requires one of these roles: ${roles.join(", ")}` });
    }

    next();
  };
}
