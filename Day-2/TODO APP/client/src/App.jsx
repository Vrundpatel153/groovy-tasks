import React, { useEffect, useState } from "react";

const API_URL = "http://localhost:5000/todos";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState("");
  const remaining = todos.filter((todo) => !todo.done).length;

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then(setTodos);
  }, []);

  async function addTodo(event) {
    event.preventDefault();
    const trimmed = text.trim();

    if (!trimmed) return;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed })
    });

    const todo = await res.json();
    setTodos((current) => [...current, todo]);
    setText("");
  }

  async function toggleTodo(todo) {
    const res = await fetch(`${API_URL}/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !todo.done })
    });

    const updated = await res.json();
    setTodos((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  async function deleteTodo(id) {
    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    setTodos((current) => current.filter((todo) => todo.id !== id));
  }

  return (
    <main style={styles.page}>
      <section style={styles.notebook}>
        <div style={styles.spiral} aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <span key={index} style={styles.ring} />
          ))}
        </div>
        <div style={styles.marginLine} aria-hidden="true" />

        <header style={styles.header}>
          <div>
            <p style={styles.kicker}>Today's page</p>
            <h1 style={styles.title}>Todo Notes</h1>
          </div>
          <div style={styles.count}>
            <strong style={styles.countNumber}>{remaining}</strong>
            <span>{remaining === 1 ? "task" : "tasks"} left</span>
          </div>
        </header>

        <form onSubmit={addTodo} style={styles.form}>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write a task..."
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            Add
          </button>
        </form>

        {todos.length === 0 ? (
          <div style={styles.empty}>This page is blank. Add your first task.</div>
        ) : (
          <ul style={styles.list}>
            {todos.map((todo) => (
              <li key={todo.id} style={styles.item}>
                <label style={styles.label}>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleTodo(todo)}
                    style={styles.checkbox}
                  />
                  <span style={todo.done ? styles.doneText : styles.todoText}>
                    {todo.text}
                  </span>
                </label>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  style={styles.delete}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    boxSizing: "border-box",
    fontFamily:
      "Georgia, Cambria, Times New Roman, serif",
    background:
      "linear-gradient(135deg, #d7e0dc 0%, #f1e6d1 52%, #cfd9e5 100%)",
    color: "#26221d"
  },
  notebook: {
    position: "relative",
    width: "min(680px, 100%)",
    minHeight: 650,
    padding: "54px 42px 46px 92px",
    boxSizing: "border-box",
    overflow: "hidden",
    background:
      "repeating-linear-gradient(#fffaf0 0 33px, #b8d4ea 34px 35px), linear-gradient(90deg, rgba(255,255,255,0.7), rgba(255,255,255,0))",
    border: "1px solid #ded0b4",
    borderRadius: 8,
    boxShadow:
      "0 26px 70px rgba(63, 54, 41, 0.28), inset 0 0 45px rgba(154, 119, 68, 0.08)"
  },
  spiral: {
    position: "absolute",
    top: 34,
    bottom: 34,
    left: 22,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  },
  ring: {
    width: 34,
    height: 18,
    border: "3px solid #6e7884",
    borderRight: 0,
    borderRadius: "14px 0 0 14px",
    background: "rgba(255, 250, 240, 0.7)",
    boxShadow: "inset 0 1px 2px rgba(255,255,255,0.7)"
  },
  marginLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 74,
    width: 2,
    background: "rgba(205, 79, 79, 0.42)"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 26,
    position: "relative"
  },
  kicker: {
    margin: "0 0 6px",
    color: "#7a6b56",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0
  },
  title: {
    margin: 0,
    fontFamily:
      "Bradley Hand ITC, Segoe Print, Comic Sans MS, Georgia, serif",
    fontSize: 44,
    lineHeight: 1.05,
    fontWeight: 700,
    letterSpacing: 0
  },
  count: {
    display: "grid",
    placeItems: "center",
    minWidth: 86,
    minHeight: 64,
    transform: "rotate(2deg)",
    border: "1px solid #d8c49c",
    borderRadius: 8,
    background: "#fff3b8",
    color: "#5c4a22",
    fontSize: 12,
    boxShadow: "0 7px 16px rgba(75, 60, 28, 0.14)"
  },
  countNumber: {
    display: "block",
    fontSize: 24
  },
  form: {
    display: "flex",
    gap: 10,
    marginBottom: 22,
    position: "relative"
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: "12px 14px",
    border: "0",
    borderBottom: "2px solid #8aa9c0",
    borderRadius: 0,
    outline: "none",
    fontFamily:
      "Bradley Hand ITC, Segoe Print, Comic Sans MS, Georgia, serif",
    fontSize: 20,
    background: "rgba(255, 250, 240, 0.35)",
    color: "#24313d"
  },
  button: {
    padding: "0 20px",
    border: 0,
    borderRadius: 8,
    background: "#2f5d8c",
    color: "#fff",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    boxShadow: "0 5px 0 #1f3f61"
  },
  empty: {
    padding: "34px 12px",
    color: "#8b7a62",
    textAlign: "center",
    fontFamily:
      "Bradley Hand ITC, Segoe Print, Comic Sans MS, Georgia, serif",
    fontSize: 22
  },
  list: {
    display: "grid",
    gap: 0,
    padding: 0,
    margin: 0,
    listStyle: "none",
    position: "relative"
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 35,
    padding: "0 0 0 4px",
    background: "transparent"
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: 1
  },
  checkbox: {
    width: 19,
    height: 19,
    accentColor: "#2f5d8c",
    flex: "0 0 auto"
  },
  todoText: {
    overflowWrap: "anywhere",
    lineHeight: 1.35,
    fontFamily:
      "Bradley Hand ITC, Segoe Print, Comic Sans MS, Georgia, serif",
    fontSize: 22,
    color: "#24313d"
  },
  doneText: {
    color: "#8a8073",
    textDecoration: "line-through",
    overflowWrap: "anywhere",
    lineHeight: 1.35,
    fontFamily:
      "Bradley Hand ITC, Segoe Print, Comic Sans MS, Georgia, serif",
    fontSize: 22
  },
  delete: {
    padding: "4px 8px",
    border: 0,
    borderRadius: 4,
    background: "rgba(178, 70, 58, 0.08)",
    color: "#9b3b31",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13
  }
};
