"use client";

import { useState } from "react";
import { MapPin, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface Props {
  classId: string;
}

type Status = "idle" | "loading" | "success" | "error" | "no_session";

export default function AttendanceCheckIn({ classId }: Props) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const handleCheckIn = async () => {
    setStatus("loading");
    setMessage("");

    // 1. Get active session for this class
    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("*, locations(latitude, longitude)")
      .eq("class_id", classId)
      .lte("opens_at", now)
      .gte("closes_at", now)
      .single();

    if (sessionError || !session) {
      setStatus("no_session");
      setMessage("No active attendance window for this class right now.");
      return;
    }

    // 2. Get user's GPS position
    let coords: GeolocationCoordinates;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      coords = pos.coords;
    } catch {
      setStatus("error");
      setMessage("Could not get your location. Please allow location access.");
      return;
    }

    // 3. Send to backend for Haversine validation
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      const res = await fetch(`${backendUrl}/api/attendance/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: session.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(body.error || "Check-in failed. You may be out of range.");
        return;
      }

      setStatus("success");
      setMessage("Attendance marked successfully!");
    } catch {
      setStatus("error");
      setMessage("Network error. Please check your connection.");
    }
  };

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-2xl px-4 py-3 text-sm">
        <CheckCircle size={16} />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {status === "error" && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-2xl px-4 py-3 text-sm">
          <AlertCircle size={15} />
          <span>{message}</span>
        </div>
      )}
      {status === "no_session" && (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-2xl px-4 py-3 text-sm">
          <AlertCircle size={15} />
          <span>{message}</span>
        </div>
      )}
      <button
        onClick={handleCheckIn}
        disabled={status === "loading"}
        className="flex items-center gap-2 bg-[#0a0a0a] text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 w-fit"
      >
        {status === "loading" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <MapPin size={16} />
        )}
        {status === "loading" ? "Locating you..." : "Mark attendance"}
      </button>
    </div>
  );
}
