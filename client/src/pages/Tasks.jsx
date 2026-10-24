
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "winfluencer_tasks";


const emptyTask = {
  title: "",
  description: "",
  priority: "Medium",
  status: "To Do",
  dueDate: "",
  dueTime: "",
  category: "Video Creation",
};


function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyTask);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setTasks(parsed);
      }
    } catch (error) {
      console.error("Could not load tasks:", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
  }, [tasks, loaded]);

  const counts = useMemo(
    () => ({
      total: tasks.length,
      todo: tasks.filter((task) => task.status === "To Do").length,
      progress: tasks.filter((task) => task.status === "In Progress").length,
      completed: tasks.filter((task) => task.status === "Completed").length,
    }),
    [tasks]
  );

  const completion = counts.total
    ? Math.round((counts.completed / counts.total) * 100)
    : 0;

  const visibleTasks = tasks.filter((task) => {
    const matchesFilter = filter === "All" || task.status === filter;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...emptyTask });
    setShowForm(true);
  };

  const openEditForm = (task) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      category: task.category,
    });
    setShowForm(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const title = form.title.trim();
    if (!title) return;

    if (editingId !== null) {
      setTasks((current) =>
        current.map((task) =>
          task.id === editingId
            ? { ...task, ...form, title }
            : task
        )
      );
    } else {
      setTasks((current) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...form,
          title,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    }

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyTask });
  };

  const updateStatus = (id, status) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, status } : task
      )
    );
  };

  const deleteTask = (id) => {
    if (!window.confirm("Delete this task permanently?")) return;
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const getDueLabel = (dueDate, status) => {
    if (!dueDate) return "No deadline";
    if (status === "Completed") return `Due ${dueDate}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDate}T00:00:00`);
    const difference = Math.round((due - today) / 86400000);

    if (difference < 0) return `Overdue · ${dueDate}`;
    if (difference === 0) return "Due today";
    if (difference === 1) return "Due tomorrow";
    return `Due ${dueDate}`;
  };

  return (
    <main className="main tasks-page">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">PLAN · CREATE · PUBLISH</p>
          <h1>Task Center</h1>
          <p className="subtitle">
            Turn your content ideas into completed work.
          </p>
        </div>

        <button className="analyze-btn" onClick={openCreateForm}>
          + Create Task
        </button>
      </div>

      <section className="task-summary">
        <div className="task-summary-card">
          <span>Total Tasks</span>
          <strong>{counts.total}</strong>
          <small>All your planned work</small>
        </div>
        <div className="task-summary-card">
          <span>To Do</span>
          <strong>{counts.todo}</strong>
          <small>Waiting to start</small>
        </div>
        <div className="task-summary-card">
          <span>In Progress</span>
          <strong>{counts.progress}</strong>
          <small>Currently working on</small>
        </div>
        <div className="task-summary-card">
          <span>Completed</span>
          <strong>{counts.completed}</strong>
          <small>{completion}% completion rate</small>
        </div>
      </section>

      <section className="task-progress-panel">
        <div className="task-progress-heading">
          <div>
            <h3>Overall Progress</h3>
            <p>Keep moving your content forward.</p>
          </div>
          <strong>{completion}%</strong>
        </div>
        <div
          className="task-progress-track"
          role="progressbar"
          aria-valuenow={completion}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Task completion"
        >
          <div
            className="task-progress-fill"
            style={{ width: `${completion}%` }}
          />
        </div>
      </section>

      <section className="task-list-section">
        <div className="task-list-heading">
          <div>
            <p className="section-label">YOUR WORKSPACE</p>
            <h2>Your Tasks</h2>
          </div>
          <input
            className="task-search"
            type="search"
            placeholder="Search tasks..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="task-filters">
          {["All", "To Do", "In Progress", "Completed"].map((status) => (
            <button
              key={status}
              className={`task-filter ${filter === status ? "selected" : ""}`}
              onClick={() => setFilter(status)}
            >
              {status}
              {status === "All" ? ` (${counts.total})` : ""}
            </button>
          ))}
        </div>

        {visibleTasks.length === 0 ? (
          <div className="task-empty">
            <div className="task-empty-icon">✓</div>
            <h3>
              {tasks.length === 0 ? "Your next big idea starts here" : "No matching tasks"}
            </h3>
            <p>
              {tasks.length === 0
                ? "Create a task to plan your next video, editing session, or upload."
                : "Try another filter or search term."}
            </p>
            {tasks.length === 0 && (
              <button className="analyze-btn" onClick={openCreateForm}>
                Create Your First Task
              </button>
            )}
          </div>
        ) : (
          <div className="task-list">
            {visibleTasks.map((task) => (
              <article className="task-card" key={task.id}>
                <div className="task-card-main">
                  <div className="task-card-title-row">
                    <h3>{task.title}</h3>
                    <span
                      className={`task-priority priority-${task.priority.toLowerCase()}`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  {task.description && <p>{task.description}</p>}

                  <div className="task-metadata">
                    <span>{task.category}</span>
                    <span
                      className={
                        task.dueDate &&
                        task.status !== "Completed" &&
                        new Date(`${task.dueDate}T00:00:00`) <
                          new Date(new Date().setHours(0, 0, 0, 0))
                          ? "task-overdue"
                          : ""
                      }
                    >
                    {task.dueDate
  ? `${getDueLabel(task.dueDate, task.status)}${
      task.dueTime
        ? ` · ${new Date(
            `2000-01-01T${task.dueTime}`
          ).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`
        : ""
    }`
  : "No deadline"}
                    </span>
                  </div>
                </div>

                <div className="task-card-actions">
                  <select
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    onChange={(event) =>
                      updateStatus(task.id, event.target.value)
                    }
                  >
                    <option>To Do</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                  <button
                    className="task-action-btn"
                    onClick={() => openEditForm(task)}
                  >
                    Edit
                  </button>
                  <button
                    className="task-action-btn delete"
                    onClick={() => deleteTask(task.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div
          className="task-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <section
            className="task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-form-title"
          >
            <div className="task-modal-heading">
              <div>
                <p className="section-label">TASK DETAILS</p>
                <h2 id="task-form-title">
                  {editingId !== null ? "Edit Task" : "Create a Task"}
                </h2>
              </div>
              <button
                className="task-modal-close"
                type="button"
                aria-label="Close form"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Task title *
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="e.g. Write my next video script"
                />
              </label>

              <label>
                Description
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="What needs to be done?"
                />
              </label>

              <div className="task-form-grid">
                <label>
                  Priority
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({ ...form, priority: event.target.value })
                    }
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value })
                    }
                  >
                    <option>To Do</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </label>
              </div>

              <div className="task-form-grid">
                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                  >
                    <option>Video Creation</option>
                    <option>Research</option>
                    <option>Scripting</option>
                    <option>Recording</option>
                    <option>Editing</option>
                    <option>Thumbnail</option>
                    <option>Publishing</option>
                    <option>Promotion</option>
                    <option>Other</option>
                  </select>
                </label>

                
<label>
  Deadline date *
  <input
    type="date"
    required
    value={form.dueDate}
    onChange={(event) =>
      setForm({ ...form, dueDate: event.target.value })
    }
  />
</label>

<label>
  Deadline time *
  <input
    type="time"
    required
    value={form.dueTime}
    onChange={(event) =>
      setForm({ ...form, dueTime: event.target.value })
    }
  />
</label>

              </div>

              <div className="task-form-actions">
                <button
                  type="button"
                  className="task-cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="analyze-btn">
                  {editingId !== null ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Tasks;
