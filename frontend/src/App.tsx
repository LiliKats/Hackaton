import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import LeaveRequests from '@/pages/LeaveRequests';
import Calendar from '@/pages/Calendar';
import Teams from '@/pages/Teams';
import Profile from '@/pages/Profile';
import PrivateRoute from '@/components/PrivateRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leave-requests" element={<LeaveRequests />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
