"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  FileCheck, 
  BookOpen, 
  Scissors, 
  LayoutDashboard, 
  Settings, 
  Menu, 
  Layers
} from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  isCollapsed: boolean;
  pathname: string;
}

const NavItem = ({ href, icon, label, badge, isCollapsed, pathname }: NavItemProps) => {
  const isActive = pathname === href || (pathname.startsWith(href) && href !== "/");
  return (
    <Link 
      href={href}
      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all group relative text-xs ${
        isActive 
          ? "bg-indigo-600/15 text-indigo-400 font-semibold border-l-2 border-indigo-500" 
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
      title={isCollapsed ? label : ""}
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className={`shrink-0 ${isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"}`}>
          {icon}
        </div>
        {!isCollapsed && <span className="truncate">{label}</span>}
      </div>
      {!isCollapsed && badge && (
        <span className="text-[9px] font-semibold tracking-wider uppercase px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
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
  const pathname = usePathname();

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
          <div className="h-11 flex items-center justify-between px-3 border-b border-[#242A38]">
            {!isSidebarCollapsed && (
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm tracking-tight text-white">
                  ESSR <span className="text-indigo-400">PA</span>
                </span>
                <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                  PRO
                </span>
              </div>
            )}
            {isSidebarCollapsed && (
              <span className="font-extrabold text-xs text-indigo-400 mx-auto">
                PA
              </span>
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
                <div className="px-2.5 mb-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  Overview
                </div>
              )}
              <nav className="space-y-0.5">
                <NavItem href="/" icon={<Home size={16}/>} label="Command Center" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-2.5 mb-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  Prepress & Ingest
                </div>
              )}
              <nav className="space-y-0.5">
                <NavItem href="/book-studio" icon={<BookOpen size={16}/>} label="Scanned Book Studio" badge="Bleed" isCollapsed={isSidebarCollapsed} pathname={pathname} />
                <NavItem href="/preflight" icon={<FileCheck size={16}/>} label="PDF Preflight Center" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-2.5 mb-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  Production & Finishing
                </div>
              )}
              <nav className="space-y-0.5">
                <NavItem href="/imposing" icon={<LayoutDashboard size={16}/>} label="Imposing Studio" badge="Gang" isCollapsed={isSidebarCollapsed} pathname={pathname} />
                <NavItem href="/contour" icon={<Scissors size={16}/>} label="Contour Cut Studio" badge="SVG" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-2.5 mb-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  Digital Proofing
                </div>
              )}
              <nav className="space-y-0.5">
                <NavItem href="/flipbook" icon={<Layers size={16}/>} label="Flipbook Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>
          </div>
          
          {/* Settings Footer */}
          <div className="p-2 border-t border-[#242A38]">
            <NavItem href="/settings" icon={<Settings size={16}/>} label="Settings & Stocks" isCollapsed={isSidebarCollapsed} pathname={pathname} />
          </div>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-h-0 h-full p-3 md:p-4 lg:p-4 relative bg-[#12151B]">
          {children}
        </main>
      </body>
    </html>
  );
}
