import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '../shared/schema';
import dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

// Đảm bảo các biến môi trường được load
dotenv.config();

// Tạo connection pool nếu có DATABASE_URL
const connectionString = process.env.DATABASE_URL;
let db: ReturnType<typeof drizzle> | null = null;

if (connectionString) {
  try {
    const pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
    console.log('Drizzle ORM initialized with PostgreSQL');
  } catch (error) {
    console.error('Failed to initialize Drizzle with PostgreSQL:', error);
  }
}

// Kiểm tra kết nối và thực hiện query đơn giản
export async function testConnection() {
  if (!db) {
    console.log('No database connection available');
    return false;
  }
  
  try {
    await db.execute(sql`SELECT 1`);
    console.log('Database connection test successful');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export { db }; 