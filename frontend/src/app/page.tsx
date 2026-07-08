"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import {
  Calendar, MessageCircle, Newspaper, Play, Users, MonitorPlay, ShieldCheck
} from "lucide-react";
import GridBackground from "@/components/ui/GridBackground";
import Footer from "@/components/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

function AnimatedNumber({ value }: { value: string }) {
  const numeric = parseInt(value.replace(/[^0-9]/g, ""), 10);
  const suffix = value.replace(/[0-9,]/g, "");
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * numeric));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, numeric]);

  return (
    <span ref={ref}>
      {display.toLocaleString()}{suffix}
    </span>
  );
}

const features = [
  {
    icon: Calendar,
    title: "Smart timetable",
    desc: "Every class, deadline and open slot, laid out clearly for the week ahead.",
  },
  {
    icon: MessageCircle,
    title: "Direct line",
    desc: "Submit complaints straight to a lecturer and get official replies back.",
  },
  {
    icon: Newspaper,
    title: "Latest from the dept",
    desc: "News, insights and announcements from department executives, as they happen.",
  },
];

const roles = [
  {
    num: "01",
    role: "Students",
    icon: Users,
    desc: "Check weekly schedules, mark GPS attendance during open windows, track assignment deadlines and submit complaints directly to lecturers.",
    dark: false,
  },
  {
    num: "02",
    role: "Lecturers",
    icon: MonitorPlay,
    desc: "Add classes with time and location, open timed attendance or test windows, publish assignments with PDFs, and respond to student complaints.",
    dark: true,
  },
  {
    num: "03",
    role: "Admins",
    icon: ShieldCheck,
    desc: "Manage every user account, ban or reinstate access, upload lecture locations, and post news and announcements department-wide.",
    dark: false,
  },
];


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 md:px-16 py-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <img src="/oou-crest.jpg" alt="OOU crest" className="h-11 w-11 object-contain rounded-full" />
          <div className="leading-tight">
            <p className="font-medium text-base">OOU CompEng</p>
            <p className="text-xs text-gray-400">Department portal</p>
          </div>
        </div>
        <Link
          href="/signin"
          className="bg-black text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-gray-800 transition"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="mx-4 md:mx-16 rounded-[32px] bg-[#0a0a0a] text-white px-6 md:px-10 pt-28 pb-24 text-center overflow-hidden relative"
      >
        <GridBackground />
        <img
          src="/oou-crest.jpg"
          alt=""
          aria-hidden="true"
          className="absolute -right-16 -top-16 w-72 h-72 object-contain opacity-[0.06] pointer-events-none"
        />

        <span className="relative inline-flex items-center gap-1.5 border border-white/15 rounded-full px-4 py-1.5 text-xs text-white/60 mb-10">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Department of Computer Engineering · SIWES 2024/25
        </span>

        <h1 className="relative text-6xl md:text-7xl font-medium leading-[1.05] tracking-tight mb-7">
          University life,
          <br />
          <span className="font-voice italic font-normal text-green-400">finally clear</span>
        </h1>

        <p className="relative text-white/55 text-lg max-w-lg mx-auto mb-12 leading-relaxed">
          Schedules, attendance, assignments and department news — one place,
          built for OOU Computer Engineering.
        </p>

        <div className="relative flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/signup"
            className="bg-white text-black rounded-full px-8 py-3 text-sm font-medium hover:bg-gray-100 transition"
          >
            Get started
          </Link>
          <Link
            href="/signup?role=lecturer"
            className="border border-white/20 text-white rounded-full px-8 py-3 text-sm font-medium hover:bg-white/5 transition"
          >
            I'm a lecturer
          </Link>
        </div>
      </motion.section>

      {/* Stats */}
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.5 }}
        variants={staggerContainer}
        className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 border-y border-gray-100 my-32 sm:my-40"
      >
        {[
          ["1,200+", "Students onboard"],
          ["40", "Courses tracked"],
          ["98%", "On-time submissions"],
        ].map(([stat, label], i) => (
          <motion.div
            key={label}
            variants={fadeUp}
            className={`text-center py-14 ${i < 2 ? "sm:border-r border-gray-100" : ""}`}
          >
            <p className="text-5xl md:text-6xl font-medium tracking-tight">
              <AnimatedNumber value={stat} />
            </p>
            <p className="text-base text-gray-500 mt-3">{label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Feature cards */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
        className="max-w-6xl mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-8 mb-40"
      >
        {features.map(({ icon: Icon, title, desc }) => (
          <motion.div
            key={title}
            variants={fadeUp}
            whileHover={{ y: -6 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-gray-50 rounded-[28px] p-12 hover:bg-gray-100 hover:shadow-lg transition-colors cursor-default"
          >
            <div className="h-14 w-14 rounded-2xl bg-green-400/10 flex items-center justify-center mb-7">
              <Icon size={26} className="text-green-700" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-medium mb-3">{title}</p>
            <p className="text-base text-gray-500 leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </motion.section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-8 mb-40">
        <p className="text-sm uppercase tracking-widest text-gray-400 text-center mb-3">How it works</p>
        <h2 className="text-5xl font-medium text-center mb-20">Three roles, one system</h2>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {roles.map(({ icon: Icon, num, role, desc, dark }) => (
            <motion.div
              key={role}
              variants={fadeUp}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className={`rounded-[28px] p-12 ${dark ? "bg-[#0f2a06] text-white" : "bg-gray-50"}`}
            >
              <span className={`text-base ${dark ? "text-green-400" : "text-gray-400"}`}>{num}</span>
              <Icon
                size={36}
                className={`my-6 ${dark ? "text-green-400" : "text-green-700"}`}
                strokeWidth={1.5}
              />
              <p className="text-2xl font-medium mb-4">{role}</p>
              <p className={`text-base leading-relaxed ${dark ? "text-white/60" : "text-gray-500"}`}>{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Video showcase */}
      <section className="max-w-6xl mx-auto px-8 mb-40">
        <h2 className="text-4xl font-medium text-center mb-16">See it in action</h2>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 gap-10"
        >
          {[
            { thumb: "/demo-thumb-1.jpg", label: "Student walkthrough" },
            { thumb: "/demo-thumb-2.jpeg", label: "Lecturer & admin tools" },
          ].map(({ thumb, label }) => (
            <motion.button
              key={label}
              variants={fadeUp}
              className="relative rounded-[28px] overflow-hidden aspect-video group text-left"
            >
              <motion.img
                src={thumb}
                alt={label}
                className="w-full h-full object-cover"
                whileHover={{ scale: 1.06 }}
                transition={{ duration: 0.5 }}
              />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition flex items-center justify-center">
                <motion.span
                  whileHover={{ scale: 1.1 }}
                  className="h-20 w-20 rounded-full bg-white flex items-center justify-center shadow-lg"
                >
                  <Play size={26} className="text-black ml-1" fill="black" />
                </motion.span>
              </div>
              <p className="absolute bottom-6 left-6 text-white text-base font-medium">{label}</p>
            </motion.button>
          ))}
        </motion.div>
      </section>

      {/* Photo mosaic */}
      <section className="max-w-6xl mx-auto px-8 mb-40">
        <h2 className="text-4xl font-medium text-center mb-16">Life in the department</h2>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          style={{ gridTemplateRows: "380px 380px" }}
        >
          {[
            "/group-photo-1.jpeg",
            "/group-photo-2.jpg",
            "/group-photo-3.jpeg",
            "/group-photo-4.jpg",
          ].map((photo, i) => (
            <motion.img
              key={i}
              variants={fadeUp}
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.5 }}
              src={photo}
              alt="Department life"
              className="w-full h-64 sm:h-full object-cover rounded-[28px]"
            />
          ))}
        </motion.div>
      </section>

      {/* Testimonial */}
      <section className="max-w-3xl mx-auto px-8 mb-40">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeUp}
          className="bg-gray-50 rounded-[32px] p-16 text-center"
        >
          <p className="font-voice italic text-3xl leading-relaxed mb-8">
            &ldquo;I stopped missing deadlines the week I started using this.&rdquo;
          </p>
          <p className="text-base text-gray-500">200 level, Computer Engineering</p>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
