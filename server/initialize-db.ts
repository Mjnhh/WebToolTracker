import { db, testConnection } from './pg-db';
import { users, chatSessions, chatMessages, inquiries, endpoints } from '../shared/schema';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function createTables() {
  if (!db) {
    console.log('No database connection available. Skipping table creation.');
    return;
  }
  
  try {
    console.log('Creating tables if they do not exist...');
    
    // Tạo bảng users
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        name TEXT NOT NULL
      )
    `);
    console.log('Created or verified users table');
    
    // Tạo bảng chat_sessions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        is_human_assigned BOOLEAN DEFAULT FALSE,
        assigned_to INTEGER
      )
    `);
    console.log('Created or verified chat_sessions table');
    
    // Tạo bảng chat_messages
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        sender TEXT NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);
    console.log('Created or verified chat_messages table');
    
    // Tạo bảng sessions (cho express-session với connect-pg-simple)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(255) NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    console.log('Created or verified sessions table');
    
    console.log('All tables created or verified successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

async function createAdminUser() {
  if (!db) {
    console.log('No database connection available. Skipping admin user creation.');
    return;
  }
  
  try {
    // Kiểm tra xem admin đã tồn tại chưa
    const existingAdmin = await db.select().from(users).where(sql`username = 'admin'`);
    
    if (existingAdmin.length === 0) {
      // Hash mật khẩu admin123
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      // Tạo tài khoản admin
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@tectonicdevs.com',
        name: 'Administrator',
        role: 'admin'
      });
      
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists, skipping creation');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

async function initializeDatabase() {
  // Kiểm tra kết nối
  const isConnected = await testConnection();
  
  if (!isConnected) {
    console.log('Database connection failed. Skipping initialization.');
    return;
  }
  
  // Tạo các bảng
  await createTables();
  
  // Tạo user admin
  await createAdminUser();
  
  console.log('Database initialization completed!');
}

// Khởi tạo database ngay khi file được import
initializeDatabase()
  .then(() => {
    console.log('Database initialization script completed');
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
  });

export { initializeDatabase }; 