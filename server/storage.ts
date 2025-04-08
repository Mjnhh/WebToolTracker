import { InsertUser, User, Inquiry, InsertInquiry, Endpoint, InsertEndpoint, ChatMessage, InsertChatMessage, ChatSession, InsertChatSession } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
const MemoryStore = createMemoryStore(session);
import bcrypt from "bcryptjs";
import crypto from 'crypto';
import { db } from './db';
import { PostgresStorage } from './pg-storage';

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Inquiry operations
  getInquiry(id: number): Promise<Inquiry | undefined>;
  getAllInquiries(): Promise<Inquiry[]>;
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;
  updateInquiryStatus(id: number, status: string): Promise<Inquiry | undefined>;
  deleteInquiry(id: number): Promise<boolean>;
  
  // Service endpoints operations
  getEndpoint(id: number): Promise<Endpoint | undefined>;
  getAllEndpoints(): Promise<Endpoint[]>;
  createEndpoint(endpoint: InsertEndpoint): Promise<Endpoint>;
  updateEndpoint(id: number, endpoint: Partial<Endpoint>): Promise<Endpoint | undefined>;
  deleteEndpoint(id: number): Promise<boolean>;
  
  // Chat operations
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(sessionId: string): Promise<ChatSession | undefined>;
  updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  saveChatMessage(message: Omit<ChatMessage, 'id'>): Promise<ChatMessage>;
  updateChatMessage(id: number, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined>;
  
  // Learning operations
  saveLearningPattern(pattern: string, response: string): Promise<void>;
  findSimilarPattern(input: string): Promise<string | undefined>;
  updatePatternScore(pattern: string, score: number): Promise<void>;
  getAllPatterns(): Promise<Array<{ pattern: string; response: string; score: number }>>;
  getPattern(pattern: string): Promise<{ response: string; score: number } | undefined>;
  deletePattern(pattern: string): Promise<boolean>;
  
  // Session store
  sessionStore: session.Store;

  // New method
  getAllChatSessions(): Promise<ChatSession[]>;
}

export interface Voucher {
  id: string;
  code: string;
  discount: number;
  isUsed: boolean;
  createdAt: Date;
  usedAt?: Date;
  userId?: string;
  userEmail?: string;
  quizScore?: number;
}

const storage = new PostgresStorage();
export { storage };

export async function saveVoucher(voucherData: Omit<Voucher, 'id' | 'createdAt'>): Promise<Voucher> {
  const id = crypto.randomUUID();
  const createdAt = new Date();
  
  const voucher: Voucher = {
    id,
    createdAt,
    ...voucherData
  };
  
  // Lưu voucher vào cơ sở dữ liệu
  await db.write(async (data: any) => {
    if (!data.vouchers) {
      data.vouchers = [];
    }
    data.vouchers.push(voucher);
  });
  
  return voucher;
}

export async function getVoucherByCode(code: string): Promise<Voucher | null> {
  const data = await db.read();
  if (!data.vouchers) return null;
  
  const voucher = data.vouchers.find((v: any) => v.code === code);
  return voucher || null;
}

export async function markVoucherAsUsed(code: string): Promise<Voucher | null> {
  let updatedVoucher: Voucher | null = null;
  
  await db.write(async (data: any) => {
    if (!data.vouchers) return;
    
    const voucherIndex = data.vouchers.findIndex((v: any) => v.code === code);
    if (voucherIndex === -1) return;
    
    data.vouchers[voucherIndex].isUsed = true;
    data.vouchers[voucherIndex].usedAt = new Date();
    
    updatedVoucher = data.vouchers[voucherIndex];
  });
  
  return updatedVoucher;
}

export async function getAllVouchers(): Promise<Voucher[]> {
  const data = await db.read();
  return data.vouchers || [];
}