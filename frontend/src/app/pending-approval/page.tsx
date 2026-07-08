"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-[28px] p-12 text-center shadow-sm"
      >
        <div className="h-16 w-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-7">
          <Clock size={28} className="text-amber-500" />
        </div>
        <h1 className="text-2xl font-medium mb-3">Awaiting approval</h1>
        <p className="text-gray-500 leading-relaxed mb-8">
          Your lecturer profile is under review by the department administrator.
          You'll be able to access your dashboard once approved. This usually takes 1–2 business days.
        </p>
        <Link
          href="/signin"
          className="inline-block bg-[#0a0a0a] text-white rounded-full px-8 py-3 text-sm font-medium hover:bg-gray-800 transition"
        >
          Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
