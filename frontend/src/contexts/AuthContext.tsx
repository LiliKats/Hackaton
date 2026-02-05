import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse, UserRole } from '@/types';
import { authService } from '@/services/auth.service';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  loginAsAdmin: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development admin user - DO NOT USE IN PRODUCTION
const DEV_ADMIN_USER: User = {
  id: 'dev-admin-001',
  email: 'admin@dev.local',
  firstName: 'Admin',
  lastName: 'Developer',
  role: UserRole.ADMIN,
  position: 'System Administrator',
  department: 'IT',
  hireDate: '2024-01-01',
  annualLeaveDays: 25,
  usedLeaveDays: 0,
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
    localStorage.setItem('access_token', 'dev-admin-token');
    localStorage.setItem('user', JSON.stringify(DEV_ADMIN_USER));
    setUser(DEV_ADMIN_USER);
    console.warn('🔧 Development admin login - NOT FOR PRODUCTION!');
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

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      loginAsAdmin,
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
