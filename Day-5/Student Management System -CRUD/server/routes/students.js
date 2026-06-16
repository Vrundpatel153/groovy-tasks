import express from 'express';
import pool from '../db.js';

const router = express.Router();

const fields = ['name', 'email', 'phone', 'course', 'year', 'enrollment_date', 'notes'];

function validateStudent(body) {
  const errors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!body.name?.trim()) errors.name = 'Name is required';
  if (!body.email?.trim()) errors.email = 'Email is required';
  if (body.email && !emailRegex.test(body.email)) errors.email = 'Enter a valid email';
  if (!body.phone?.trim()) errors.phone = 'Phone is required';
  if (!body.course?.trim()) errors.course = 'Course is required';
  if (body.year === undefined || body.year === '') errors.year = 'Year is required';
  if (body.year && Number.isNaN(Number(body.year))) errors.year = 'Year must be a number';
  if (!body.enrollment_date) errors.enrollment_date = 'Enrollment date is required';

  return errors;
}

function studentValues(body) {
  return fields.map((field) => {
    if (field === 'year') return Number(body[field]);
    if (field === 'notes') return body[field] || '';
    return body[field];
  });
}

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY created_at DESC, id DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.id]);

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const errors = validateStudent(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const result = await pool.query(
      `INSERT INTO students (${fields.join(', ')})
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      studentValues(req.body)
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A student with this email already exists' });
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const errors = validateStudent(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const result = await pool.query(
      `UPDATE students
       SET name = $1,
           email = $2,
           phone = $3,
           course = $4,
           year = $5,
           enrollment_date = $6,
           notes = $7
       WHERE id = $8
       RETURNING *`,
      [...studentValues(req.body), req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A student with this email already exists' });
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
