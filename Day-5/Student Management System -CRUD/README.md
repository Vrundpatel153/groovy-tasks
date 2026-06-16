# Student Management CRUD App

Full-stack student management app with a React Vite frontend, Node/Express backend, and PostgreSQL hosted on Neon.
<img width="1907" height="960" alt="image" src="https://github.com/user-attachments/assets/f19d7aa4-b6f9-4bdc-8b32-04641b2d082c" />
<img width="1897" height="956" alt="image" src="https://github.com/user-attachments/assets/191b4e65-0489-45fb-8fe5-8b591e75882e" />
<img width="1883" height="976" alt="image" src="https://github.com/user-attachments/assets/55a0b28b-31e6-4e82-a930-a688c52519a1" />

## Project Structure

```txt
server/
  server.js
  db.js
  routes/students.js
db/
  schema.sql
client/
  src/pages/Dashboard.jsx
  src/pages/StudentList.jsx
  src/pages/StudentDetail.jsx
  src/pages/StudentForm.jsx
  src/components/Navbar.jsx
  src/components/StudentCard.jsx
  src/api.js
  src/index.css
```

## Setup

1. Install backend dependencies:

```bash
cd server
npm install
```

2. Add your Neon database URL:

```bash
cp .env.example .env
```

Update `server/.env`:

```env
DATABASE_URL=postgresql://username:password@host.neon.tech/database?sslmode=require
```

3. Create the database table by running `db/schema.sql` in the Neon SQL console or through the VS Code Postgres extension.

4. Start the backend:

```bash
cd server
node server.js
```

The API runs at `http://localhost:5000`.

5. Install frontend dependencies:

```bash
cd client
npm install
```

6. Start the frontend:

```bash
cd client
npm run dev
```

The app runs at `http://127.0.0.1:5173`.

## Features

- Dashboard with total students, course counts, and recent additions
- Student list with search by name and filters for course and year
- Student profile details with notes
- Add, edit, and delete students
- Frontend and backend validation
- Loading and error states
- Neon PostgreSQL connection through `process.env.DATABASE_URL`
