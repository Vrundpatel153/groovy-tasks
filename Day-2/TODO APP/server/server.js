const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let todos = [];
let nextId = 1;

app.get("/todos", (req, res) => {
  res.json(todos);
});

app.post("/todos", (req, res) => {
  const text = String(req.body.text || "").trim();

  if (!text) {
    return res.status(400).json({ error: "Todo text is required" });
  }

  const todo = { id: nextId++, text, done: false };
  todos.push(todo);
  res.status(201).json(todo);
});

app.patch("/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((item) => item.id === id);

  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }

  if (typeof req.body.text === "string") {
    todo.text = req.body.text.trim();
  }

  if (typeof req.body.done === "boolean") {
    todo.done = req.body.done;
  }

  res.json(todo);
});

app.delete("/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  const originalLength = todos.length;
  todos = todos.filter((todo) => todo.id !== id);

  if (todos.length === originalLength) {
    return res.status(404).json({ error: "Todo not found" });
  }

  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
