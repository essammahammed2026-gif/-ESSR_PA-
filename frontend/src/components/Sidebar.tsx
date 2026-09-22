"use client";

import { useState } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  FileCheck, 
  BookOpen, 
  Scissors, 
  Printer, 
  Droplet, 
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Book Studio', href: '/book-studio', icon: BookOpen },
  { name: 'Preflight Center', href: '/preflight', icon: FileCheck },
  { name: 'Flipbook Studio', href: '/flipbook', icon: Layers },
  { name: 'Contour Cut', href: '/contour', icon: Scissors },
  { name: 'Quick Print', href: '/print', icon: Printer },
  { name: 'Auto-Bleed', href: '/bleed', icon: Droplet },
  { name: 'Imposing', href: '/imposing', icon: Layers },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-gray-900 text-white min-h-screen flex flex-col hidden md:flex transition-all duration-300 relative`}>
      <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && <h1 className="text-2xl font-bold tracking-wider text-blue-400">ESSR PA</h1>}
        {isCollapsed && <h1 className="text-xl font-bold text-blue-400">ES</h1>}
      </div>
      
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-7 bg-gray-800 border border-gray-700 rounded-full p-1 hover:bg-gray-700 transition-colors z-10"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <nav className={`flex-1 px-3 space-y-2 mt-4`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.name} 
              href={item.href}
              title={item.name}
              className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'} ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Icon size={20} className="shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
            </Link>
          );
        })}
      </nav>
      
      <div className={`p-4 border-t border-gray-800 ${isCollapsed ? 'text-center' : ''}`}>
        <div className="text-xs text-gray-500 whitespace-nowrap">
          {isCollapsed ? 'v1.0' : 'v1.0.0-web'}
        </div>
      </div>
    </aside>
  );
}
