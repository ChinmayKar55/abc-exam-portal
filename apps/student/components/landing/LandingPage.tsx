"use client"
import Link from "next/link"
import { useState, useEffect, useRef, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight, CheckCircle2, ChevronDown, Star, Users, BookOpen,
  Award, Shield, BarChart3, Clock, Menu, X, Zap, Target, TrendingUp,
  Brain, FileText, MonitorSmartphone, Bell, MapPin,
  Mail, Phone
} from "lucide-react"
import { FaFacebookF, FaInstagram, FaRedditAlien, FaWhatsapp } from "react-icons/fa"
import { Skeleton } from "@/components/ui/skeleton"
import { PricingCard, type PricingPlan, tierFeatures, tierDescriptions } from "@/components/pricing/PricingCard"
import { subscriptionQueries, type SubscriptionPlan } from "@/lib/queries/subscription"
import { formatDurationLabel } from "@/lib/utils"
import { PolicyModal } from "@/components/shared/PolicyModal"

// ─── colour palette (sky-blue theme) ───────────────────────────────────────
// Primary: #0284c7 (sky-600)   Accent: #0ea5e9 (sky-500)
// Dark bg: #0c1a2e             Sections alternate white / #f0f9ff

// ─── tiny helpers ───────────────────────────────────────────────────────────
function cn(...cls: (string | false | undefined | null)[]) {
  return cls.filter(Boolean).join(" ")
}

