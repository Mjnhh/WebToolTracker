import { Pool } from 'pg';
import { 
  User, InsertUser, UpdateUser, 
  Inquiry, InsertInquiry, UpdateInquiry,
  Endpoint, InsertEndpoint, UpdateEndpoint,
  ChatSession, InsertChatSession, UpdateChatSession,
  Message, InsertMessage,
  Voucher, InsertVoucher,
  ChatbotPattern, InsertChatbotPattern
} from '@shared/schema';
import pool from './config/database';
import { Voucher as VoucherType } from './types/voucher';

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: UpdateUser): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  
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

  // Voucher operations
  createVoucher(voucher: InsertVoucher): Promise<VoucherType>;
  getVoucher(code: string): Promise<VoucherType | null>;
  getAllVouchers(): Promise<VoucherType[]>;
  useVoucher(code: string, userId: number): Promise<boolean>;

  // Chatbot pattern operations
  saveLearningPattern(pattern: string, response: string): Promise<void>;
  updatePatternScore(pattern: string, score: number): Promise<void>;
  getAllPatterns(): Promise<ChatbotPattern[]>;
  getPattern(pattern: string): Promise<ChatbotPattern | null>;
  deletePattern(pattern: string): Promise<boolean>;
  
  getVoucherByCode(code: string): Promise<VoucherType | null>;
  markVoucherAsUsed(code: string): Promise<VoucherType | null>;

  // Lưu đánh giá chat
  saveChatRating(sessionId: string, rating: number, feedback: string, metadata?: any): Promise<void>;

  // Lấy đánh giá của một phiên chat
  getChatRating(sessionId: string): Promise<any>;

  // Lấy tất cả đánh giá
  getAllChatRatings(): Promise<any[]>;
}

export class PostgresStorage implements IStorage {
  private _pool: Pool;

  constructor() {
    this._pool = pool;
  }

  // Getter cho pool
  get pool(): Pool {
    return this._pool;
  }

  // User operations
  async getUser(id: number): Promise<User | null> {
    return this.getUserById(id);
  }

  async getUserById(id: number): Promise<User | null> {
    const result = await this._pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this._pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this._pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await this._pool.query(
      'INSERT INTO users (username, email, password, name) VALUES ($1, $2, $3, $4) RETURNING *',
      [user.username, user.email, user.password, user.name]
    );
    return result.rows[0];
  }

  async updateUser(id: number, user: UpdateUser): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (user.username) {
      updates.push(`username = $${paramCount}`);
      values.push(user.username);
      paramCount++;
    }
    if (user.email) {
      updates.push(`email = $${paramCount}`);
      values.push(user.email);
      paramCount++;
    }
    if (user.password) {
      updates.push(`password = $${paramCount}`);
      values.push(user.password);
      paramCount++;
    }
    if (user.role) {
      updates.push(`role = $${paramCount}`);
      values.push(user.role);
      paramCount++;
    }

    if (updates.length === 0) return null;

