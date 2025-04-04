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
