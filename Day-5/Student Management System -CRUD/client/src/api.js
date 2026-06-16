const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed');
    error.errors = data.errors || {};
    throw error;
  }

  return data;
}

export function getStudents() {
  return request('/students');
}

export function getStudent(id) {
  return request(`/students/${id}`);
}

export function createStudent(student) {
  return request('/students', {
    method: 'POST',
    body: JSON.stringify(student)
  });
}

export function updateStudent(id, student) {
  return request(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(student)
  });
}

export function deleteStudent(id) {
  return request(`/students/${id}`, {
    method: 'DELETE'
  });
}
