import { Globe, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 h-16 flex items-center justify-between px-6">
      <div className="flex items-center text-gray-500 md:hidden">
        <span className="font-bold text-lg text-gray-900 dark:text-white">ESSR PA</span>
      </div>
      <div className="hidden md:block text-gray-500">
        {/* Breadcrumbs could go here */}
      </div>
      <div className="flex items-center space-x-4">
        <button className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center space-x-2">
          <Globe size={20} />
          <span className="text-sm font-medium">English</span>
        </button>
        <button className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
          <User size={20} />
        </button>
      </div>
    </header>
  );
}
