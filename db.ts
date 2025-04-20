// server/db.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,       // e.g. 'postgres'
  host: process.env.DB_HOST,       // e.g. 'localhost'
  database: process.env.DB_NAME,   // e.g. 'project_db'
  password: process.env.DB_PASS,   // sesuai PostgreSQL kamu
  port: Number(process.env.DB_PORT) || 5432,
});

export default pool;
