import { Link } from 'react-router-dom';
import { CalendarDays, Mail, NotebookPen, Phone } from 'lucide-react';

function formatDate(date) {
  if (!date) return 'No date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

export default function StudentCard({ student }) {
  return (
    <article className="student-card">
      <div className="card-pin" />
      <div className="card-heading">
        <div>
          <p className="eyebrow">{student.course}</p>
          <h3>{student.name}</h3>
        </div>
        <span className="tag">Year {student.year}</span>
      </div>

      <div className="card-lines">
        <p>
          <Mail size={16} />
          {student.email}
        </p>
        <p>
          <Phone size={16} />
          {student.phone}
        </p>
        <p>
          <CalendarDays size={16} />
          Enrolled {formatDate(student.enrollment_date)}
        </p>
      </div>

      {student.notes && (
        <p className="note-preview">
          <NotebookPen size={16} />
          {student.notes}
        </p>
      )}

      <Link className="text-link" to={`/students/${student.id}`}>
        Open profile
      </Link>
    </article>
  );
}
