import express from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { insertEndpointSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-for-jwt-tokens";

// Middleware to check if user is an admin
function isAdmin(req: Request, res: Response, next: any) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Admin API access denied: No authorization header or not Bearer token');
      return res.status(401).json({ message: 'Không có quyền truy cập - Thiếu token xác thực' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.error('Admin API access denied: Empty token');
      return res.status(401).json({ message: 'Không có quyền truy cập - Token không hợp lệ' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Kiểm tra quyền admin theo nhiều cách
    const isAdminUser = 
      (decoded.role === 'admin') || 
      (decoded.username === 'admin') || 
      (decoded.email && decoded.email.includes('admin'));
    
    if (!isAdminUser) {
      console.error('Admin API access denied: User does not have admin privileges');
      return res.status(403).json({ message: 'Cần quyền quản trị viên' });
    }
    
    // Lưu thông tin user vào request
    (req as any).user = decoded;
    
    return next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// API Admin - Lấy danh sách người dùng
router.get("/users", isAdmin, async (req, res, next) => {
  try {
    const users = await storage.getAllUsers();
    // Loại bỏ trường password trước khi gửi về client
    const usersWithoutPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    res.json(usersWithoutPassword);
  } catch (error) {
    next(error);
  }
});

// API Admin - Lấy danh sách inquiries
router.get("/inquiries", isAdmin, async (req, res, next) => {
  try {
    const inquiries = await storage.getAllInquiries();
    res.json(inquiries);
  } catch (error) {
    next(error);
  }
});

// API Admin - Lấy chi tiết một inquiry
router.get("/inquiries/:id", isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const inquiry = await storage.getInquiry(id);
    
    if (!inquiry) {
      return res.status(404).json({ message: "Inquiry not found" });
    }
    
    res.json(inquiry);
  } catch (error) {
    next(error);
  }
});

// API Admin - Cập nhật trạng thái inquiry
router.patch("/inquiries/:id/status", isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    const updatedInquiry = await storage.updateInquiryStatus(id, status);
    
    if (!updatedInquiry) {
      return res.status(404).json({ message: "Inquiry not found" });
    }
    
    res.json(updatedInquiry);
  } catch (error) {
    next(error);
  }
});

// API Admin - Xóa inquiry
router.delete("/inquiries/:id", isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteInquiry(id);
    
    if (!deleted) {
      return res.status(404).json({ message: "Inquiry not found" });
    }
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// API Admin - Liệt kê endpoints
router.get("/endpoints", isAdmin, async (req, res, next) => {
  try {
    const endpoints = await storage.getAllEndpoints();
    res.json(endpoints);
  } catch (error) {
    next(error);
  }
});

// API Admin - Tạo endpoint mới
router.post("/endpoints", isAdmin, async (req, res, next) => {
  try {
    const parsedEndpoint = insertEndpointSchema.safeParse(req.body);
    
    if (!parsedEndpoint.success) {
      const error = fromZodError(parsedEndpoint.error);
      return res.status(400).json({ message: error.message });
    }
    
    const endpoint = await storage.createEndpoint(parsedEndpoint.data);
    res.status(201).json(endpoint);
  } catch (error) {
    next(error);
  }
});

// API Admin - Cập nhật endpoint
router.patch("/endpoints/:id", isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    const updatedEndpoint = await storage.updateEndpoint(id, req.body);
    
    if (!updatedEndpoint) {
      return res.status(404).json({ message: "Endpoint not found" });
    }
    
    res.json(updatedEndpoint);
  } catch (error) {
    next(error);
  }
});

// API Admin - Xóa endpoint
router.delete("/endpoints/:id", isAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteEndpoint(id);
    
    if (!deleted) {
      return res.status(404).json({ message: "Endpoint not found" });
    }
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// API Admin - Thêm mẫu câu mới cho chatbot
router.post("/chatbot/patterns", isAdmin, async (req, res, next) => {
  try {
    const { pattern, response } = req.body;
    
    if (!pattern || !response) {
      return res.status(400).json({ message: "Pattern and response are required" });
    }
    
    await storage.saveLearningPattern(pattern, response);
    res.status(201).json({ message: "Pattern added successfully" });
  } catch (error) {
    next(error);
  }
});

// API Admin - Cập nhật điểm số cho mẫu câu
router.patch("/chatbot/patterns/:pattern/score", isAdmin, async (req, res, next) => {
  try {
    const { pattern } = req.params;
    const { score } = req.body;
    
    if (typeof score !== 'number') {
      return res.status(400).json({ message: "Score must be a number" });
    }
    
    await storage.updatePatternScore(pattern, score);
    res.json({ message: "Pattern score updated successfully" });
  } catch (error) {
    next(error);
  }
});

// API Admin - Lấy tất cả mẫu câu chatbot
router.get("/chatbot/patterns", isAdmin, async (req, res, next) => {
  try {
    const patterns = await storage.getAllPatterns();
    res.json(patterns);
  } catch (error) {
    next(error);
  }
});

// API Admin - Lấy chi tiết một mẫu câu
router.get("/chatbot/patterns/:pattern", isAdmin, async (req, res, next) => {
  try {
    const pattern = decodeURIComponent(req.params.pattern);
    const data = await storage.getPattern(pattern);
    
    if (!data) {
      return res.status(404).json({ message: "Pattern not found" });
    }
    
    res.json({
      pattern: pattern,
      response: data.response,
      score: data.score
    });
  } catch (error) {
    next(error);
  }
});

// API Admin - Xóa mẫu câu
router.delete("/chatbot/patterns/:pattern", isAdmin, async (req, res, next) => {
  try {
    const pattern = decodeURIComponent(req.params.pattern);
    const deleted = await storage.deletePattern(pattern);
    
    if (!deleted) {
      return res.status(404).json({ message: "Pattern not found" });
    }
    
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router; 