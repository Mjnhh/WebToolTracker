-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact form inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service endpoints table
CREATE TABLE IF NOT EXISTS endpoints (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    description TEXT,
    auth_required BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    sender TEXT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    is_human_assigned BOOLEAN DEFAULT FALSE,
    assigned_to INTEGER REFERENCES users(id)
);

-- Vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_by INTEGER REFERENCES users(id),
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    metadata JSONB
);

-- Chatbot patterns table
CREATE TABLE IF NOT EXISTS chatbot_patterns (
    id SERIAL PRIMARY KEY,
    pattern TEXT NOT NULL UNIQUE,
    response TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat ratings table
CREATE TABLE IF NOT EXISTS chat_ratings (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES chat_sessions(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    staff_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    CONSTRAINT valid_rating CHECK (rating IN (1, 2, 3, 4, 5))
);

-- Session storage table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON "sessions" ("expire"); 