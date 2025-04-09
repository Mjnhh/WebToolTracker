import pg from 'pg';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Get current file directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const { Pool } = pg;

async function initializeDatabase() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'tectonic_devs',
    password: process.env.DB_PASSWORD || '0906521260',
    port: parseInt(process.env.DB_PORT || '5432'),
  });

  try {
    // Read the schema file
    const schemaPath = join(__dirname, '../config/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Connect to database
    const client = await pool.connect();
    try {
      console.log('Creating database schema...');
      
      // Execute SQL commands
      await client.query(schema);
      
      console.log('Database schema created successfully!');
      
      // Add seed data if needed
      console.log('Adding seed data...');
      
      // Hash a simple password for admin
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      // Insert admin user
      await client.query(`
        INSERT INTO users (username, password, email, role, name)
        VALUES ('admin', $1, 'admin@tectonicdevs.com', 'admin', 'Administrator')
        ON CONFLICT (username) DO UPDATE SET password = $1
      `, [hashedPassword]);
        
      // Insert sample endpoints
      await client.query(`
        INSERT INTO endpoints (name, method, path, description, auth_required, is_active)
        VALUES 
          ('User Authentication', 'POST', '/api/auth/login', 'Authenticates users and returns JWT token', false, true),
          ('Get User Profile', 'GET', '/api/auth/profile', 'Gets the current user profile', true, true),
          ('Create Inquiry', 'POST', '/api/contact/submit', 'Submits a new contact inquiry', false, true)
        ON CONFLICT DO NOTHING
      `);
        
      // Insert default chatbot welcome message pattern
      await client.query(`
        INSERT INTO chatbot_patterns (pattern, response, score)
        VALUES ('welcome_message', '👋 Xin chào! Tôi là trợ lý ảo của TectonicDevs. Tôi có thể giúp bạn tìm hiểu về dịch vụ phát triển website, chatbot thông minh và các giải pháp công nghệ của chúng tôi. Bạn cần hỗ trợ gì?', 100)
        ON CONFLICT (pattern) DO UPDATE SET response = EXCLUDED.response
      `);
      
      console.log('Seed data added successfully!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase(); 