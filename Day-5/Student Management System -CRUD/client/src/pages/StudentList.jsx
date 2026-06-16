import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getStudents } from '../api.js';
import StudentCard from '../components/StudentCard.jsx';

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    getStudents()
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const courses = useMemo(() => [...new Set(students.map((student) => student.course))].sort(), [students]);
  const years = useMemo(() => [...new Set(students.map((student) => student.year))].sort((a, b) => a - b), [students]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesName = student.name.toLowerCase().includes(term);
      const matchesCourse = course ? student.course === course : true;
      const matchesYear = year ? String(student.year) === year : true;
      return matchesName && matchesCourse && matchesYear;
    });
  }, [students, search, course, year]);

  return (
    <section className="page-grid">
      <div className="page-title">
        <p className="eyebrow">Class roster</p>
        <h1>Students</h1>
      </div>

      <div className="filter-bar">
        <label className="search-box">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select value={course} onChange={(event) => setCourse(event.target.value)} aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filter by year">
          <option value="">All years</option>
          {years.map((item) => (
            <option key={item} value={item}>
              Year {item}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="paper-panel state-panel">Loading students...</div>}
      {error && <div className="paper-panel state-panel error-state">{error}</div>}

      {!loading && !error && (
        <div className="student-grid">
          {filteredStudents.length ? (
            filteredStudents.map((student) => <StudentCard key={student.id} student={student} />)
          ) : (
            <div className="paper-panel state-panel">No students match those filters.</div>
          )}
        </div>
      )}
    </section>
  );
}
