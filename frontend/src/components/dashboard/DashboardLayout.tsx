"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import GridBackground from "@/components/ui/GridBackground";

interface Tab {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  tabs: Tab[];
  active: string;
  setActive: (key: string) => void;
  title: string;
  portalLabel?: string;
  children: ReactNode;
}

export default function DashboardLayout({
  tabs,
  active,
  setActive,
  title,
  portalLabel = "Department portal",
  children,
}: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/signin");
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Sidebar */}
      <aside
        className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
          fixed md:sticky top-0 left-0 z-40 h-screen w-64 flex flex-col bg-[#0a0a0a] text-white
          transition-transform duration-300 ease-in-out overflow-hidden`}
      >
        <GridBackground size={48} />
        {/* Header */}
        <div className="relative flex items-center gap-3 px-6 py-7 border-b border-white/5">
          <img src="/oou-crest.jpg" alt="OOU" className="h-8 w-8 object-contain rounded-full" />
          <div className="leading-tight">
            <p className="text-sm font-medium">OOU CompEng</p>
            <p className="text-xs text-white/40">{portalLabel}</p>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="relative flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActive(tab.key); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all text-left
                  ${isActive
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
              >
                <Icon size={18} strokeWidth={1.5} />
                {tab.label}
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User info + sign out */}
        <div className="relative border-t border-white/5 px-4 py-4">
          <div className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-white/5 transition group">
            <div className="h-9 w-9 rounded-xl bg-green-400/20 flex items-center justify-center text-green-400 text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || "—"}</p>
              <p className="text-xs text-white/40 truncate capitalize">{profile?.role}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="opacity-0 group-hover:opacity-100 transition text-white/40 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile only) */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <img src="/oou-crest.jpg" alt="OOU" className="h-7 w-7 object-contain" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-gray-100 transition"
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Page heading */}
        <div className="px-6 md:px-10 pt-8 pb-2">
          <h1 className="text-2xl md:text-3xl font-semibold">{title}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Content */}
        <main className="flex-1 px-6 md:px-10 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
