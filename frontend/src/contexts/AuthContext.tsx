import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse, UserRole } from '@/types';
import { authService } from '@/services/auth.service';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  loginAsAdmin: () => void;
  loginAsManager: () => void;
  loginAsEmployee1: () => void;
  loginAsEmployee2: () => void;
  refreshAdminLogin: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development test users - DO NOT USE IN PRODUCTION
const DEV_ADMIN_USER: User = {
  id: 'admin-001',
  email: 'admin@dev.local',
  firstName: 'Admin',
  lastName: 'User',
  role: UserRole.ADMIN,
  position: 'System Administrator',
  department: 'IT',
  hireDate: '2024-01-01',
  annualLeaveDays: 25,
  usedLeaveDays: 0,
  isActive: true,
};

const DEV_MANAGER_USER: User = {
  id: 'manager-001',
  email: 'manager@company.com',
  firstName: 'Sarah',
  lastName: 'Manager',
  role: UserRole.MANAGER,
  position: 'Engineering Manager',
  department: 'Engineering',
  hireDate: '2024-01-01',
  annualLeaveDays: 28,
  usedLeaveDays: 5,
  isActive: true,
};

const DEV_EMPLOYEE1_USER: User = {
  id: 'emp-001',
  email: 'john.doe@company.com',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.EMPLOYEE,
  position: 'Software Engineer',
  department: 'Engineering',
  hireDate: '2024-01-01',
  annualLeaveDays: 25,
  usedLeaveDays: 7,
  isActive: true,
};

const DEV_EMPLOYEE2_USER: User = {
  id: 'emp-002',
  email: 'jane.smith@company.com',
  firstName: 'Jane',
  lastName: 'Smith',
  role: UserRole.EMPLOYEE,
  position: 'Product Manager',
  department: 'Product',
  hireDate: '2024-01-01',
  annualLeaveDays: 25,
  usedLeaveDays: 3,
  isActive: true,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);

      // Check for development admin credentials (only in development mode)
      if (import.meta.env.DEV && email === 'admin@dev.local' && password === 'admin') {
        localStorage.setItem('access_token', 'dev-admin-token');
        localStorage.setItem('user', JSON.stringify(DEV_ADMIN_USER));
        setUser(DEV_ADMIN_USER);
        console.warn('🔧 Development admin login detected - NOT FOR PRODUCTION!');
        return;
      }

      // Regular authentication
      const response: AuthResponse = await authService.login(email, password);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginAsAdmin = () => {
    // Quick admin login for development only
    if (!import.meta.env.DEV) {
      console.error('Admin bypass only available in development mode!');
      return;
    }

    // Force clear old data first
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');

    localStorage.setItem('access_token', 'dev-admin-token');
    localStorage.setItem('user', JSON.stringify(DEV_ADMIN_USER));
    setUser(DEV_ADMIN_USER);
    console.warn('🔧 Development admin login - NOT FOR PRODUCTION!');
  };

  const loginAsManager = () => {
    // Quick manager login for development only
    if (!import.meta.env.DEV) {
      console.error('Manager bypass only available in development mode!');
      return;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('user');

    localStorage.setItem('access_token', 'dev-manager-token');
    localStorage.setItem('user', JSON.stringify(DEV_MANAGER_USER));
    setUser(DEV_MANAGER_USER);
    console.warn('🔧 Development manager login - NOT FOR PRODUCTION!');
  };

  const loginAsEmployee1 = () => {
    // Quick employee login for development only
    if (!import.meta.env.DEV) {
      console.error('Employee bypass only available in development mode!');
      return;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('user');

    localStorage.setItem('access_token', 'dev-employee1-token');
    localStorage.setItem('user', JSON.stringify(DEV_EMPLOYEE1_USER));
    setUser(DEV_EMPLOYEE1_USER);
    console.warn('🔧 Development employee login (John Doe) - NOT FOR PRODUCTION!');
  };

  const loginAsEmployee2 = () => {
    // Quick employee login for development only
    if (!import.meta.env.DEV) {
      console.error('Employee bypass only available in development mode!');
      return;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('user');

    localStorage.setItem('access_token', 'dev-employee2-token');
    localStorage.setItem('user', JSON.stringify(DEV_EMPLOYEE2_USER));
    setUser(DEV_EMPLOYEE2_USER);
    console.warn('🔧 Development employee login (Jane Smith) - NOT FOR PRODUCTION!');
  };

  const register = async (userData: any) => {
    try {
      setLoading(true);
      const response: AuthResponse = await authService.register(userData);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const refreshAdminLogin = () => {
    // Force clear old cached data and re-login with correct admin user
    if (!import.meta.env.DEV) {
      console.error('Admin refresh only available in development mode!');
      return;
    }

    console.log('🔄 Refreshing admin login with correct user ID...');

    // Clear all cached data
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);

    // Re-login with correct admin user
    setTimeout(() => {
      localStorage.setItem('access_token', 'dev-admin-token');
      localStorage.setItem('user', JSON.stringify(DEV_ADMIN_USER));
      setUser(DEV_ADMIN_USER);
      console.warn('✅ Admin login refreshed with user ID:', DEV_ADMIN_USER.id);
    }, 100);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      loginAsAdmin,
      loginAsManager,
      loginAsEmployee1,
      loginAsEmployee2,
      refreshAdminLogin,
      isAuthenticated: !!user,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
