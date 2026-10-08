const fs = require('fs');
const path = require('path');

// Simple task store. Persists to a JSON file when DATA_FILE is set (used in Docker),
// otherwise keeps tasks in memory (used in tests).
class TaskStore {
  constructor(file = process.env.DATA_FILE) {
    this.file = file;
    this.tasks = [];
    this.nextId = 1;
    if (this.file && fs.existsSync(this.file)) {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.tasks = saved.tasks || [];
      this.nextId = saved.nextId || this.tasks.length + 1;
    }
  }

  _save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ tasks: this.tasks, nextId: this.nextId }, null, 2));
  }

  list({ status, subject } = {}) {
    return this.tasks.filter((t) => {
      if (status === 'done' && !t.done) return false;
      if (status === 'pending' && t.done) return false;
      if (subject && t.subject.toLowerCase() !== subject.toLowerCase()) return false;
      return true;
    });
  }

  get(id) {
    return this.tasks.find((t) => t.id === id);
  }

  create({ title, subject, dueDate, priority }) {
    const task = {
      id: this.nextId++,
      title,
      subject: subject || 'General',
      dueDate: dueDate || null,
      priority: priority || 'medium',
      done: false,
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(task);
    this._save();
    return task;
  }

  update(id, changes) {
    const task = this.get(id);
    if (!task) return null;
    Object.assign(task, changes);
    this._save();
    return task;
  }

  remove(id) {
    const i = this.tasks.findIndex((t) => t.id === id);
    if (i === -1) return false;
    this.tasks.splice(i, 1);
    this._save();
    return true;
  }

  stats() {
    const today = new Date().toISOString().slice(0, 10);
    const done = this.tasks.filter((t) => t.done).length;
    const overdue = this.tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today).length;
    return { total: this.tasks.length, done, pending: this.tasks.length - done, overdue };
  }
}

module.exports = TaskStore;
