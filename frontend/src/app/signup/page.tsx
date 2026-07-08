"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import GridBackground from "@/components/ui/GridBackground";
import { Suspense } from "react";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") === "lecturer" ? "lecturer" : "student";

  const [form, setForm] = useState({ fullName: "", email: "", password: "", level: "100" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.email.endsWith("@oouagoiwoye.edu.ng") && !form.email.endsWith("@student.oouagoiwoye.edu.ng")) {
      setError("Please use your school email (@oouagoiwoye.edu.ng)");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          role,
          level: role === "student" ? form.level : null,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (role === "lecturer") {
      router.push("/pending-approval");
    } else {
      router.push("/student/dashboard");
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className="w-full max-w-sm"
    >
      <h2 className="text-3xl font-medium mb-2">Create your account</h2>
      <p className="text-gray-500 mb-10">
        {role === "lecturer"
          ? "Sign up as a lecturer with your school email."
          : "Sign up with your school email to get started."}
      </p>

      <div className="flex bg-gray-100 rounded-full p-1 mb-8 text-sm font-medium">
        <Link href="/signin" className="flex-1 text-center py-2 text-gray-500 hover:text-gray-700">
          Sign in
        </Link>
        <span className="flex-1 text-center py-2 rounded-full bg-white shadow-sm">Sign up</span>
      </div>

      {/* Role toggle */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-6 text-sm font-medium">
        <Link
          href="/signup"
          className={`flex-1 text-center py-2.5 transition ${role === "student" ? "bg-[#0a0a0a] text-white" : "hover:bg-gray-50 text-gray-600"}`}
        >
          Student
        </Link>
        <Link
          href="/signup?role=lecturer"
          className={`flex-1 text-center py-2.5 transition ${role === "lecturer" ? "bg-[#0a0a0a] text-white" : "hover:bg-gray-50 text-gray-600"}`}
        >
          Lecturer
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-6">{error}</p>
      )}

      <label className="text-sm font-medium block mb-2" htmlFor="fullName">Full name</label>
      <input
        id="fullName"
        required
        placeholder="Ada Lovelace"
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400"
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
      />

      <label className="text-sm font-medium block mb-2" htmlFor="signup-email">Email</label>
      <input
        id="signup-email"
        type="email"
        required
        placeholder="you@oouagoiwoye.edu.ng"
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      {role === "student" && (
        <>
          <label className="text-sm font-medium block mb-2" htmlFor="level">Level</label>
          <select
            id="level"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          >
            <option value="100">100 Level</option>
            <option value="200">200 Level</option>
            <option value="300">300 Level</option>
            <option value="400">400 Level</option>
            <option value="500">500 Level</option>
          </select>
        </>
      )}

      <label className="text-sm font-medium block mb-2" htmlFor="signup-password">Password</label>
      <input
        id="signup-password"
        type="password"
        required
        minLength={6}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-8 focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-500 text-white rounded-full py-3.5 text-sm font-medium hover:bg-green-600 transition disabled:opacity-50 mb-3 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
        By continuing you agree to abide by the OOU code of conduct.
      </p>
    </motion.form>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left dark panel */}
      <div className="relative bg-[#0a0a0a] text-white px-10 md:px-16 py-16 flex flex-col justify-between overflow-hidden">
        <GridBackground />
        <img
          src="/oou-crest.jpg"
          alt=""
          aria-hidden="true"
          className="absolute -right-16 -bottom-16 w-80 h-80 object-contain opacity-[0.06] pointer-events-none"
        />

        <div className="relative flex items-center gap-3">
          <img src="/oou-crest.jpg" alt="Olabisi Onabanjo University crest" className="h-10 w-10 object-contain rounded-full" />
          <span className="font-medium">OOU CompEng Portal</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative max-w-md"
        >
          <h1 className="text-4xl md:text-5xl font-medium leading-tight mb-6">
            Navigate university life{" "}
            <span className="font-voice italic font-normal text-green-400">with clarity</span>
          </h1>
          <p className="text-white/55 leading-relaxed">
            One home for schedules, attendance, assignments, complaints and
            the latest news from the Department of Computer Engineering.
          </p>
        </motion.div>

        <p className="relative text-xs text-white/30">© 2026 Olabisi Onabanjo University</p>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-8 md:px-16 py-16 bg-white">
        <Suspense fallback={<div className="text-sm text-gray-400">Loading...</div>}>
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}
