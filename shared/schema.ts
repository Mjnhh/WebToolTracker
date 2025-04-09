import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("user"),
  name: text("name").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Contact form inquiries schema
export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("unread"),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertInquirySchema = createInsertSchema(inquiries).pick({
  name: true,
  email: true,
  phone: true,
  subject: true,
  message: true,
});

export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiries.$inferSelect;

// Service endpoints schema
export const endpoints = pgTable("endpoints", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  description: text("description"),
  authRequired: boolean("auth_required").default(false),
  isActive: boolean("is_active").default(true),
});

export const insertEndpointSchema = createInsertSchema(endpoints).pick({
  name: true,
  method: true,
  path: true,
  description: true,
  authRequired: true,
  isActive: true,
});

export type InsertEndpoint = z.infer<typeof insertEndpointSchema>;
export type Endpoint = typeof endpoints.$inferSelect;

// Chat message schema
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  sender: text("sender").notNull(), // "user" hoặc "bot"
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: text("metadata"), // Lưu thông tin bổ sung như intent, confidence score, etc.
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  content: true,
  sender: true,
  sessionId: true,
  metadata: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Chat session schema
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: integer("user_id"), // Nullable for anonymous users
  startedAt: timestamp("started_at").defaultNow(),
  lastActivity: timestamp("last_activity").defaultNow(),
  metadata: text("metadata"), // Lưu thông tin về user agent, location, etc.
  isHumanAssigned: boolean("is_human_assigned").default(false), // Đánh dấu đã được gán cho nhân viên chưa
  assignedTo: integer("assigned_to"), // ID của nhân viên hỗ trợ
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  id: true,
  userId: true,
  metadata: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

export interface Message {
  id: number;
  sessionId: string;
  sender: string;
  content: string;
  timestamp: Date;
  createdAt: Date;
}

export interface InsertMessage {
  sessionId: string;
  sender: string;
  content: string;
  timestamp?: Date;
  metadata?: string;
}

export interface Voucher {
  id: number;
  code: string;
  discountPercent: number;
  expiresAt: Date;
  isUsed: boolean;
  usedAt?: Date;
  createdAt: Date;
  metadata?: string;
}

export interface InsertVoucher {
  code: string;
  discountPercent: number;
  expiresAt: Date;
  metadata?: string;
}

export interface ChatbotPattern {
  id: number;
  pattern: string;
  response: string;
  score: number;
}

export interface InsertChatbotPattern {
  pattern: string;
  response: string;
  score?: number;
}

export interface UpdateUser {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  name?: string;
}

export interface UpdateInquiry {
  status?: string;
}

export interface UpdateEndpoint {
  method?: string;
  path?: string;
  description?: string;
  authRequired?: boolean;
  isActive?: boolean;
}

export interface UpdateChatSession {
  userId?: number;
  metadata?: string;
  lastActivity?: Date;
  isHumanAssigned?: boolean;
  assignedTo?: number;
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: UpdateUser): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
  
  // Inquiry operations
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;
  getInquiry(id: number): Promise<Inquiry | null>;
  getAllInquiries(): Promise<Inquiry[]>;
  updateInquiryStatus(id: number, status: string): Promise<Inquiry | null>;
  deleteInquiry(id: number): Promise<boolean>;
  
  // Endpoint operations
  createEndpoint(endpoint: InsertEndpoint): Promise<Endpoint>;
  getEndpoint(id: number): Promise<Endpoint | null>;
  getAllEndpoints(): Promise<Endpoint[]>;
  updateEndpoint(id: number, endpoint: UpdateEndpoint): Promise<Endpoint | null>;
  deleteEndpoint(id: number): Promise<boolean>;
  
  // Chat operations
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(sessionId: string): Promise<ChatSession | null>;
  getAllChatSessions(): Promise<ChatSession[]>;
  updateChatSession(sessionId: string, session: UpdateChatSession): Promise<ChatSession | null>;
  saveChatMessage(message: InsertMessage): Promise<Message>;
  getChatMessages(sessionId: string): Promise<Message[]>;
  deleteChatSession(sessionId: string): Promise<boolean>;

  // Voucher operations
  createVoucher(voucher: InsertVoucher): Promise<Voucher>;
  getVoucher(code: string): Promise<Voucher | null>;
  getAllVouchers(): Promise<Voucher[]>;
  useVoucher(code: string, userId: number): Promise<boolean>;

  // Chatbot pattern operations
  saveLearningPattern(pattern: string, response: string): Promise<void>;
  updatePatternScore(pattern: string, score: number): Promise<void>;
  getAllPatterns(): Promise<ChatbotPattern[]>;
  getPattern(pattern: string): Promise<ChatbotPattern | null>;
  deletePattern(pattern: string): Promise<boolean>;
  
  getVoucherByCode(code: string): Promise<Voucher | null>;
  markVoucherAsUsed(code: string): Promise<Voucher | null>;
}
