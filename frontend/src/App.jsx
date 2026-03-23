import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import TasksList from './pages/TasksList.jsx';
import TaskDetails from './pages/TaskDetails.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TasksList />} />
      <Route path="/tasks/:id" element={<TaskDetails />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

