import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import StudentForm from './pages/StudentForm.jsx';
import StudentList from './pages/StudentList.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<StudentList />} />
          <Route path="students/new" element={<StudentForm />} />
          <Route path="students/:id" element={<StudentDetail />} />
          <Route path="students/:id/edit" element={<StudentForm />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
