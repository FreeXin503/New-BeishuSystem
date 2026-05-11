/**
 * 移动端底部导航
 */

import { Link, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  gradient?: string;
}

interface MobileNavProps {
  items: NavItem[];
}

export default function MobileNav({ items }: MobileNavProps) {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {items.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative ${
                isActive
                  ? `text-white bg-gradient-to-r ${item.gradient} rounded-t-2xl`
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <div className={`relative mb-1 transition-transform duration-200 ${
                isActive ? 'scale-110 text-white' : 'scale-100 group-hover:scale-110'
              }`}>
                {item.icon}
              </div>
              <span className={`text-xs font-medium transition-all duration-200 ${
                isActive ? 'text-white font-semibold' : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
