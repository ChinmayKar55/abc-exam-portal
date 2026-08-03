"use client"

import Link from "next/link"
import { useState } from "react"
import { MapPin, Mail, Phone } from "lucide-react"
import { FaFacebookF, FaInstagram, FaRedditAlien, FaWhatsapp } from "react-icons/fa"
import { PolicyModal } from "@/components/shared/PolicyModal"

export function LandingFooter() {
  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Mock Tests", href: "/#exams" },
    { label: "Study Material", href: "/#features" },
    { label: "Current Affairs", href: "/#about" },
    { label: "Blogs", href: "/blogs" },
    { label: "About Us", href: "/#about" },
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
                      <a href={link.href} className="hover:text-sky-400 transition-colors">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="hover:text-sky-400 transition-colors">
                        {link.label}
                      </Link>
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
