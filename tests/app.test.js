const request = require('supertest');
const createApp = require('../src/app');
const TaskStore = require('../src/store');

let app;
beforeEach(() => {
  app = createApp(new TaskStore(null)); // fresh in-memory store per test
});

describe('platform endpoints', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/version returns version info', async () => {
    const res = await request(app).get('/api/version');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('commit');
  });
});

describe('tasks API', () => {
  it('creates a task with defaults', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Finish DevOps lab' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ id: 1, title: 'Finish DevOps lab', subject: 'General', priority: 'medium', done: false });
  });

  it('rejects a task without a title', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '  ' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects bad priority and date', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'x', priority: 'urgent', dueDate: '12/10/2026' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveLength(2);
  });

  it('lists and filters by status and subject', async () => {
    await request(app).post('/api/tasks').send({ title: 'A', subject: 'DevOps' });
    await request(app).post('/api/tasks').send({ title: 'B', subject: 'DBMS' });
    await request(app).patch('/api/tasks/1').send({ done: true });

    expect((await request(app).get('/api/tasks')).body).toHaveLength(2);
    expect((await request(app).get('/api/tasks?status=done')).body).toHaveLength(1);
    expect((await request(app).get('/api/tasks?status=pending')).body[0].title).toBe('B');
    expect((await request(app).get('/api/tasks?subject=dbms')).body).toHaveLength(1);
  });

  it('updates a task and ignores unknown fields', async () => {
    await request(app).post('/api/tasks').send({ title: 'A' });
    const res = await request(app).patch('/api/tasks/1').send({ title: 'A2', hacker: true });
    expect(res.body.title).toBe('A2');
    expect(res.body.hacker).toBeUndefined();
  });

  it('returns 404 for missing tasks', async () => {
    expect((await request(app).patch('/api/tasks/99').send({ done: true })).statusCode).toBe(404);
    expect((await request(app).delete('/api/tasks/99')).statusCode).toBe(404);
  });

  it('deletes a task', async () => {
    await request(app).post('/api/tasks').send({ title: 'A' });
    expect((await request(app).delete('/api/tasks/1')).statusCode).toBe(204);
    expect((await request(app).get('/api/tasks')).body).toHaveLength(0);
  });

  it('reports stats including overdue tasks', async () => {
    await request(app).post('/api/tasks').send({ title: 'old', dueDate: '2000-01-01' });
    await request(app).post('/api/tasks').send({ title: 'done', dueDate: '2000-01-01' });
    await request(app).patch('/api/tasks/2').send({ done: true });
    const res = await request(app).get('/api/stats');
    expect(res.body).toEqual({ total: 2, done: 1, pending: 1, overdue: 1 });
  });
});

describe('TaskStore persistence', () => {
  it('saves to and reloads from a file', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-')), 'tasks.json');
    const a = new TaskStore(file);
    a.create({ title: 'persist me' });
    const b = new TaskStore(file);
    expect(b.list()).toHaveLength(1);
    expect(b.create({ title: 'next' }).id).toBe(2);
  });
});
