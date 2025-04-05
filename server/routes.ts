import express from "express";
import type { Express } from "express";
import { createServer } from "http";
import chatRouter from "./routes/chat";
import supportRouter from "./routes/support";
import authRouter from "./routes/auth";
import contactRouter from "./routes/contact";
import adminRouter from "./routes/admin";
import spotifyRouter from "./routes/spotify";
import { initializeSocket } from "./socket";
import { initializeSocketServer } from "./io";
import { storage } from "./storage";
import path from "path";
import { fileURLToPath } from "url";
import { createUserRouter } from "./routes/users";

// Lấy __dirname trong ES modules (vì __dirname không tồn tại trong ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  
  app.use("/api/spotify", spotifyRouter);
  console.log("Registered spotify API routes at /api/spotify");
  
  // API cho người dùng
  app.use("/api/users", createUserRouter());
  console.log("Registered user API routes at /api/users");
  
  // Route cho trang admin đặt trước static middleware
  app.get('/admin', (req, res) => {
    console.log("Serving admin page...");
    // Đơn giản hóa bằng cách sử dụng đường dẫn tuyệt đối
    res.sendFile(path.join(process.cwd(), 'public/admin-control-panel.html'));
  });
  console.log("Registered admin page route at /admin");
  
  // Route cho trang hồ sơ cá nhân
  app.get('/profile', (req, res) => {
    console.log("Serving profile page...");
    res.sendFile(path.join(process.cwd(), 'public/profile.html'));
  });
  console.log("Registered profile page route at /profile");
  
  // Phục vụ các trang tĩnh từ thư mục public
  app.use(express.static("public"));
  console.log("Serving static files from 'public' directory");
  
  // Basic health check route
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  console.log("Registered health check route at /health");
  
  // Đơn giản hóa route fallback
  app.get('*', (req, res) => {
    console.log(`Fallback route for: ${req.originalUrl}`);
    res.sendFile(path.join(process.cwd(), 'public/coding-team-website.html'));
  });
  console.log("Registered fallback route");

  return server;
}