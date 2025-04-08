import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { storage } from './storage';
import pkg from 'pg';
const { Pool } = pkg;
import pgSession from 'connect-pg-simple';

// Import routes
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import supportRoutes from "./routes/support";
import contactRoutes from "./routes/contact";
import adminRoutes from "./routes/admin";
import spotifyRoutes from "./routes/spotify";
import { createUserRouter } from "./routes/users";
import voucherRoutes from "./routes/vouchers";

// Create Express app
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// PostgreSQL Connection Pool
const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Session configuration
if (pool) {
  // PostgreSQL session store if DATABASE_URL is provided
  const PgSession = pgSession(session);
  app.use(session({
    store: new PgSession({
      pool,
      tableName: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    }
  }));
  console.log('Using PostgreSQL session store');
} else {
  // Memory session store if no DATABASE_URL
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    }
  }));
  console.log('Using memory session store');
}

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/spotify", spotifyRoutes);
app.use("/api/users", createUserRouter());
app.use("/api/vouchers", voucherRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize server
const PORT = process.env.PORT || 3000;

function startServer() {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Kiểm tra kết nối PostgreSQL nếu có
function testDatabaseConnection() {
  if (!pool) {
    console.log('No DATABASE_URL provided - skipping database connection test');
    return Promise.resolve();
  }
  
  return new Promise<void>((resolve, reject) => {
    pool.query('SELECT NOW()', (err, result) => {
      if (err) {
        console.error('Database connection failed:', err);
        reject(err);
      } else {
        console.log('Database connection successful!');
        resolve();
      }
    });
  });
}

// Khởi động server sau khi kiểm tra kết nối
testDatabaseConnection()
  .then(() => {
    startServer();
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
    console.log('Starting server without database connection...');
    startServer();
  });

export default app; 