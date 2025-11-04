import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Server,
  Key,
  Settings,
  Menu,
  X,
  LogOut,
  User,
  Activity,
  Tag,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Endpoints', href: '/endpoints', icon: Server },
  { name: 'API Keys', href: '/api-keys', icon: Key },
  { name: 'Tags', href: '/tags', icon: Tag },
  { name: 'Users', href: '/users', icon: User },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-snowflake-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-snowflake-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-xl font-bold text-snowflake-900">API Proxy</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-snowflake-400 hover:text-snowflake-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md mb-1 ${
                    isActive
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-snowflake-600 hover:bg-snowflake-50 hover:text-snowflake-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-primary-500' : 'text-snowflake-400 group-hover:text-snowflake-500'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-snowflake-200">
          <div className="flex h-16 items-center px-4">
            <h1 className="text-xl font-bold text-snowflake-900">Snowflake API Proxy</h1>
          </div>
          <nav className="flex-1 px-4 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md mb-1 ${
                    isActive
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-snowflake-600 hover:bg-snowflake-50 hover:text-snowflake-900'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-primary-500' : 'text-snowflake-400 group-hover:text-snowflake-500'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="flex-shrink-0 border-t border-snowflake-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <User className="h-8 w-8 text-snowflake-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-snowflake-700">{user?.username || 'Admin'}</p>
                <button
                  onClick={logout}
                  className="text-xs text-snowflake-500 hover:text-snowflake-700 flex items-center"
                >
                  <LogOut className="h-3 w-3 mr-1" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-snowflake-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-snowflake-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <div className="flex items-center gap-x-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm text-snowflake-600">Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
