import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ConsultantsList from './ConsultantsList';
import ConsultantDetails from './ConsultantDetails';
import Login from './Login';
import AdminUsers from './AdminUsers';
import AdminPermissions from './AdminPermissions';
import { AuthProvider } from './AuthContext';
import AddConsultant from "./AddConsultant";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ConsultantsList />} />
          <Route path="/consultants/:id" element={<ConsultantDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/permissions" element={<AdminPermissions />} />
          <Route path="/consultants/new" element={<AddConsultant />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
