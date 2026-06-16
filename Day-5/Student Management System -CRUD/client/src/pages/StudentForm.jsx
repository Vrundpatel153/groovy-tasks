import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { createStudent, getStudent, updateStudent } from '../api.js';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  course: '',
  year: '',
  enrollment_date: '',
  notes: ''
};

function toDateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function validate(form) {
  const errors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.email.trim()) errors.email = 'Email is required';
  if (form.email && !emailRegex.test(form.email)) errors.email = 'Enter a valid email';
  if (!form.phone.trim()) errors.phone = 'Phone is required';
  if (!form.course.trim()) errors.course = 'Course is required';
  if (!form.year) errors.year = 'Year is required';
  if (form.year && Number.isNaN(Number(form.year))) errors.year = 'Year must be a number';
  if (!form.enrollment_date) errors.enrollment_date = 'Enrollment date is required';

  return errors;
}

export default function StudentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isEdit) return;

    getStudent(id)
      .then((student) => {
        setForm({
          name: student.name || '',
          email: student.email || '',
          phone: student.phone || '',
          course: student.course || '',
          year: student.year || '',
          enrollment_date: toDateInput(student.enrollment_date),
          notes: student.notes || ''
        });
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setMessage('');

    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const payload = { ...form, year: Number(form.year) };
      const saved = isEdit ? await updateStudent(id, payload) : await createStudent(payload);
      navigate(`/students/${saved.id}`);
    } catch (err) {
      setErrors(err.errors || {});
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="paper-panel state-panel">Preparing form...</div>;

  return (
    <section className="form-layout">
      <div className="page-title">
        <p className="eyebrow">{isEdit ? 'Update record' : 'New admission'}</p>
        <h1>{isEdit ? 'Edit Student' : 'Add Student'}</h1>
      </div>

      <form className="paper-form" onSubmit={handleSubmit} noValidate>
        {message && <div className="form-alert">{message}</div>}

        <div className="form-grid">
          <label>
            Name
            <input name="name" value={form.name} onChange={updateField} />
            {errors.name && <small>{errors.name}</small>}
          </label>

          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={updateField} />
            {errors.email && <small>{errors.email}</small>}
          </label>

          <label>
            Phone
            <input name="phone" value={form.phone} onChange={updateField} />
            {errors.phone && <small>{errors.phone}</small>}
          </label>

          <label>
            Course
            <input name="course" value={form.course} onChange={updateField} />
            {errors.course && <small>{errors.course}</small>}
          </label>

          <label>
            Year
            <input name="year" type="number" min="1" value={form.year} onChange={updateField} />
            {errors.year && <small>{errors.year}</small>}
          </label>

          <label>
            Enrollment date
            <input name="enrollment_date" type="date" value={form.enrollment_date} onChange={updateField} />
            {errors.enrollment_date && <small>{errors.enrollment_date}</small>}
          </label>
        </div>

        <label>
          Notes
          <textarea name="notes" rows="5" value={form.notes} onChange={updateField} />
        </label>

        <div className="form-actions">
          <button className="button primary" type="submit" disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving' : 'Save Student'}
          </button>
        </div>
      </form>
    </section>
  );
}
