import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
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
import voucherRouter from './routes/vouchers';
import jwt from "jsonwebtoken";

// Lấy __dirname trong ES modules (vì __dirname không tồn tại trong ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware kiểm tra quyền admin
function checkAdminAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.error('Admin page access attempt: No token found');
      return res.status(404).sendFile(path.join(process.cwd(), 'public/404.html'));
    }
    
    const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-for-jwt-tokens";
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'admin') {
      console.error('Admin page access attempt by non-admin user:', {
        userId: decoded.id,
        username: decoded.username,
        role: decoded.role
      });
      return res.status(404).sendFile(path.join(process.cwd(), 'public/404.html'));
    }
    
    next();
  } catch (error) {
    console.error('Admin page access error:', error);
    return res.status(404).sendFile(path.join(process.cwd(), 'public/404.html'));
  }
}

// Middleware kiểm tra quyền staff hoặc admin
function checkStaffAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.error('Staff page access attempt: No token found');
      return res.status(404).sendFile(path.join(process.cwd(), 'public/404.html'));
    }
    
    const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-for-jwt-tokens";
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'admin' && decoded.role !== 'staff') {
      console.error('Staff page access attempt by unauthorized user:', {
        userId: decoded.id,
        username: decoded.username,
        role: decoded.role
      });
      return res.status(404).sendFile(path.join(process.cwd(), 'public/404.html'));
    }
    
    next();
  } catch (error) {
    console.error('Staff page access error:', error);
    return res.status(404).sendFile(path.join(process.cwd(), 'public/404.html'));
  }
}

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
  
  app.use("/api/vouchers", voucherRouter);
  console.log("Registered voucher API routes at /api/vouchers");
  
  // Route cho trang admin đặt trước static middleware
  app.get('/admin', checkAdminAccess, (req, res) => {
    console.log("Serving admin page...");
    // Đơn giản hóa bằng cách sử dụng đường dẫn tuyệt đối
    res.sendFile(path.join(process.cwd(), 'public/admin-control-panel.html'));
  });
  console.log("Registered admin page route at /admin");
  
  // Route cho trang staff (hỗ trợ khách hàng)
  app.get('/staff', checkStaffAccess, (req, res) => {
    console.log("Serving staff page...");
    res.sendFile(path.join(process.cwd(), 'public/staff/index.html'));
  });
  console.log("Registered staff page route at /staff");
  
  // Bảo vệ tất cả các file trong thư mục staff
  app.use('/staff', checkStaffAccess, express.static(path.join(process.cwd(), 'public/staff')));
  console.log("Registered protected staff files routes");
  
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