    values.push(id);
    const result = await this._pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this._pool.query('SELECT * FROM users');
    return result.rows;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await this._pool.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Inquiry operations
  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const result = await this._pool.query(
      'INSERT INTO inquiries (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [inquiry.name, inquiry.email, inquiry.phone, inquiry.subject, inquiry.message]
    );
    return result.rows[0];
  }

  async getInquiry(id: number): Promise<Inquiry | null> {
    const result = await this.pool.query('SELECT * FROM inquiries WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getAllInquiries(): Promise<Inquiry[]> {
    const result = await this.pool.query('SELECT * FROM inquiries');
    return result.rows;
  }

  async updateInquiryStatus(id: number, status: string): Promise<Inquiry | null> {
    const result = await this.pool.query(
      'UPDATE inquiries SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] || null;
  }

  async deleteInquiry(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM inquiries WHERE id = $1', [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Endpoint operations
  async createEndpoint(endpoint: InsertEndpoint): Promise<Endpoint> {
    const result = await this.pool.query(
      'INSERT INTO endpoints (name, method, path, description, auth_required, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [endpoint.name, endpoint.method, endpoint.path, endpoint.description, endpoint.authRequired, endpoint.isActive]
    );
    return result.rows[0];
  }

  async getEndpoint(id: number): Promise<Endpoint | null> {
    const result = await this.pool.query('SELECT * FROM endpoints WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getAllEndpoints(): Promise<Endpoint[]> {
    const result = await this.pool.query('SELECT * FROM endpoints');
    return result.rows;
  }

  async updateEndpoint(id: number, endpoint: UpdateEndpoint): Promise<Endpoint | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (endpoint.method) {
      updates.push(`method = $${paramCount}`);
      values.push(endpoint.method);
      paramCount++;
    }
    if (endpoint.path) {
      updates.push(`path = $${paramCount}`);
      values.push(endpoint.path);
      paramCount++;
    }
    if (endpoint.description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(endpoint.description);
      paramCount++;
    }
    if (endpoint.authRequired !== undefined) {
      updates.push(`auth_required = $${paramCount}`);
      values.push(endpoint.authRequired);
      paramCount++;
    }
    if (endpoint.isActive !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(endpoint.isActive);
      paramCount++;
    }

    if (updates.length === 0) return null;

    values.push(id);
    const result = await this.pool.query(
      `UPDATE endpoints SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async deleteEndpoint(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM endpoints WHERE id = $1', [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Chat operations
  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const result = await this.pool.query(
      'INSERT INTO chat_sessions (id, user_id, metadata) VALUES ($1, $2, $3) RETURNING *',
      [session.id, session.userId, session.metadata]
    );
    return result.rows[0];
  }

  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    const result = await this.pool.query('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);
    return result.rows[0] || null;
  }

  async getAllChatSessions(): Promise<ChatSession[]> {
    const result = await this.pool.query('SELECT * FROM chat_sessions');
    return result.rows;
  }

  async updateChatSession(sessionId: string, session: UpdateChatSession): Promise<ChatSession | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (session.metadata) {
      updates.push(`metadata = $${paramCount}`);
      values.push(session.metadata);
      paramCount++;
    }
    
    if (session.userId) {
      updates.push(`user_id = $${paramCount}`);
      values.push(session.userId);
      paramCount++;
    }
    
    if (session.lastActivity) {
      updates.push(`last_activity = $${paramCount}`);
      values.push(session.lastActivity);
      paramCount++;
    }
    
    if (session.isHumanAssigned !== undefined) {
      updates.push(`is_human_assigned = $${paramCount}`);
      values.push(session.isHumanAssigned);
      paramCount++;
    }
    
    if (session.assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramCount}`);
      values.push(session.assignedTo);
      paramCount++;
    }

    if (updates.length === 0) return null;

    values.push(sessionId);
    const result = await this.pool.query(
      `UPDATE chat_sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async saveChatMessage(message: InsertMessage): Promise<Message> {
    const result = await this.pool.query(
      'INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3) RETURNING *',
      [message.sessionId, message.sender, message.content]
    );
    return result.rows[0];
  }

  async getChatMessages(sessionId: string): Promise<Message[]> {
    const result = await this.pool.query('SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY timestamp', [sessionId]);
    return result.rows;
  }

  // Thêm hàm để xóa phiên chat
  async deleteChatSession(sessionId: string): Promise<boolean> {
    try {
      // Sử dụng transaction để đảm bảo tính nhất quán dữ liệu
      await this.pool.query('BEGIN');
      
      // Xóa tất cả tin nhắn liên quan đến phiên chat
      await this.pool.query('DELETE FROM chat_messages WHERE session_id = $1', [sessionId]);
      
      // Xóa phiên chat
      const result = await this.pool.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
      
      // Commit transaction
      await this.pool.query('COMMIT');
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      // Rollback nếu có lỗi
      await this.pool.query('ROLLBACK');
      console.error('Error deleting chat session:', error);
      throw error;
    }
  }

  // Voucher operations
  async createVoucher(voucher: InsertVoucher): Promise<VoucherType> {
    // Kiểm tra xem có metadata không
    const query = voucher.metadata 
      ? 'INSERT INTO vouchers (code, discount_percent, expires_at, metadata) VALUES ($1, $2, $3, $4) RETURNING *'
      : 'INSERT INTO vouchers (code, discount_percent, expires_at) VALUES ($1, $2, $3) RETURNING *';
    
    const params = voucher.metadata 
      ? [voucher.code, voucher.discountPercent, voucher.expiresAt, voucher.metadata]
      : [voucher.code, voucher.discountPercent, voucher.expiresAt];
    
    const result = await this.pool.query(query, params);
    return result.rows[0];
  }

  async getVoucher(code: string): Promise<VoucherType | null> {
    const result = await this.pool.query('SELECT * FROM vouchers WHERE code = $1', [code]);
    return result.rows[0] || null;
  }

  async getAllVouchers(): Promise<VoucherType[]> {
    console.log('Fetching all vouchers from database...');
    try {
      const result = await this.pool.query('SELECT id, code, discount_percent, is_used, created_at, used_at, expires_at, metadata::text as metadata FROM vouchers ORDER BY created_at DESC');
      console.log(`Found ${result.rows.length} vouchers in database`);
      // Log một số mẫu voucher để debug
      if (result.rows.length > 0) {
        console.log('Sample voucher from database:', JSON.stringify(result.rows[0]));
      }
      return result.rows;
    } catch (error) {
      console.error('Error in getAllVouchers storage method:', error);
      return [];
    }
  }

  async useVoucher(code: string, userId: number): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE vouchers SET is_used = true, used_by = $1, used_at = NOW() WHERE code = $2 AND is_used = false AND expires_at > NOW()',
      [userId, code]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Chatbot pattern operations
  async saveLearningPattern(pattern: string, response: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO chatbot_patterns (pattern, response, score) VALUES ($1, $2, 1) ON CONFLICT (pattern) DO UPDATE SET response = $2, score = chatbot_patterns.score + 1',
      [pattern, response]
    );
  }

  async updatePatternScore(pattern: string, score: number): Promise<void> {
    await this.pool.query(
      'UPDATE chatbot_patterns SET score = $1 WHERE pattern = $2',
      [score, pattern]
    );
  }

  async getAllPatterns(): Promise<ChatbotPattern[]> {
    const result = await this.pool.query('SELECT * FROM chatbot_patterns');
    return result.rows;
  }

  async getPattern(pattern: string): Promise<ChatbotPattern | null> {
    const result = await this.pool.query('SELECT * FROM chatbot_patterns WHERE pattern = $1', [pattern]);
    return result.rows[0] || null;
  }

  async deletePattern(pattern: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM chatbot_patterns WHERE pattern = $1', [pattern]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getVoucherByCode(code: string): Promise<VoucherType | null> {
    console.log(`Fetching voucher with code: ${code}`);
    try {
      const result = await this.pool.query('SELECT id, code, discount_percent, is_used, created_at, used_at, expires_at, metadata::text as metadata FROM vouchers WHERE code = $1', [code]);
      if (result.rows.length > 0) {
        console.log('Found voucher:', JSON.stringify(result.rows[0]));
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error in getVoucherByCode storage method:', error);
      return null;
    }
  }

  async markVoucherAsUsed(code: string): Promise<VoucherType | null> {
    try {
      console.log(`Marking voucher as used: ${code}`);
      const result = await this.pool.query(
        'UPDATE vouchers SET is_used = true, used_at = NOW() WHERE code = $1 RETURNING id, code, discount_percent, is_used, created_at, used_at, expires_at, metadata::text as metadata',
        [code]
      );
      
      if (result.rows.length > 0) {
        console.log('Voucher marked as used:', JSON.stringify(result.rows[0]));
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error marking voucher as used:', error);
      return null;
    }
  }

  // Lưu đánh giá chat
  async saveChatRating(sessionId: string, rating: number, feedback: string, metadata?: any): Promise<void> {
    try {
      const metadataToSave = metadata || {};
      const staffName = metadataToSave.staffName || '';
      
      await this.pool.query(
        'INSERT INTO chat_ratings (session_id, rating, feedback, staff_name, metadata) VALUES ($1, $2, $3, $4, $5)',
        [sessionId, rating, feedback, staffName, JSON.stringify(metadataToSave)]
      );
    } catch (error) {
      console.error('Error saving chat rating:', error);
      throw error;
    }
  }

  // Lấy đánh giá của một phiên chat
  async getChatRating(sessionId: string): Promise<any> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM chat_ratings WHERE session_id = $1',
        [sessionId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting chat rating:', error);
      throw error;
    }
  }

  // Lấy tất cả đánh giá
  async getAllChatRatings(): Promise<any[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM chat_ratings ORDER BY created_at DESC'
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting all chat ratings:', error);
      throw error;
    }
  }
}

const storage = new PostgresStorage();
export { storage };

export const saveVoucher = async (voucher: InsertVoucher): Promise<VoucherType> => {
  try {
    const query = voucher.metadata 
      ? 'INSERT INTO vouchers (code, discount_percent, expires_at, metadata) VALUES ($1, $2, $3, $4) RETURNING id, code, discount_percent, is_used, created_at, used_at, expires_at, metadata::text as metadata'
      : 'INSERT INTO vouchers (code, discount_percent, expires_at) VALUES ($1, $2, $3) RETURNING id, code, discount_percent, is_used, created_at, used_at, expires_at';
    
    const params = voucher.metadata 
      ? [voucher.code, voucher.discountPercent, voucher.expiresAt, voucher.metadata]
      : [voucher.code, voucher.discountPercent, voucher.expiresAt];
    
    const result = await pool.query(query, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving voucher:', error);
    throw error;
  }
};

export const getVoucherByCode = async (code: string): Promise<VoucherType | null> => {
  try {
    const result = await pool.query('SELECT id, code, discount_percent, is_used, created_at, used_at, expires_at, metadata::text as metadata FROM vouchers WHERE code = $1', [code]);
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('Error in getVoucherByCode module function:', error);
    return null;
  }
};

export const markVoucherAsUsed = async (code: string): Promise<VoucherType | null> => {
  try {
    console.log(`Marking voucher as used: ${code}`);
    const result = await pool.query(
      'UPDATE vouchers SET is_used = true, used_at = NOW() WHERE code = $1 RETURNING id, code, discount_percent, is_used, created_at, used_at, expires_at, metadata::text as metadata',
      [code]
    );
    if (result.rows.length > 0) {
      console.log('Voucher marked as used:', JSON.stringify(result.rows[0]));
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('Error marking voucher as used:', error);
    return null;
  }
};

export const getAllVouchers = async (): Promise<VoucherType[]> => {
  try {
    const result = await pool.query('SELECT id, code, discount_percent, is_used, created_at, used_at, expires_at, metadata::text as metadata FROM vouchers ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error in getAllVouchers module function:', error);
    return [];
  }
};