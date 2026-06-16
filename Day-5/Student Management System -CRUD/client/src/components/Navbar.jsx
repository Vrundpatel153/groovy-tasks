import { Link, NavLink } from 'react-router-dom';
import { BookOpen, LayoutDashboard, Plus, UsersRound } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="navbar">
      <Link to="/" className="brand" aria-label="Student notebook home">
        <span className="brand-mark">
          <BookOpen size={24} />
        </span>
        <span>Student Notebook</span>
      </Link>

      <nav className="nav-links" aria-label="Primary navigation">
        <NavLink to="/" end>
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>
        <NavLink to="/students">
          <UsersRound size={18} />
          Students
        </NavLink>
        <NavLink to="/students/new" className="nav-cta">
          <Plus size={18} />
          Add Student
        </NavLink>
      </nav>
    </header>
  );
}
