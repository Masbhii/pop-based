// server/index.ts
import express from 'express';
import cors from 'cors';
import pool from './db';
import routes from './routes';

const app = express();
const port = 3001;

import path from 'path';
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(cors());
app.use(express.json());

// Main API routes
app.use('/api', routes);

// Test route
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
