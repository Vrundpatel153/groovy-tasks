import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, Clock3, GraduationCap, UsersRound } from 'lucide-react';
import { getStudents } from '../api.js';

function LoadingState() {
  return <div className="paper-panel state-panel">Loading notebook...</div>;
}

function ErrorState({ message }) {
  return <div className="paper-panel state-panel error-state">{message}</div>;
}

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getStudents()
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const courseStats = useMemo(() => {
    return students.reduce((acc, student) => {
      acc[student.course] = (acc[student.course] || 0) + 1;
      return acc;
    }, {});
  }, [students]);

  const recentStudents = students.slice(0, 4);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="page-grid">
      <div className="page-title">
        <p className="eyebrow">Classroom overview</p>
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <article className="stat-card sage">
          <UsersRound size={28} />
          <span>Total students</span>
          <strong>{students.length}</strong>
        </article>
        <article className="stat-card blue">
          <GraduationCap size={28} />
          <span>Courses</span>
          <strong>{Object.keys(courseStats).length}</strong>
        </article>
        <article className="stat-card yellow">
          <BookMarked size={28} />
          <span>Newest year</span>
          <strong>{students.length ? Math.max(...students.map((student) => Number(student.year))) : 0}</strong>
        </article>
      </div>

      <div className="dashboard-columns">
        <section className="paper-panel">
          <div className="section-heading">
            <h2>Students per course</h2>
            <Link to="/students" className="text-link">
              View all
            </Link>
          </div>
          <div className="course-list">
            {Object.entries(courseStats).length ? (
              Object.entries(courseStats).map(([course, count]) => (
                <div className="course-row" key={course}>
                  <span>{course}</span>
                  <strong>{count}</strong>
                </div>
              ))
            ) : (
              <p className="empty-copy">No students yet.</p>
            )}
          </div>
        </section>

        <section className="paper-panel">
          <div className="section-heading">
            <h2>Recent additions</h2>
            <Clock3 size={20} />
          </div>
          <div className="recent-list">
            {recentStudents.length ? (
              recentStudents.map((student) => (
                <Link to={`/students/${student.id}`} className="recent-row" key={student.id}>
                  <span>{student.name}</span>
                  <small>{student.course}</small>
                </Link>
              ))
            ) : (
              <p className="empty-copy">Add your first student to fill the notebook.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
