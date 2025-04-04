import express from "express";
import type { Express } from "express";
import { createServer } from "http";
import chatRouter from "./routes/chat";
import supportRouter from "./routes/support";
import authRouter from "./routes/auth";
import contactRouter from "./routes/contact";
import adminRouter from "./routes/admin";
import { initializeSocket } from "./socket";
import { initializeSocketServer } from "./io";
import { storage } from "./storage";

export async function registerRoutes(app: Express) {
  const server = createServer(app);
  
  // Khởi tạo Socket.IO cho cả client và admin
  const io = initializeSocketServer(server, storage);
  const clientIo = initializeSocket(io);
  
  console.log("Starting API route registration...");
  
  // Đăng ký API routes
  app.use("/api/chat", chatRouter);
  console.log("Registered chat API routes at /api/chat");
  
  app.use("/api/support", supportRouter);
  console.log("Registered support API routes at /api/support");
  
  app.use("/api/auth", authRouter);
  console.log("Registered auth API routes at /api/auth");
  
  app.use("/api/contact", contactRouter);
  console.log("Registered contact API routes at /api/contact");
  
  app.use("/api/admin", adminRouter);
  console.log("Registered admin API routes at /api/admin");
  
  // Phục vụ các trang tĩnh từ thư mục public
  app.use(express.static("public"));
  console.log("Serving static files from 'public' directory");
  
  // Route cho trang admin
  app.get('/admin', (req, res) => {
    res.sendFile('admin-control-panel.html', { root: 'public' });
  });
  console.log("Registered admin page route at /admin");
  
  // Basic health check route
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  console.log("Registered health check route at /health");
  
  // Fallback route - redirect về trang chính
  app.get('*', (req, res) => {
    res.sendFile('coding-team-website.html', { root: 'public' });
  });
  console.log("Registered fallback route to coding-team-website.html");
  
  return server;
}