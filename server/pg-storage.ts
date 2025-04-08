import { IStorage } from './storage';
import { db } from './pg-db';
import { users, chatSessions, chatMessages, inquiries, endpoints } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import type { User, InsertUser, ChatSession, InsertChatSession, ChatMessage, Inquiry, InsertInquiry, Endpoint, InsertEndpoint } from '@shared/schema';
import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

export class PostgresStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Tạo PostgreSQL session store
    if (process.env.DATABASE_URL) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const PgSession = pgSession(session);
      this.sessionStore = new PgSession({
        pool,
        tableName: 'sessions'
      });
      console.log('PostgreSQL session store initialized');
    } else {
      // Fallback nếu không có DATABASE_URL
      console.log('No DATABASE_URL provided - using memory session store');
      throw new Error('PostgreSQL session store requires DATABASE_URL');
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    if (!db) return undefined;
    
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) return undefined;
    
    const result = await db.select().from(users).where(eq(users.username, username));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!db) return undefined;
    
    const result = await db.select().from(users).where(eq(users.email, email));
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    if (!db) throw new Error('Database not available');
    
    // Hash password if not already hashed
    let password = user.password;
    if (!password.startsWith('$2')) {
      const salt = await bcrypt.genSalt(10);
      password = await bcrypt.hash(user.password, salt);
    }
    
    // Create user with role
    const newUser = {
      username: user.username,
      password: password,
      email: user.email,
      name: user.name || user.username,
      role: user.role || 'user'
    };
    
    const result = await db.insert(users).values(newUser).returning();
    return result[0];
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    if (!db) throw new Error('Database not available');
    
    // Hash password nếu có cập nhật mật khẩu
    if (updates.password && !updates.password.startsWith('$2')) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }
    
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
      
    if (result.length === 0) {
      throw new Error('User not found');
    }
    
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    if (!db) return [];
    
    return await db.select().from(users);
  }

  // Chat operations
  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    if (!db) throw new Error('Database not available');
    
    const now = new Date();
    const newSession = {
      id: session.id,
      userId: session.userId || null,
      metadata: session.metadata || null,
      startedAt: now,
      lastActivity: now,
      isHumanAssigned: false,
      assignedTo: null
    };
    
    const result = await db.insert(chatSessions)
      .values(newSession)
      .returning();
      
    // Add welcome message
    await this.addWelcomeMessage(session.id);
    
    return result[0];
  }
  
  private async addWelcomeMessage(sessionId: string): Promise<void> {
    const welcomeMessage = {
      sessionId,
      content: `👋 Xin chào! Tôi là trợ lý ảo của TectonicDevs. Tôi có thể giúp bạn tìm hiểu về dịch vụ phát triển website, chatbot thông minh và các giải pháp công nghệ của chúng tôi. Bạn cần hỗ trợ gì?`,
      sender: "bot",
      timestamp: new Date(),
      metadata: null
    };
    
    await this.saveChatMessage(welcomeMessage);
  }

  async getChatSession(sessionId: string): Promise<ChatSession | undefined> {
    if (!db) return undefined;
    
    const result = await db.select().from(chatSessions)
      .where(eq(chatSessions.id, sessionId));
      
    return result.length > 0 ? result[0] : undefined;
  }

  async updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession> {
    if (!db) throw new Error('Database not available');
    
    // Luôn cập nhật lastActivity
    const updatedData = {
      ...updates,
      lastActivity: new Date()
    };
    
    const result = await db.update(chatSessions)
      .set(updatedData)
      .where(eq(chatSessions.id, sessionId))
      .returning();
      
    if (result.length === 0) {
      throw new Error('Chat session not found');
    }
    
    return result[0];
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    if (!db) return [];
    
    return await db.select().from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.timestamp);
  }

  async saveChatMessage(message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> {
    if (!db) throw new Error('Database not available');
    
    const result = await db.insert(chatMessages)
      .values(message)
      .returning();
      
    return result[0];
  }

  async updateChatMessage(id: number, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
    if (!db) return undefined;
    
    const result = await db.update(chatMessages)
      .set(updates)
      .where(eq(chatMessages.id, id))
      .returning();
      
    return result.length > 0 ? result[0] : undefined;
  }

  // Inquiry operations
  async getInquiry(id: number): Promise<Inquiry | undefined> {
    if (!db) return undefined;
    
    const result = await db.select().from(inquiries)
      .where(eq(inquiries.id, id));
      
    return result.length > 0 ? result[0] : undefined;
  }

  async getAllInquiries(): Promise<Inquiry[]> {
    if (!db) return [];
    
    return await db.select().from(inquiries)
      .orderBy(desc(inquiries.createdAt));
  }

  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    if (!db) throw new Error('Database not available');
    
    const result = await db.insert(inquiries)
      .values(inquiry)
      .returning();
      
    return result[0];
  }

  async updateInquiryStatus(id: number, status: string): Promise<Inquiry | undefined> {
    if (!db) return undefined;
    
    const result = await db.update(inquiries)
      .set({ status })
      .where(eq(inquiries.id, id))
      .returning();
      
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteInquiry(id: number): Promise<boolean> {
    if (!db) return false;
    
    const result = await db.delete(inquiries)
      .where(eq(inquiries.id, id))
      .returning();
      
    return result.length > 0;
  }

  // Endpoint operations
  async getEndpoint(id: number): Promise<Endpoint | undefined> {
    if (!db) return undefined;
    
    const result = await db.select().from(endpoints)
      .where(eq(endpoints.id, id));
      
    return result.length > 0 ? result[0] : undefined;
  }

  async getAllEndpoints(): Promise<Endpoint[]> {
    if (!db) return [];
    
    return await db.select().from(endpoints);
  }

  async createEndpoint(endpoint: InsertEndpoint): Promise<Endpoint> {
    if (!db) throw new Error('Database not available');
    
    const result = await db.insert(endpoints)
      .values(endpoint)
      .returning();
      
    return result[0];
  }

  async updateEndpoint(id: number, endpoint: Partial<Endpoint>): Promise<Endpoint | undefined> {
    if (!db) return undefined;
    
    const result = await db.update(endpoints)
      .set(endpoint)
      .where(eq(endpoints.id, id))
      .returning();
      
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteEndpoint(id: number): Promise<boolean> {
    if (!db) return false;
    
    const result = await db.delete(endpoints)
      .where(eq(endpoints.id, id))
      .returning();
      
    return result.length > 0;
  }

  // Các phương thức learning pattern không thực hiện vì cần thêm bảng mới
  async saveLearningPattern(pattern: string, response: string): Promise<void> {
    // TODO: Implement with PostgreSQL
    console.log('saveLearningPattern not implemented for PostgreSQL', pattern, response);
  }

  async findSimilarPattern(input: string): Promise<string | undefined> {
    // TODO: Implement with PostgreSQL
    console.log('findSimilarPattern not implemented for PostgreSQL', input);
    return undefined;
  }

  async updatePatternScore(pattern: string, score: number): Promise<void> {
    // TODO: Implement with PostgreSQL
    console.log('updatePatternScore not implemented for PostgreSQL', pattern, score);
  }

  async getAllPatterns(): Promise<Array<{ pattern: string; response: string; score: number }>> {
    // TODO: Implement with PostgreSQL
    return [];
  }

  async getPattern(pattern: string): Promise<{ response: string; score: number } | undefined> {
    // TODO: Implement with PostgreSQL
    return undefined;
  }

  async deletePattern(pattern: string): Promise<boolean> {
    // TODO: Implement with PostgreSQL
    return false;
  }

  // New method
  async getAllChatSessions(): Promise<ChatSession[]> {
    if (!db) return [];
    
    return await db.select().from(chatSessions)
      .orderBy(desc(chatSessions.lastActivity));
  }
} 