"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  Home, 
  FileCheck, 
  BookOpen, 
  Scissors, 
  LayoutDashboard, 
  Settings, 
  Menu, 
  Layers,
  Power
} from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  description?: string;
  isCollapsed: boolean;
  pathname: string;
}

const NavItem = ({ href, icon, label, badge, description, isCollapsed, pathname }: NavItemProps) => {
  const isActive = pathname === href || (pathname.startsWith(href) && href !== "/");
  return (
    <Link 
      href={href}
      className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-all group relative text-xs ${
        isActive 
          ? "bg-cyan-500/10 text-cyan-400 font-medium border border-cyan-500/20 shadow-sm" 
          : "text-slate-400 hover:bg-[#1E2330] hover:text-slate-200"
      }`}
      title={description ? `${label} — ${description}` : label}
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className={`shrink-0 transition-colors ${isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-slate-200"}`}>
          {icon}
        </div>
        {!isCollapsed && <span className="truncate">{label}</span>}
      </div>
      {!isCollapsed && badge && (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#131720] text-slate-400 border border-[#2B3344]">
          {badge}
        </span>
      )}
    </Link>
  );
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
  const pathname = usePathname();

  const handleShutdown = async () => {
    setIsShuttingDown(true);
    try {
      const { getApiUrl } = await import("@/lib/api");
      await fetch(getApiUrl("/api/shutdown"), { method: "POST" });
    } catch {
      // Ignored since server process terminates immediately
    }
    setTimeout(() => {
      window.close();
      window.location.href = "about:blank";
    }, 800);
  };

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} flex h-screen bg-[#12151B] text-slate-200 overflow-hidden antialiased`}>
        {/* Left Sidebar */}
        <aside 
          className={`flex flex-col border-r border-[#242A38] transition-all duration-300 ${
            isSidebarCollapsed ? "w-14" : "w-56"
          } bg-[#181D27] shrink-0`}
        >
          {/* Brand Header */}
          <div className="h-12 flex items-center justify-between px-3 border-b border-[#242A38]">
            {!isSidebarCollapsed && (
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                  <Image src="/flint_mark.png" alt="Flint" width={28} height={28} className="object-contain" priority />
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-white">
                    FLINT
                  </span>
                  <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                    STUDIO
                  </span>
                </div>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center mx-auto">
                <Image src="/flint_mark.png" alt="Flint" width={26} height={26} className="object-contain" priority />
              </div>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu size={16} />
            </button>
          </div>
          
          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto py-2.5 px-2 space-y-3">
            <div>
              {!isSidebarCollapsed && (
                <div className="px-2.5 mb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  Overview
                </div>
              )}
              <nav className="space-y-0.5">
                <NavItem href="/" icon={<Home size={16}/>} label="Triage & Hub" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-2.5 mb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  Prepress & Ingest
                </div>
              )}
              <nav className="space-y-0.5">
                <NavItem href="/book-studio" icon={<BookOpen size={16}/>} label="Scanned Book Studio" badge="Bleed" description="Spread split, deskew & bleed synthesis" isCollapsed={isSidebarCollapsed} pathname={pathname} />
                <NavItem href="/preflight" icon={<FileCheck size={16}/>} label="PDF Preflight Center" description="TrimBox, BleedBox & DPI validation" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-2.5 mb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  Production & Finishing
                </div>
              )}
              <nav className="space-y-0.5">
                <NavItem href="/imposing" icon={<LayoutDashboard size={16}/>} label="Imposing Studio" badge="Gang" description="Sheet & roll layout with crop marks" isCollapsed={isSidebarCollapsed} pathname={pathname} />
                <NavItem href="/contour" icon={<Scissors size={16}/>} label="Contour Cut Studio" badge="SVG" description="Cutlines & white ink underbase" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-2.5 mb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  Digital Proofing
                </div>
              )}
              <nav className="space-y-0.5">
                <NavItem href="/flipbook" icon={<Layers size={16}/>} label="Flipbook Studio" description="3D interactive page-turn proofing" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>
          </div>
          
          {/* Settings & Shutdown Footer */}
          <div className="p-2 border-t border-[#242A38] space-y-1">
            <NavItem href="/settings" icon={<Settings size={16}/>} label="Settings & Stocks" description="Press sheets, roll media & presets" isCollapsed={isSidebarCollapsed} pathname={pathname} />
            
            <button
              onClick={() => setShowShutdownConfirm(true)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 group"
              title={isSidebarCollapsed ? "Shut Down Flint" : ""}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="shrink-0 text-rose-400 group-hover:text-rose-300">
                  <Power size={16} />
                </div>
                {!isSidebarCollapsed && <span className="truncate font-medium">Shut Down App</span>}
              </div>
            </button>
          </div>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-h-0 h-full p-3 md:p-4 lg:p-4 relative bg-[#12151B]">
          {children}

          {/* Shutdown Confirmation Modal */}
          {showShutdownConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in">
              <div className="bg-[#181D27] border border-[#2B3242] rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <Power size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Shut Down Flint?</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Stop all background servers and workers cleanly.</p>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#242A38]">
                  <button
                    disabled={isShuttingDown}
                    onClick={() => setShowShutdownConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isShuttingDown}
                    onClick={handleShutdown}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center space-x-1.5"
                  >
                    {isShuttingDown ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Stopping...</span>
                      </>
                    ) : (
                      <span>Shut Down</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </body>
    </html>
  );
}
