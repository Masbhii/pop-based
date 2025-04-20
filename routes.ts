import express from 'express';
import pool from './db';


const router = express.Router();

// --- PROJECTS ---
router.get('/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY id');
    const projects = await Promise.all(result.rows.map(async p => {
      // Ambil semua tasks untuk project ini
      const tasksRes = await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY id', [p.id]);
      const tasks = tasksRes.rows.map(row => ({
        id: row.id,
        title: row.title,
        dueDate: row.due_date,
        assignee: row.assignee,
        completed: row.completed
        // projectId sengaja tidak dikirim ke frontend agar mapping sesuai tipe Task frontend
      }));
      // Ambil semua messages untuk project ini
      const messagesRes = await pool.query('SELECT * FROM messages WHERE project_id = $1 ORDER BY id', [p.id]);
      const messages = messagesRes.rows.map(msg => ({
        id: msg.id,
        author: msg.author,
        content: msg.content,
        date: msg.created_at || msg.date || new Date().toISOString(),
        avatar: msg.avatar
      }));
      return {
        ...p,
        tasks,
        progress: tasks.length > 0 ? Math.round(tasks.filter(t => t.completed).length / tasks.length * 100) : 0,
        messages
      };
    }));
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/projects', async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    // Patch: tambahkan tasks, progress, messages agar sesuai kebutuhan frontend
    const project = {
      ...result.rows[0],
      tasks: [],
      progress: 0,
      messages: []
    };
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add project' });
  }
});

router.put('/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE projects SET name=$1, description=$2 WHERE id=$3 RETURNING *',
      [name, description, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM projects WHERE id=$1', [id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// --- TEAM MEMBERS ---
router.get('/team', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM team_members ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

router.post('/team', async (req, res) => {
  const { name, role, email, avatar, job_desc } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO team_members (name, role, email, avatar, job_desc) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, role, email, avatar, job_desc]
    );
    // Kirim email undangan otomatis
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER, // set di .env
          pass: process.env.EMAIL_PASS  // set di .env
        }
      });
      await transporter.sendMail({
        from: 'noreply@projectapp.com',
        to: email,
        subject: 'You are invited!',
        text: `Hi ${name},\n\nYou are invited by our team to join as ${role} at Project Management App.\n\nBest regards,\nProject Management Team`
      });
    } catch (err) {
      console.error('Gagal mengirim email:', err);
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

router.put('/team/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, email } = req.body;
  try {
    const result = await pool.query(
      'UPDATE team_members SET name=$1, role=$2, email=$3 WHERE id=$4 RETURNING *',
      [name, role, email, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

router.delete('/team/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM team_members WHERE id=$1', [id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

// --- TASKS ---
router.post('/tasks', async (req, res) => {
  const { projectId, title, dueDate, assignee } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (project_id, title, due_date, assignee, completed) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [projectId, title, dueDate, assignee, false]
    );
    // Mapping field ke camelCase agar konsisten dengan frontend
    const row = result.rows[0];
    const task = {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      dueDate: row.due_date,
      assignee: row.assignee,
      completed: row.completed
    };
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add task' });
  }
});

// --- TOGGLE TASK COMPLETION ---
// --- TOGGLE TASK COMPLETION ---
router.put('/tasks/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tasks SET completed = $1 WHERE id = $2 RETURNING *',
      [completed, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task completion' });
  }
});

// --- DELETE TASK ---
router.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// --- MESSAGES ---
router.delete('/messages/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM messages WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

router.post('/messages', async (req, res) => {
  const { projectId, author, content, avatar } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO messages (project_id, author, content, avatar) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, author, content, avatar]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// --- EVENTS ---
router.get('/events', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/events', async (req, res) => {
  const { title, date, description, attendees } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO events (title, date, description, attendees) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, date, description, attendees || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add event' });
  }
});

router.put('/events/:id', async (req, res) => {
  const { id } = req.params;
  const { title, date, description, attendees } = req.body;
  try {
    const result = await pool.query(
      'UPDATE events SET title=$1, date=$2, description=$3, attendees=$4 WHERE id=$5 RETURNING *',
      [title, date, description, attendees || [], id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM events WHERE id=$1', [id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
