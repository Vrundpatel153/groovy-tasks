import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { deleteStudent, getStudent } from '../api.js';

function formatDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getStudent(id)
      .then(setStudent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    const confirmed = window.confirm('Delete this student record?');
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteStudent(id);
      navigate('/students');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  if (loading) return <div className="paper-panel state-panel">Opening profile...</div>;
  if (error) return <div className="paper-panel state-panel error-state">{error}</div>;
  if (!student) return <div className="paper-panel state-panel">Student not found.</div>;

  return (
    <section className="detail-layout">
      <article className="profile-sheet">
        <div className="profile-head">
          <div>
            <p className="eyebrow">{student.course}</p>
            <h1>{student.name}</h1>
            <span className="tag">Year {student.year}</span>
          </div>
          <div className="action-row">
            <Link className="button secondary" to={`/students/${student.id}/edit`}>
              <Pencil size={18} />
              Edit
            </Link>
            <button className="button danger" type="button" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={18} />
              {deleting ? 'Deleting' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="profile-facts">
          <p>
            <Mail size={18} />
            {student.email}
          </p>
          <p>
            <Phone size={18} />
            {student.phone}
          </p>
          <p>
            <CalendarDays size={18} />
            Enrolled {formatDate(student.enrollment_date)}
          </p>
        </div>

        <section className="notes-section">
          <h2>Notes</h2>
          <p>{student.notes || 'No notes added yet.'}</p>
        </section>
      </article>
    </section>
  );
}
