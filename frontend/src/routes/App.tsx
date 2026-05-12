import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import Landing from '../pages/Landing';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import AccountSetup from '../pages/auth/AccountSetup';
import ForgotPassword from '../pages/auth/ForgotPassword';
import OAuthCallback from '../pages/auth/OAuthCallback';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import AdminDashboard from '../pages/admin/AdminDashboard';
import Users from '../pages/admin/Users';
import Products from '../pages/admin/Products';
import Orders from '../pages/admin/Orders';
import SecureFileVault from '../pages/admin/SecureFileVault';
import Reports from '../pages/admin/Reports';
import SecurityCenter from '../pages/admin/SecurityCenter';
import AttackSimulation from '../pages/admin/AttackSimulation';
import AuditLogs from '../pages/admin/AuditLogs';
import Architecture from '../pages/admin/Architecture';
import Settings from '../pages/admin/Settings';
import UserDashboard from '../pages/user/UserDashboard';
import UserProducts from '../pages/user/UserProducts';
import MyOrders from '../pages/user/MyOrders';
import MyFiles from '../pages/user/MyFiles';
import Profile from '../pages/user/Profile';

export default function App() {
  return <AuthProvider><Routes>
    <Route path="/" element={<Landing/>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/register" element={<Register/>}/>
    <Route path="/setup-account" element={<AccountSetup/>}/>
    <Route path="/forgot-password" element={<ForgotPassword/>}/>
    <Route path="/oauth/callback" element={<OAuthCallback/>}/>
    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AppLayout role="admin"/></ProtectedRoute>}>
      <Route index element={<Navigate to="/admin/dashboard" replace/>}/>
      <Route path="dashboard" element={<AdminDashboard/>}/>
      <Route path="users" element={<Users/>}/>
      <Route path="products" element={<Products/>}/>
      <Route path="orders" element={<Orders/>}/>
      <Route path="vault" element={<SecureFileVault/>}/>
      <Route path="reports" element={<Reports/>}/>
      <Route path="security" element={<SecurityCenter/>}/>
      <Route path="attack-simulation" element={<AttackSimulation/>}/>
      <Route path="audit-logs" element={<AuditLogs/>}/>
      <Route path="architecture" element={<Architecture/>}/>
      <Route path="settings" element={<Settings/>}/>
    </Route>
    <Route path="/user" element={<ProtectedRoute requiredRole="user"><AppLayout role="user"/></ProtectedRoute>}>
      <Route index element={<Navigate to="/user/dashboard" replace/>}/>
      <Route path="dashboard" element={<UserDashboard/>}/>
      <Route path="products" element={<UserProducts/>}/>
      <Route path="orders" element={<MyOrders/>}/>
      <Route path="files" element={<MyFiles/>}/>
      <Route path="profile" element={<Profile/>}/>
    </Route>
  </Routes></AuthProvider>;
}
