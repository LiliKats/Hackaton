import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { approvalsService } from '@/services/approvals.service';
import NotificationBadge from './NotificationBadge';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  User,
  LogOut,
  CheckSquare
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Check for pending approvals count for managers/admins
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (user?.role === UserRole.MANAGER || user?.role === UserRole.HR || user?.role === UserRole.ADMIN) {
        try {
          const approvals = await approvalsService.getPendingApprovals();
          setPendingApprovalsCount(approvals.length);
        } catch (error) {
          console.error('Error fetching pending approvals count:', error);
          // Set zero count on error instead of showing fake data
          setPendingApprovalsCount(0);
        }
      }
    };

    fetchPendingCount();

    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [user?.role]);

  // Base navigation items for all users
  const baseNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Leave Requests', href: '/leave-requests', icon: FileText },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Teams', href: '/teams', icon: Users },
  ];

  // Add approvals navigation for managers, HR, and admins
  const navigation = user?.role === UserRole.MANAGER || user?.role === UserRole.HR || user?.role === UserRole.ADMIN
    ? [
        ...baseNavigation.slice(0, 2), // Dashboard and Leave Requests
        { name: 'Approvals', href: '/approvals', icon: CheckSquare, badge: pendingApprovalsCount },
        ...baseNavigation.slice(2), // Calendar and Teams
      ]
    : baseNavigation;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <h1 className="text-xl font-bold text-primary-600">LeaveBoard</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const hasBadge = 'badge' in item && item.badge && item.badge > 0;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                        location.pathname === item.href
                          ? 'border-primary-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.name}
                      {hasBadge && (
                        <NotificationBadge
                          count={item.badge as number}
                          className="ml-2"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Dev Admin Indicator */}
              {user?.id === 'dev-admin-001' && (
                <div className="flex items-center bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                  🔧 DEV ADMIN
                </div>
              )}
              <Link
                to="/profile"
                className="flex items-center text-sm text-gray-700 hover:text-gray-900"
              >
                <User className="mr-2 h-5 w-5" />
                {user?.firstName} {user?.lastName}
              </Link>
              <button
                onClick={logout}
                className="flex items-center text-sm text-gray-700 hover:text-gray-900"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
