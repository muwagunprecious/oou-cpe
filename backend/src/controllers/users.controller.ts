import { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * POST /api/users/avatar
 * Uploads a profile picture (avatar) for the authenticated user.
 */
export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // 1. Ensure "avatars" bucket exists
    const { data: buckets, error: bucketListErr } = await supabaseAdmin.storage.listBuckets();
    if (bucketListErr) {
      console.error("Error listing buckets:", bucketListErr);
    }
    
    const avatarsBucketExists = (buckets || []).some(b => b.name === "avatars");
    if (!avatarsBucketExists) {
      console.log("Creating 'avatars' storage bucket...");
      const { error: bucketCreateErr } = await supabaseAdmin.storage.createBucket("avatars", {
        public: true,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      });
      if (bucketCreateErr) {
        console.error("Error creating bucket:", bucketCreateErr);
        res.status(500).json({ error: "Failed to initialize storage bucket" });
        return;
      }
    }

    // 2. Upload file to storage
    const ext = file.originalname.split(".").pop() || "jpg";
    const filePath = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      res.status(500).json({ error: "File upload to storage failed" });
      return;
    }

    // 3. Retrieve public URL
    const { data: urlData } = supabaseAdmin.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // 4. Update avatar_url in database
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (dbError) {
      console.error("Database update error:", dbError);
      res.status(500).json({ error: "Failed to update profile picture in database" });
      return;
    }

    res.status(200).json({ success: true, avatarUrl: publicUrl });
  } catch (err: any) {
    console.error("uploadAvatar error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
