"use client";

import { Roboto } from "next/font/google";
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
  Layers,
  Power
} from "lucide-react";

const font = Roboto({ 
  weight: ["300", "400", "500", "700"], 
  subsets: ["latin"],
  display: "swap",
});

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  pathname: string;
}

const NavItem = ({ href, icon, label, isCollapsed, pathname }: NavItemProps) => {
  const isActive = pathname === href || (pathname.startsWith(href) && href !== "/");
  return (
    <div className="relative group flex items-center justify-center">
      <Link 
        href={href}
        className={`flex items-center ${
          isCollapsed ? "justify-center w-10 h-10" : "px-2.5 py-2 w-full space-x-2.5"
        } rounded-lg transition-all text-xs ${
          isActive 
            ? "bg-cyan-500/15 text-cyan-400 font-medium border border-cyan-500/30 shadow-sm shadow-cyan-950/40" 
            : "text-slate-400 hover:bg-[#1E2330] hover:text-slate-200 border border-transparent"
        }`}
        title={label}
      >
        <div className={`shrink-0 transition-colors ${isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-slate-200"}`}>
          {icon}
        </div>
        {!isCollapsed && <span className="truncate">{label}</span>}
      </Link>

      {/* Floating tooltip on hover when collapsed */}
      {isCollapsed && (
        <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1B212D] text-slate-100 text-xs font-medium rounded-md shadow-2xl border border-[#2E374A] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 flex items-center shadow-black/80">
          <span>{label}</span>
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1B212D]" />
        </div>
      )}
    </div>
  );
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
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
      <body className={`${font.className} flex h-screen bg-[#12151B] text-slate-200 overflow-hidden antialiased`}>
        {/* Left Sidebar */}
        <aside 
          className={`flex flex-col border-r border-[#242A38] transition-all duration-300 ${
            isSidebarCollapsed ? "w-14" : "w-56"
          } bg-[#181D27] shrink-0 z-30`}
        >
          {/* Brand Header - Clicking Logo Toggles Sidebar */}
          <div className="h-12 flex items-center border-b border-[#242A38] px-2.5">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-full flex items-center transition-all group/logo focus:outline-none"
              title={isSidebarCollapsed ? "Click to expand sidebar" : "Click to collapse sidebar"}
            >
              {!isSidebarCollapsed ? (
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0 group-hover/logo:scale-105 transition-transform">
                    <Image src="/flint_mark.png" alt="Flint" width={28} height={28} className="object-contain" priority />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-sm tracking-tight text-white group-hover/logo:text-cyan-400 transition-colors">
                      FLINT
                    </span>
                    <span className="text-[8px] font-mono uppercase px-1 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                      STUDIO
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center justify-center relative group">
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center group-hover/logo:ring-2 group-hover/logo:ring-cyan-500/40 transition-all">
                    <Image src="/flint_mark.png" alt="Flint" width={26} height={26} className="object-contain" priority />
                  </div>
                  <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1B212D] text-slate-100 text-xs font-medium rounded-md shadow-2xl border border-[#2E374A] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 flex items-center shadow-black/80">
                    <span className="font-semibold text-cyan-400">Expand Sidebar</span>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1B212D]" />
                  </div>
                </div>
              )}
            </button>
          </div>
          
          {/* Navigation Links (Ungrouped Studio List) */}
          <div className={`flex-1 ${isSidebarCollapsed ? "overflow-visible" : "overflow-y-auto"} py-2.5 px-2`}>
            <nav className="space-y-1">
              <NavItem href="/" icon={<Home size={18}/>} label="Home" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/book-studio" icon={<BookOpen size={18}/>} label="Book Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/preflight" icon={<FileCheck size={18}/>} label="Preflight Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/imposing" icon={<LayoutDashboard size={18}/>} label="Imposing Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/contour" icon={<Scissors size={18}/>} label="Contour Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/flipbook" icon={<Layers size={18}/>} label="Flipbook Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
            </nav>
          </div>
          
          {/* Settings & Shutdown Footer */}
          <div className={`p-2 border-t border-[#242A38] space-y-1 ${isSidebarCollapsed ? "overflow-visible" : ""}`}>
            <NavItem href="/settings" icon={<Settings size={18}/>} label="Settings" isCollapsed={isSidebarCollapsed} pathname={pathname} />
            
            <div className="relative group flex items-center justify-center">
              <button
                onClick={() => setShowShutdownConfirm(true)}
                className={`flex items-center ${
                  isSidebarCollapsed ? "justify-center w-10 h-10" : "px-2.5 py-2 w-full space-x-2.5"
                } rounded-lg transition-all text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 border border-transparent`}
                title="Shut Down App"
              >
                <Power size={18} className="shrink-0 text-rose-400 group-hover:text-rose-300" />
                {!isSidebarCollapsed && <span className="truncate font-medium">Shut Down App</span>}
              </button>
              {isSidebarCollapsed && (
                <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1B212D] text-rose-300 text-xs font-medium rounded-md shadow-2xl border border-rose-500/30 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 flex items-center shadow-black/80">
                  <span>Shut Down App</span>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1B212D]" />
                </div>
              )}
            </div>
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
