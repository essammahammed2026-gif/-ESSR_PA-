"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileCheck, BookOpen, Scissors, LayoutDashboard, Printer, Settings, Droplet, Menu, Barcode, Palette, Library } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

const NavItem = ({ href, icon, label, isCollapsed, pathname }: any) => {
  const isActive = pathname === href || (pathname.startsWith(href) && href !== '/');
  return (
    <Link 
      href={href}
      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors group relative ${
        isActive 
          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium" 
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
      title={isCollapsed ? label : ""}
    >
      <div className={`shrink-0 ${isActive ? "text-purple-600 dark:text-purple-400" : "text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300"}`}>
        {icon}
      </div>
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className={`${inter.className} flex h-screen bg-white dark:bg-[#080f1d] text-gray-800 dark:text-gray-200 overflow-hidden`}>
        {/* Left Sidebar */}
        <div className={`flex flex-col border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${isSidebarCollapsed ? "w-16" : "w-64"} bg-gray-50 dark:bg-[#101828]`}>
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
            {!isSidebarCollapsed && (
              <span className="font-bold text-lg text-purple-600 dark:text-purple-400">BlueWhale</span>
            )}
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md shrink-0">
              <Menu size={20} className="text-gray-500" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="space-y-1 px-2">
              <NavItem href="/" icon={<Home size={18}/>} label="Command Center" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/book-studio" icon={<BookOpen size={18}/>} label="Scanned Book Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/preflight" icon={<FileCheck size={18}/>} label="PDF Preflight" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/flipbook" icon={<BookOpen size={18}/>} label="Flipbook Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/contour" icon={<Scissors size={18}/>} label="Contour Cut Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/imposing" icon={<LayoutDashboard size={18}/>} label="Imposing Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/quickprint" icon={<Printer size={18}/>} label="Quick Print Studio" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/bleed" icon={<Droplet size={18}/>} label="Bleed Fixer" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/barcode" icon={<Barcode size={18}/>} label="Barcode & VDP" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/color" icon={<Palette size={18}/>} label="Color Profile" isCollapsed={isSidebarCollapsed} pathname={pathname} />
              <NavItem href="/cover" icon={<Library size={18}/>} label="Cover Builder" isCollapsed={isSidebarCollapsed} pathname={pathname} />
            </nav>
          </div>
          
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
             <NavItem href="/settings" icon={<Settings size={18}/>} label="Settings" isCollapsed={isSidebarCollapsed} pathname={pathname} />
          </div>
        </div>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-h-0 h-full p-6 md:p-8 relative">
          {children}
        </main>
      </body>
    </html>
  );
}
