"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="max-w-7xl mx-auto px-8 md:px-16 py-16 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-gray-100">
      <div className="flex items-center gap-3">
        <img src="/oou-crest.jpg" alt="OOU crest" className="h-8 w-8 object-contain" />
        <div className="leading-tight">
          <p className="text-sm font-medium">OOU CPE Portal</p>
          <p className="text-xs text-gray-400">Computer Engineering, OOU</p>
        </div>
      </div>
      <div className="flex items-center gap-8 text-sm text-gray-500">
        <Link href="/signin" className="hover:text-gray-900 transition">Sign in</Link>
        <Link href="/signup" className="hover:text-gray-900 transition">Sign up</Link>
        <span>© 2026 Olabisi Onabanjo University</span>
      </div>
    </footer>
  );
}
