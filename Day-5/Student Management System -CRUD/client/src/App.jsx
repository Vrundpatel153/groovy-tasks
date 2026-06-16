import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-wrap">
        <Outlet />
      </main>
    </div>
  );
}
