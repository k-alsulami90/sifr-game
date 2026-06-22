import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './routes/Home.jsx';
import Admin from './routes/Admin.jsx';
import Display from './routes/Display.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/display" element={<Display />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
