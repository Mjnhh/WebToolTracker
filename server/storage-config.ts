import { PostgresStorage } from './pg-storage';
import { IStorage } from './storage';

// Khởi tạo storage instance
let storage: IStorage;

if (process.env.DATABASE_URL) {
  storage = new PostgresStorage();
  console.log('Using PostgreSQL storage');
} else {
  throw new Error('DATABASE_URL is required');
}

export { storage }; 