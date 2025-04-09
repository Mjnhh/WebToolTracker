import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  // Kết nối đến postgres để tạo database
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    await client.connect();
    
    // Tạo database nếu chưa tồn tại
    await client.query(`
      SELECT 'CREATE DATABASE ${process.env.DB_NAME}'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${process.env.DB_NAME}')
    `);
    
    // Đóng kết nối đến postgres
    await client.end();

    // Kết nối đến database mới tạo
    const dbClient = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    await dbClient.connect();

    // Đọc và thực thi file schema.sql
    const schemaPath = path.join(__dirname, '../server/config/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await dbClient.query(schema);

    console.log('Database initialized successfully!');
    await dbClient.end();

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase(); 