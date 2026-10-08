const express = require('express');
const path = require('path');
const TaskStore = require('./store');

const PRIORITIES = ['low', 'medium', 'high'];

function validate(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) errors.push('title is required');
  }
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    errors.push('priority must be low, medium or high');
  }
  if (body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
    errors.push('dueDate must be YYYY-MM-DD');
  }
  if (body.done !== undefined && typeof body.done !== 'boolean') errors.push('done must be a boolean');
  return errors;
}

function createApp(store = new TaskStore()) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.get('/api/version', (_req, res) =>
    res.json({ version: process.env.APP_VERSION || 'dev', commit: process.env.GIT_SHA || 'local' }));

  app.get('/api/tasks', (req, res) => res.json(store.list(req.query)));

  app.get('/api/stats', (_req, res) => res.json(store.stats()));

  app.post('/api/tasks', (req, res) => {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const { title, subject, dueDate, priority } = req.body;
    res.status(201).json(store.create({ title: title.trim(), subject, dueDate, priority }));
  });

  app.patch('/api/tasks/:id', (req, res) => {
    const errors = validate(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    const allowed = ['title', 'subject', 'dueDate', 'priority', 'done'];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const task = store.update(Number(req.params.id), changes);
    if (!task) return res.status(404).json({ error: 'task not found' });
    res.json(task);
  });

  app.delete('/api/tasks/:id', (req, res) => {
    if (!store.remove(Number(req.params.id))) return res.status(404).json({ error: 'task not found' });
    res.status(204).end();
  });

  return app;
}

module.exports = createApp;
