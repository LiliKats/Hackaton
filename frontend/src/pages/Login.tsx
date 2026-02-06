import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loginAsAdmin, loginAsManager, loginAsEmployee1, loginAsEmployee2, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      // Redirect will be handled by useEffect when isAuthenticated changes
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    }
  };

  const handleAdminLogin = () => {
    loginAsAdmin();
  };

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to LeaveBoard
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Manage your vacation and leave requests
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        {/* Development Test Login Buttons - Only show in development mode */}
        {import.meta.env.DEV && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">
                🔧 Quick Test Logins
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleAdminLogin}
                  className="flex justify-center py-1.5 px-3 border border-blue-300 text-xs font-medium rounded bg-blue-50 text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  👤 Admin
                </button>
                <button
                  type="button"
                  onClick={loginAsManager}
                  className="flex justify-center py-1.5 px-3 border border-green-300 text-xs font-medium rounded bg-green-50 text-green-700 hover:bg-green-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  👔 Manager
                </button>
                <button
                  type="button"
                  onClick={loginAsEmployee1}
                  className="flex justify-center py-1.5 px-3 border border-orange-300 text-xs font-medium rounded bg-orange-50 text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  👨‍💻 John Doe
                </button>
                <button
                  type="button"
                  onClick={loginAsEmployee2}
                  className="flex justify-center py-1.5 px-3 border border-purple-300 text-xs font-medium rounded bg-purple-50 text-purple-700 hover:bg-purple-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  👩‍💼 Jane Smith
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Quick login buttons for testing different user roles
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;