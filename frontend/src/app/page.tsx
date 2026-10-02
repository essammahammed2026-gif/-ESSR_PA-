"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  FileCheck, 
  Layers, 
  BookOpen, 
  Scissors, 
  Sliders, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Server
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export default function Dashboard() {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    fetch(`${API_BASE_URL}/`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ok") {
          setBackendStatus("online");
        } else {
          setBackendStatus("offline");
        }
      })
      .catch(() => {
        setBackendStatus("offline");
      });
  }, []);

  const studios = [
    {
      name: "Scanned Book Studio",
      href: "/book-studio",
      description: "Dual-scanner collate (odds/evens), spread split, deskew, margin border cleanup & 3mm synthesized bleed generation.",
      icon: BookOpen,
      badge: "Book Printing",
      color: "from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/30",
      accent: "text-amber-400",
      formats: "PDF, JPG, PNG",
    },
    {
      name: "PDF Preflight Center",
      href: "/preflight",
      description: "Automated prepress validation: TrimBox/BleedBox verification, RGB ink detection, font integrity & resolution inspection.",
      icon: FileCheck,
      badge: "Prepress QA",
      color: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/30",
      accent: "text-blue-400",
      formats: "PDF (Single/Multi-page)",
    },
    {
      name: "Imposing Studio",
      href: "/imposing",
      description: "Gang-run step & repeat, roll/sheet nesting, margin & gutter controls, crop/fold marks, live efficiency HUD & print PDF export.",
      icon: Layers,
      badge: "Press Production",
      color: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/30",
      accent: "text-emerald-400",
      formats: "PDF, SRA3, B2, Custom Rolls",
    },
    {
      name: "Contour Cut Studio",
      href: "/contour",
      description: "Die-cut path generator: Edge thresholding, curve smoothing, dilation/choke bleed, white matte underbase & SVG export.",
      icon: Scissors,
      badge: "Finishing & Die-Cut",
      color: "from-pink-500/20 to-pink-600/5 text-pink-400 border-pink-500/30",
      accent: "text-pink-400",
      formats: "PNG, JPG, SVG Vector",
    },
    {
      name: "Flipbook Studio",
      href: "/flipbook",
      description: "Interactive 3D virtual page-turn proofing, binding simulation (paperback, hardcover, spiral), and client preview bundle.",
      icon: Layers,
      badge: "Digital Proof",
      color: "from-indigo-500/20 to-indigo-600/5 text-indigo-400 border-indigo-500/30",
      accent: "text-indigo-400",
      formats: "HTML5, ZIP Package",
    },
    {
      name: "Settings & Presets",
      href: "/settings",
      description: "Manage offset press sheet dimensions, wide-format roll stocks, bleed margins, and global preflight tolerances.",
      icon: Sliders,
      badge: "Press Config",
      color: "from-slate-500/20 to-slate-600/5 text-slate-300 border-slate-600/30",
      accent: "text-slate-300",
      formats: "Global System Defaults",
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-6">
      {/* Compact Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#242A38]">
        <div className="flex items-center space-x-2.5">
          <h1 className="text-base md:text-lg font-bold tracking-tight text-white">Command Center</h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
            v2.4
          </span>
          <span className="hidden xl:inline text-xs text-slate-400 border-l border-[#242A38] pl-2.5">
            Prepress automation, print layout imposing, and finishing management suite
          </span>
        </div>

        {/* Engine Status Indicator */}
        <div className="flex items-center space-x-2 bg-[#181D27] px-2.5 py-1 rounded-lg border border-[#242A38] self-start sm:self-auto shrink-0">
          <Server size={14} className="text-slate-400" />
          <span className="text-[11px] text-slate-400">Engine API:</span>
          {backendStatus === "checking" && (
            <span className="text-[11px] font-semibold text-slate-400">Connecting...</span>
          )}
          {backendStatus === "online" && (
            <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Online (FastAPI / PyMuPDF)</span>
            </div>
          )}
          {backendStatus === "offline" && (
            <div className="flex items-center space-x-1.5 text-red-400 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Workflow Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38] flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold">Prepress Quality</div>
            <div className="text-base font-bold text-white mt-0.5">Automated Checks Active</div>
            <div className="text-xs text-slate-400">TrimBox, BleedBox & DPI validation</div>
          </div>
        </div>

        <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38] flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold">Press Efficiency</div>
            <div className="text-base font-bold text-white mt-0.5">Optimized N-Up Packing</div>
            <div className="text-xs text-slate-400">Dynamic waste minimization</div>
          </div>
        </div>

        <div className="bg-[#181D27] p-5 rounded-xl border border-[#242A38] flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-pink-500/10 text-pink-400">
            <Scissors size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold">Die-Cut Finishing</div>
            <div className="text-base font-bold text-white mt-0.5">Vector Contour Spot Colors</div>
            <div className="text-xs text-slate-400">Precise 1pt CutContour stroke</div>
          </div>
        </div>
      </div>

      {/* Active Studios Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Active Production Studios</h2>
          <span className="text-xs text-slate-400">6 Functional Workspaces</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {studios.map((studio) => {
            const Icon = studio.icon;
            return (
              <Link 
                key={studio.name} 
                href={studio.href}
                className="group relative bg-[#181D27] hover:bg-[#1E2432] p-5 rounded-xl border border-[#242A38] hover:border-indigo-500/50 transition-all flex flex-col justify-between shadow-sm hover:shadow-indigo-500/5"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-lg border bg-gradient-to-br ${studio.color}`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-[#12151B] text-slate-400 border border-[#242A38]">
                      {studio.badge}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors text-base flex items-center justify-between">
                    {studio.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {studio.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[#242A38] flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {studio.formats}
                  </span>
                  <span className="text-indigo-400 flex items-center space-x-1 font-medium group-hover:translate-x-0.5 transition-transform">
                    <span>Open</span>
                    <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
