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
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group relative text-sm ${
        isActive 
          ? "bg-indigo-600/15 text-indigo-400 font-semibold border-l-2 border-indigo-500" 
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
      title={isCollapsed ? label : ""}
    >
      <div className="flex items-center space-x-3 min-w-0">
        <div className={`shrink-0 ${isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"}`}>
          {icon}
        </div>
        {!isCollapsed && <span className="truncate">{label}</span>}
      </div>
      {!isCollapsed && badge && (
        <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
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
            isSidebarCollapsed ? "w-16" : "w-64"
          } bg-[#181D27] shrink-0`}
        >
          {/* Brand Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#242A38]">
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-lg tracking-tight text-white">
                    ESSR <span className="text-indigo-400">PA</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                    PRO
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">
                  BlueWhale Prepress
                </span>
              </div>
            )}
            {isSidebarCollapsed && (
              <span className="font-extrabold text-base text-indigo-400 mx-auto">
                PA
              </span>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu size={18} />
            </button>
          </div>
          
          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
            <div>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Overview
                </div>
              )}
              <nav className="space-y-1">
                <NavItem href="/" icon={<Home size={18}/>} label="Command Center" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Prepress & Ingest
                </div>
              )}
              <nav className="space-y-1">
                <NavItem href="/book-studio" icon={<BookOpen size={18}/>} label="Scanned Book Studio" badge="Bleed" isCollapsed={isSidebarCollapsed} pathname={pathname} />
                <NavItem href="/preflight" icon={<FileCheck size={18}/>} label="PDF Preflight Center" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Production & Finishing
                </div>
              )}
              <nav className="space-y-1">
                <NavItem href="/imposing" icon={<LayoutDashboard size={18}/>} label="Imposing Studio" badge="Gang" isCollapsed={isSidebarCollapsed} pathname={pathname} />
                <NavItem href="/contour" icon={<Scissors size={18}/>} label="Contour Cut Studio" badge="SVG" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>

            <div>
              {!isSidebarCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Digital Proofing
                </div>
              )}
              <nav className="space-y-1">
                <NavItem href="/flipbook" icon={<Layers size={18}/>} label="Flipbook Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              </nav>
            </div>
          </div>
          
          {/* Settings Footer */}
          <div className="p-3 border-t border-[#242A38]">
            <NavItem href="/settings" icon={<Settings size={18}/>} label="Settings & Stocks" isCollapsed={isSidebarCollapsed} pathname={pathname} />
          </div>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-h-0 h-full p-6 md:p-8 relative bg-[#12151B]">
          {children}
        </main>
      </body>
    </html>
  );
}
