import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";

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

    // Retrieve user details from public.users table
    const { data: profile, error: dbError } = await supabase
      .from("users")
      .select("id, full_name, email, role, status, level")
      .eq("id", user.id)
      .single();

    if (dbError || !profile) {
      return res.status(403).json({ error: "User profile not found in department portal" });
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