function useCountUp(target: number, duration = 1800, start = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      setVal(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return val
}

// ─── NAV ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  return (
    <nav className={cn(
      "fixed top-0 inset-x-0 z-50 transition-all duration-300",
      scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-sky-100" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-24">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 lg:gap-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/osssc-logo.png" alt="OSSSC Online" className="h-27 w-22 object-contain drop-shadow-md shrink-0 translate-y-[9px]" />
          <span className={cn("font-extrabold text-lg lg:text-xl tracking-widest leading-tight whitespace-nowrap", scrolled ? "text-sky-900" : "text-white")}>
            OSSSC ONLINE
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8 shrink-0">
          {["Exams", "Plans", "About"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}
              className={cn("text-sm font-medium transition-colors hover:text-sky-400 whitespace-nowrap",
                scrolled ? "text-slate-700" : "text-white/90"
              )}>
              {item}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
          <Link href="/login"
            className={cn("text-sm font-semibold px-3 lg:px-4 py-2 rounded-lg transition-colors whitespace-nowrap",
              scrolled ? "text-sky-700 hover:bg-sky-50" : "text-white/90 hover:text-white"
            )}>
            Sign In
          </Link>
          <Link href="/register"
            className="text-sm font-semibold px-3 lg:px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-colors shadow-md whitespace-nowrap">
            Start Free →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(!open)} className={cn("md:hidden p-2", scrolled ? "text-slate-700" : "text-white")}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-b border-sky-100 px-4 py-4 space-y-3">
          {["Exams", "Plans", "About"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setOpen(false)}
              className="block text-sm font-medium text-slate-700 hover:text-sky-600 py-1">
              {item}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <Link href="/login" className="flex-1 text-center text-sm font-semibold px-4 py-2 rounded-lg border border-sky-200 text-sky-700">Sign In</Link>
            <Link href="/register" className="flex-1 text-center text-sm font-semibold px-4 py-2 rounded-lg bg-sky-500 text-white">Start Free</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── HERO ───────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0c1a2e]">
      {/* Decorative gradient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-sky-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-600/15 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.02%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-20 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left copy */}
        <div className="space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold px-4 py-2 rounded-full">
            <Zap className="h-3.5 w-3.5" />
            India&apos;s #1 OSSSC Exam Prep Platform
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
            Crack Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
              OSSSC Nursing Exam
            </span>{" "}
            With Confidence
          </h1>

          <p className="text-lg text-slate-300 leading-relaxed max-w-lg">
            Full-length mock tests, chapter-wise practice, and AI-proctored exams — built exclusively for Nursing Officer, Paramedical & Allied Health aspirants in Odisha.
          </p>

          {/* Trust pills */}
          <div className="flex flex-wrap gap-3">
            {[
              "Nursing Officer",
              "Paramedical",
              "Allied Health",
              "Current Affairs",
            ].map((tag) => (
              <span key={tag} className="bg-white/8 border border-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4">
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-bold px-7 py-3.5 rounded-xl text-base shadow-lg shadow-sky-500/30 transition-all hover:shadow-sky-400/40 hover:-translate-y-0.5">
              Start Free Practice
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="#exams"
              className="inline-flex items-center gap-2 border border-white/20 hover:border-sky-400/40 text-white/80 hover:text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-all">
              View Exam Series
              <ChevronDown className="h-4 w-4" />
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-6 pt-2">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-[#0c1a2e] bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                  {["A", "R", "S", "M"][i]}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-400">
              <span className="text-white font-semibold">12,000+</span> students already enrolled
            </p>
          </div>
        </div>

        {/* Right — dual image card */}
        <div className="relative hidden lg:block">
          <div className="relative">
            {/* Main card bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-cyan-500/10 rounded-3xl" />
            <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/hero-study.png" alt="Students studying for OSSSC exam" className="w-full object-cover h-80" />
            </div>

            {/* Floating card – score */}
            <div className="absolute -bottom-6 -left-8 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3 min-w-[200px]">
              <div className="h-11 w-11 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Avg. Score Improvement</p>
                <p className="text-xl font-extrabold text-slate-900">+34%</p>
              </div>
            </div>

            {/* Floating card – live */}
            <div className="absolute -top-5 -right-6 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
              </span>
              <p className="text-xs font-semibold text-slate-700">384 tests in progress</p>
            </div>
          </div>

          {/* Bottom pair */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-doctor-male.png" alt="Male healthcare professional"
              className="rounded-2xl border border-white/10 object-cover h-48 w-full bg-slate-800" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-doctor-female.png" alt="Female healthcare professional"
              className="rounded-2xl border border-white/10 object-cover h-48 w-full bg-slate-800" />
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <a href="#stats" className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors animate-bounce">
        <ChevronDown className="h-5 w-5" />
      </a>
    </section>
  )
}

// ─── STATS ──────────────────────────────────────────────────────────────────
function Stats() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const students = useCountUp(12000, 2000, visible)
  const questions = useCountUp(50000, 2000, visible)
  const tests = useCountUp(200, 1800, visible)
  const passRate = useCountUp(94, 1500, visible)

  const stats = [
    { label: "Students Enrolled", value: students, suffix: "+", prefix: "" },
    { label: "MCQ Question Bank", value: questions, suffix: "+", prefix: "" },
    { label: "Mock Tests Available", value: tests, suffix: "+", prefix: "" },
    { label: "Student Pass Rate", value: passRate, suffix: "%", prefix: "" },
  ]

  return (
    <section id="stats" ref={ref} className="bg-sky-600 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map(({ label, value, suffix }) => (
            <div key={label} className="text-center">
              <p className="text-4xl font-extrabold text-white">
                {value.toLocaleString()}{suffix}
              </p>
              <p className="text-sky-100 text-sm font-medium mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── EXAM SERIES ────────────────────────────────────────────────────────────
const EXAMS = [
  {
    title: "Nursing Officer",
    badge: "Most Popular",
    badgeColor: "bg-sky-500",
    topics: ["Anatomy & Physiology", "Pharmacology", "Community Health Nursing", "Medical-Surgical Nursing", "Maternal & Child Health", "Mental Health Nursing"],
    tests: 48,
    questions: 12000,
    icon: "🏥",
  },
  {
    title: "Staff Nurse",
    badge: "High Demand",
    badgeColor: "bg-emerald-500",
    topics: ["Fundamentals of Nursing", "Medical Nursing", "Surgical Nursing", "OBG Nursing", "Pediatric Nursing", "Community Health"],
    tests: 36,
    questions: 9000,
    icon: "💉",
  },
  {
    title: "Paramedical & Allied Health",
    badge: "New",
    badgeColor: "bg-amber-500",
    topics: ["Lab Technician", "Radiographer", "Physiotherapy", "Pharmacy", "OT Technician", "Health Inspector"],
    tests: 24,
    questions: 6000,
    icon: "🔬",
  },
]

function ExamSeries() {
  return (
    <section id="exams" className="py-24 bg-[#f0f9ff]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">Exam Series</span>
          <h2 className="text-4xl font-extrabold text-slate-900">Prepare for Every OSSSC Role</h2>
          <p className="mt-4 text-slate-500 text-lg max-w-2xl mx-auto">
            Curated mock test series aligned with the latest OSSSC syllabus and exam patterns — updated after every notification.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {EXAMS.map((exam) => (
            <div key={exam.title}
              className="group relative bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">{exam.icon}</span>
                  <span className={cn("text-white text-xs font-bold px-3 py-1 rounded-full", exam.badgeColor)}>
                    {exam.badge}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{exam.title}</h3>
                <div className="space-y-2 mb-5">
                  {exam.topics.map((t) => (
                    <div key={t} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* Coming Soon overlay */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0c1a2e]/90 backdrop-blur-sm opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 ease-out">
                <span className="relative flex h-14 w-14 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/40" />
                  <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/20 border border-sky-400/40">
                    <Clock className="h-6 w-6 text-sky-300" />
                  </span>
                </span>
                <span className="text-white font-extrabold text-lg tracking-wide">Coming Soon</span>
                <span className="text-sky-200 text-xs px-6 text-center">We&apos;re putting the finishing touches on {exam.title} mocks</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FEATURES ───────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Brain, title: "AI-Powered Proctoring", desc: "Face detection and webcam monitoring ensure exam integrity. Admins receive real-time violation logs and flagging.", color: "bg-violet-100 text-violet-600" },
  { icon: BarChart3, title: "Deep Performance Analytics", desc: "Track your weak areas with topic-wise accuracy, time-per-question breakdowns and percentile ranking.", color: "bg-sky-100 text-sky-600" },
  { icon: Target, title: "Negative Marking Engine", desc: "Real exam conditions with configurable marks-per-question and penalty — exactly how OSSSC conducts it.", color: "bg-rose-100 text-rose-600" },
  { icon: Clock, title: "Timed Full-Length Mocks", desc: "150-question, 2-hour sessions with auto-submit and countdown — as close to the real exam as it gets.", color: "bg-amber-100 text-amber-600" },
  { icon: MonitorSmartphone, title: "OMR-Style Interface", desc: "Familiar optical mark recognition sheet layout gives you practice with the exact OSSSC answer format.", color: "bg-emerald-100 text-emerald-600" },
  { icon: Shield, title: "Verified Question Bank", desc: "Every MCQ is sourced from previous OSSSC papers and curated by subject-matter experts — no junk questions.", color: "bg-indigo-100 text-indigo-600" },
]

function Features() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">Platform Features</span>
          <h2 className="text-4xl font-extrabold text-slate-900">Everything You Need to Clear OSSSC Nursing</h2>
          <p className="mt-4 text-slate-500 text-lg max-w-2xl mx-auto">
            Not just question banks. A complete preparation ecosystem built around how the OSSSC exam actually works.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title}
              className="group rounded-2xl border border-slate-100 p-6 hover:border-sky-200 hover:shadow-lg transition-all duration-300">
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", color)}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── HOW IT WORKS ───────────────────────────────────────────────────────────
const STEPS = [
  { step: "01", title: "Create Your Free Account", desc: "Sign up in 30 seconds. No credit card. Access free practice tests instantly." },
  { step: "02", title: "Choose Your Exam Series", desc: "Pick Nursing Officer, Staff Nurse or your paramedical specialisation. Tests are syllabus-mapped." },
  { step: "03", title: "Take Proctored Mock Tests", desc: "Simulate the real exam with timed, OMR-format, AI-monitored sessions and negative marking." },
  { step: "04", title: "Analyse & Improve", desc: "Get instant results, topic-wise accuracy charts, and personalised weak-area revision recommendations." },
]

function HowItWorks() {
  return (
    <section className="py-24 bg-[#0c1a2e] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[100px]" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">How It Works</span>
          <h2 className="text-4xl font-extrabold text-white">Start Scoring Higher in 4 Steps</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map(({ step, title, desc }, i) => (
            <div key={step} className="relative">
              {/* connector */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px border-t border-dashed border-sky-800 z-0" style={{ width: "calc(100% - 2rem)" }} />
              )}
              <div className="relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-sky-500/40 transition-colors">
                <div className="text-5xl font-extrabold text-sky-500/20 leading-none mb-3">{step}</div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── TESTIMONIALS ───────────────────────────────────────────────────────────
const TESTIMONIALS = [
  { name: "Priya Mohanty", role: "Nursing Officer, AIIMS Bhubaneswar", text: "OSSSC Online's mock tests were identical in difficulty to the actual exam. I cleared on my first attempt after 3 months of practice here.", rating: 5, avatar: "PM" },
  { name: "Rajesh Sethi", role: "Staff Nurse, SCB Medical", text: "The negative marking feature forced me to be more careful. My accuracy improved from 68% to 89% in just 6 weeks.", rating: 5, avatar: "RS" },
  { name: "Sunita Nayak", role: "Lab Technician, DHH Cuttack", text: "The detailed question explanations after each mock are gold. I finally understand why my wrong answers were wrong.", rating: 5, avatar: "SN" },
  { name: "Abhisek Panda", role: "Paramedical, District Hospital", text: "OMR-style interface is exactly what you need. No surprises on exam day when you've practiced this format 50 times.", rating: 5, avatar: "AP" },
]

function Testimonials() {
  return (
    <section className="py-24 bg-[#f0f9ff]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">Student Stories</span>
          <h2 className="text-4xl font-extrabold text-slate-900">Real Students, Real Results</h2>
          <p className="mt-4 text-slate-500 text-lg">
            Join thousands who cleared their OSSSC exams with our platform.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TESTIMONIALS.map(({ name, role, text, rating, avatar }) => (
            <div key={name} className="bg-white rounded-2xl border border-sky-100 p-6 shadow-sm hover:shadow-lg transition-shadow flex flex-col gap-4">
              <div className="flex gap-1">
                {[...Array(rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed flex-1">&ldquo;{text}&rdquo;</p>
              <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{name}</p>
                  <p className="text-xs text-slate-400">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── PLANS ──────────────────────────────────────────────────────────────────
const DEFAULT_API_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    tier: "free",
    name: "Free",
    description: tierDescriptions.free,
    price_paise: 0,
    duration_days: 0,
    duration_label: "forever",
    features: [],
  },
  {
    id: "pro",
    tier: "pro",
    name: "Pro",
    description: tierDescriptions.pro,
    price_paise: 19900,
    duration_days: 7,
    duration_label: "7 days",
    features: [],
  },
  {
    id: "max",
    tier: "max",
    name: "Max",
    description: tierDescriptions.max,
    price_paise: 99900,
    duration_days: 90,
    duration_label: "3 months",
    features: [],
  },
]

function toPricingPlan(plan: SubscriptionPlan): PricingPlan {
  return {
    tier: plan.tier,
    name: plan.name,
    description: tierDescriptions[plan.tier] ?? plan.description,
    pricePaise: plan.price_paise,
    durationLabel: plan.duration_label ?? formatDurationLabel(plan.duration_days),
    features: tierFeatures[plan.tier] ?? plan.features,
    isPopular: plan.tier === "pro",
    ctaLabel: plan.tier === "free" ? "Get Started Free" : `Start ${plan.name}`,
    ctaHref: "/register",
  }
}

function Plans() {
  const { data: plans = DEFAULT_API_PLANS, isLoading } = useQuery({
    queryKey: ["public-subscription-plans"],
    queryFn: subscriptionQueries.list,
    initialData: DEFAULT_API_PLANS,
    retry: false,
  })

  const pricingPlans = useMemo(() => {
    const all: SubscriptionPlan[] = plans.some((p) => p.tier === "free")
      ? plans
      : [DEFAULT_API_PLANS[0], ...plans]
    return all.map(toPricingPlan)
  }, [plans])

  return (
    <section id="plans" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">Pricing</span>
          <h2 className="text-4xl font-extrabold text-slate-900">Simple, Affordable Plans</h2>
          <p className="mt-4 text-slate-500 text-lg max-w-xl mx-auto">
            Start free. Upgrade when you&apos;re ready. Cancel anytime.
          </p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-6 items-stretch max-w-7xl mx-auto">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[520px] rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 items-stretch max-w-7xl mx-auto">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.tier} plan={plan} theme="landing" />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── ABOUT ────────────────────────────────────────────────────────────────────
const ABOUT_OFFERINGS = [
  {
    icon: MonitorSmartphone,
    title: "Live-Alike Mock Test Environment",
    desc: "Developed in-house by ABC Skills, our proprietary mock test platform replicates the actual OSSSC exam interface, timing, and pressure conditions. This means you don't just practice the content — you practice the real experience: the same clock pressure, the same screen flow, the same exam-day feel. No surprises, no unfamiliar interfaces, no last-minute panic.",
  },
  {
    icon: FileText,
    title: "Free & Premium Mock Tests",
    desc: "Meticulously designed to mirror the actual OSSSC exam pattern, difficulty level, and time constraints, so you walk in on exam day feeling like you've already done this before — because you have.",
  },
  {
    icon: Award,
    title: "Questions Crafted by Industry Leaders",
    desc: "Our question banks are developed with input from experienced medical and nursing professionals who understand both the clinical realities of practice and the specific demands of the OSSSC syllabus. Every question is reviewed for accuracy, relevance, and alignment with current exam trends.",
  },
  {
    icon: BookOpen,
    title: "Comprehensive Subject-Wise Practice",
    desc: "In-depth coverage across Nursing Foundation, Medical-Surgical Nursing, Community Health Nursing, Child Health Nursing, Mental Health Nursing, Midwifery, and more — organized so you can strengthen weak areas systematically rather than studying randomly.",
  },
  {
    icon: MapPin,
    title: "Odisha-Specific General Knowledge & Current Affairs",
    desc: "Curated updates on state government schemes, health policies, and current affairs most likely to appear in OSSSC exams — content that generic national-level prep platforms simply don't offer.",
  },
  {
    icon: BarChart3,
    title: "Performance Analytics & Tracking",
    desc: "Detailed insights into your test performance, topic-wise accuracy, time management, and improvement trends, so your preparation is data-driven, not guesswork.",
  },
  {
    icon: Bell,
    title: "Timely Exam Updates & Notifications",
    desc: "Stay informed on exam dates, application deadlines, syllabus changes, and recruitment notifications, so you never miss a critical update in your preparation timeline.",
  },
]

function AboutUs() {
  return (
    <section id="about" className="py-24 bg-[#f0f9ff]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">About OSSSC.Online</span>
          <h2 className="text-4xl font-extrabold text-slate-900">Your Trusted Partner for OSSSC Nursing Officer Success</h2>
          <p className="mt-4 text-slate-500 text-lg max-w-3xl mx-auto">
            An Initiative by ABC Skills — Empowering Experienced Nursing Professionals Across Odisha to Achieve Their Government Career Goals
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <p className="text-slate-600 leading-relaxed">
              OSSSC.Online is an initiative by ABC Skills, born out of a simple but powerful idea — that experienced, hardworking nursing professionals deserve a preparation platform built specifically for them, not a generic one-size-fits-all exam portal.
            </p>
            <p className="text-slate-600 leading-relaxed">
              We know your journey hasn't been easy. You've completed your GNM or Nursing graduation, spent years on hospital floors, in wards, in emergency rooms and community health centers, building real clinical experience through long shifts and demanding responsibilities. Now, you're ready for the next chapter — a secure, respected, and impactful government nursing career through the OSSSC Nursing Officer recruitment exam. And that's precisely where OSSSC.Online steps in, as your dedicated partner for this final stretch of preparation.
            </p>

            <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Backed by ABC Skills' Expertise</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                As an initiative of ABC Skills — a trusted name in medical and nursing skills training — OSSSC.Online brings the same institutional rigor, clinical understanding, and training expertise into a focused exam-prep platform. This isn't a side project built by outsiders guessing at what nurses need; it's built by an organization already immersed in medical and nursing education.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Our Philosophy</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                We believe that experienced nursing professionals — the ones who've already proven their dedication through years of clinical service — deserve preparation resources that respect their time, their intelligence, and their expertise. That's why we don't just throw generic questions at you. We build a genuine bridge between your real-world clinical knowledge and the specific way that knowledge is tested in the OSSSC examination format — backed by technology that makes practice feel like the real thing.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Our Community</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                OSSSC.Online isn't just a website — it's a growing community of nursing professionals across Odisha, all working toward the same goal: securing a stable, respected, and fulfilling career in government healthcare service. Backed by ABC Skills, we're building a support system of educators, past candidates, and healthcare professionals who genuinely understand what you're going through.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-sky-100 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Our Commitment to You</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Every feature on this platform, every mock test, and every piece of content exists for one reason: to help you convert years of clinical dedication into exam-day success. We're not here to sell you generic content. We're here to help you get the government nursing job you've worked so hard to earn.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-gradient-to-br from-sky-600 to-cyan-600 rounded-3xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">What Makes Us Different</h3>
              <p className="text-sky-100 leading-relaxed">
                Unlike generic test-prep platforms, everything at OSSSC.Online is built around the specific needs of experienced nursing candidates preparing for Odisha's state recruitment process. We've combined subject-matter depth with exam-specific strategy — and real technology — to give you the sharpest possible edge.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Our Core Offerings</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {ABOUT_OFFERINGS.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="bg-white rounded-2xl border border-sky-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5 text-sky-600" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mb-2">{title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-16 text-lg font-semibold text-slate-900">
          OSSSC.Online — An ABC Skills Initiative. Prepare Smart. Serve Odisha.
        </p>
      </div>
    </section>
  )
}

// ─── FAQ ────────────────────────────────────────────────────────────────────
const FAQS = [
  { q: "Who is OSSSC Online for?", a: "OSSSC Online is designed for candidates preparing for Odisha Staff Selection Commission exams — primarily Nursing Officer, Staff Nurse, Paramedical and Allied Health posts notified by the OSSSC." },
  { q: "Are the questions based on the actual OSSSC syllabus?", a: "Yes. Our question bank is curated from previous OSSSC papers and aligned with the latest official syllabus. Each test is reviewed by subject-matter experts before publishing." },
  { q: "What is the negative marking feature?", a: "Each exam can be configured with a marks-per-question value and an optional negative-marking penalty — exactly mirroring how OSSSC conducts grading. This trains you to attempt strategically." },
  { q: "Is the platform free to use?", a: "Yes — you can start with 5 free mock tests per month with no credit card. Paid plans unlock unlimited tests, all exam series, and advanced analytics." },
  { q: "How is AI proctoring used?", a: "Our platform uses face detection via webcam to ensure exam integrity. Tab-switching, window blurring, and DevTools usage are also monitored and flagged — just like an in-person exam centre." },
  { q: "Can I access the platform on mobile?", a: "Yes, the platform is fully responsive and works on tablets and large phones. For the best proctored exam experience we recommend a laptop or desktop with a webcam." },
]

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">FAQ</span>
          <h2 className="text-4xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <div key={i} className="bg-white rounded-2xl border border-sky-100 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left gap-4">
                <span className="text-sm font-semibold text-slate-900">{q}</span>
                <ChevronDown className={cn("h-4 w-4 text-sky-500 shrink-0 transition-transform", open === i && "rotate-180")} />
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-sm text-slate-500 leading-relaxed border-t border-sky-50 pt-4">
                  {a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA BANNER ─────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="bg-gradient-to-r from-sky-600 to-cyan-600 py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="flex justify-center gap-3 mb-2">
          {[Users, Award, TrendingUp].map((Icon, i) => (
            <div key={i} className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-white" />
            </div>
          ))}
        </div>
        <h2 className="text-4xl font-extrabold text-white">
          Your OSSSC Rank Starts Here
        </h2>
        <p className="text-sky-100 text-lg max-w-xl mx-auto">
          Join 12,000+ aspirants who chose smart, structured preparation. Free to start — no excuses.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-white text-sky-700 font-bold px-8 py-4 rounded-xl text-base shadow-lg hover:bg-sky-50 transition-all hover:-translate-y-0.5">
            Create Free Account
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/login"
            className="inline-flex items-center gap-2 border-2 border-white/40 hover:border-white text-white font-semibold px-8 py-4 rounded-xl text-base transition-all">
            Sign In
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── FOOTER ─────────────────────────────────────────────────────────────────
function Footer() {
  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Mock Tests", href: "#exams" },
    { label: "Study Material", href: "#features" },
    { label: "Current Affairs", href: "#about" },
    { label: "About Us", href: "#about" },
    { label: "Contact Us", href: "mailto:abcsupportindia@gmail.com" },
  ]

  const [openPolicy, setOpenPolicy] = useState<"terms" | "privacy" | "refund" | null>(null)

  const legalLinks = [
    { label: "Privacy Policy", policy: "privacy" as const },
    { label: "Terms & Conditions", policy: "terms" as const },
    { label: "Refund Policy", policy: "refund" as const },
  ]

  const socialLinks = [
    { icon: FaInstagram, label: "Instagram", href: "https://www.instagram.com/osssc.online" },
    { icon: FaFacebookF, label: "Facebook", href: "https://www.facebook.com/profile.php?id=61592002637897" },
    { icon: FaRedditAlien, label: "Reddit", href: "https://www.reddit.com/r/OSSSC_ONLINE/" },
    { icon: FaWhatsapp, label: "WhatsApp", href: "https://wa.me/918984858895" },
  ]

  return (
    <>
    <footer className="bg-[#0c1a2e] text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/osssc-logo.png" alt="OSSSC Online" className="h-10 w-10 object-contain" />
              <div>
                <span className="block font-extrabold text-white text-sm tracking-wide">OSSSC.Online</span>
                <span className="block text-xs text-sky-400">An Initiative by ABC Skills</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              Empowering experienced GNM and Nursing graduates across Odisha to succeed in the OSSSC Nursing Officer recruitment exam through live-alike mock tests, expert-curated questions, and focused preparation resources.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Quick Links</p>
            <ul className="space-y-2.5 text-sm">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("http") || link.href.startsWith("mailto:") ? (
                    <a href={link.href} className="hover:text-sky-400 transition-colors">{link.label}</a>
                  ) : (
                    <Link href={link.href} className="hover:text-sky-400 transition-colors">{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Legal</p>
            <ul className="space-y-2.5 text-sm">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => setOpenPolicy(link.policy)}
                    className="hover:text-sky-400 transition-colors text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + Social */}
          <div className="space-y-6">
            <div>
              <p className="text-white font-semibold text-sm mb-4">Get in Touch</p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>Bhubaneswar, Odisha</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                  <a href="mailto:abcsupportindia@gmail.com" className="hover:text-sky-400 transition-colors break-all">
                    abcsupportindia@gmail.com
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <a href="tel:+918984858895" className="hover:text-sky-400 transition-colors">
                      +91 89848 58895
                    </a>
                    <p className="text-xs text-slate-500 mt-0.5">Registered contact no. & WhatsApp</p>
                  </div>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-white font-semibold text-sm mb-3">Follow Us</p>
              <div className="flex flex-wrap gap-3">
                {socialLinks.map(({ icon: Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="h-10 w-10 rounded-full bg-white/5 hover:bg-sky-600/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p>© 2026 OSSSC.Online, an initiative by ABC Skills. All Rights Reserved.</p>
          <p className="text-xs text-slate-600">Not affiliated with Odisha Staff Selection Commission. Practice platform only.</p>
        </div>
      </div>
    </footer>
    <PolicyModal type={openPolicy} onClose={() => setOpenPolicy(null)} />
    </>
  )
}

// ─── ROOT ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="font-[var(--font-inter)]">
      <Navbar />
      <Hero />
      <Stats />
      <ExamSeries />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Plans />
      <AboutUs />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  )
}
