const tasks = [
  { id: 1, title: "Install dependencies", done: true },
  { id: 2, title: "Run the Groq CLI", done: false },
  { id: 3, title: "Read the usage dashboard", done: false },
];

function listTasks() {
  return tasks.map((task) => {
    const status = task.done ? "done" : "open";
    return `${task.id}. [${status}] ${task.title}`;
  });
}

function completeTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    throw new Error(`Task ${id} was not found.`);
  }
  task.done = true;
  return task;
}

module.exports = { listTasks, completeTask };
