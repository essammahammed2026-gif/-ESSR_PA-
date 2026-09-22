"use client";

import { Activity, FileCheck, Layers, Droplet } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const stats = [
    { name: 'Jobs Today', value: '24', icon: Activity, color: 'text-blue-500' },
    { name: 'Preflight Errors', value: '3', icon: FileCheck, color: 'text-red-500' },
    { name: 'Bleeds Fixed', value: '12', icon: Droplet, color: 'text-purple-500' },
    { name: 'Imposed Sheets', value: '156', icon: Layers, color: 'text-green-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.name}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-full bg-gray-50 dark:bg-gray-700 ${stat.color}`}>
                <Icon size={24} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/book-studio" className="p-4 border dark:border-gray-700 rounded-lg hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-gray-700 transition-all flex flex-col items-center text-center">
            <Layers size={32} className="text-amber-500 mb-3" />
            <span className="font-medium">Scanned Book Studio</span>
            <span className="text-sm text-gray-500 mt-1">Collate, clean & 3mm bleed</span>
          </Link>

          <Link href="/preflight" className="p-4 border dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all flex flex-col items-center text-center">
            <FileCheck size={32} className="text-blue-500 mb-3" />
            <span className="font-medium">Run Preflight Check</span>
            <span className="text-sm text-gray-500 mt-1">Analyze PDFs for print issues</span>
          </Link>
          
          <Link href="/bleed" className="p-4 border dark:border-gray-700 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-gray-700 transition-all flex flex-col items-center text-center">
            <Droplet size={32} className="text-purple-500 mb-3" />
            <span className="font-medium">Auto-Bleed Fixer</span>
            <span className="text-sm text-gray-500 mt-1">Generate missing bleeds</span>
          </Link>
          
          <Link href="/imposing" className="p-4 border dark:border-gray-700 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-gray-700 transition-all flex flex-col items-center text-center">
            <Layers size={32} className="text-green-500 mb-3" />
            <span className="font-medium">Impose Print Job</span>
            <span className="text-sm text-gray-500 mt-1">Layout pages on press sheets</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
