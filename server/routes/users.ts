import express from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-for-jwt-tokens";

// Middleware xác thực người dùng
function authMiddleware(req: Request, res: Response, next: any) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Không có quyền truy cập - Thiếu token xác thực' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Không có quyền truy cập - Token không hợp lệ' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Lưu thông tin user vào request
    (req as any).user = decoded;
    
    return next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

export function createUserRouter() {
  const router = express.Router();

  // Get user profile (current user)
  router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại' });
      }
      
      // Loại bỏ mật khẩu trước khi trả về
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error getting user profile:', error);
      res.status(500).json({ message: 'Lỗi server khi lấy thông tin người dùng' });
    }
  });

  // Update user profile
  router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      const loggedInUserId = (req as any).user.id;
      
      // Chỉ cho phép cập nhật thông tin của chính mình hoặc là admin
      if (userId !== loggedInUserId && (req as any).user.role !== 'admin') {
        return res.status(403).json({ message: 'Không có quyền cập nhật thông tin người dùng khác' });
      }
      
      const { name, email } = req.body;
      
      // Kiểm tra nếu email đã tồn tại
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: 'Email đã được sử dụng' });
        }
      }
      
      // Cập nhật thông tin người dùng
      const updatedUser = await storage.updateUser(userId, { name, email });
      
      // Loại bỏ mật khẩu trước khi trả về
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Lỗi server khi cập nhật thông tin người dùng' });
    }
  });

  // Change password
  router.post('/:id/change-password', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      const loggedInUserId = (req as any).user.id;
      
      // Chỉ cho phép đổi mật khẩu của chính mình hoặc là admin
      if (userId !== loggedInUserId && (req as any).user.role !== 'admin') {
        return res.status(403).json({ message: 'Không có quyền đổi mật khẩu người dùng khác' });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }
      
      // Lấy thông tin người dùng
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại' });
      }
      
      // Kiểm tra mật khẩu hiện tại nếu không phải admin
      if ((req as any).user.role !== 'admin') {
        let passwordMatch = false;
        
        if (user.password.startsWith('$2')) {
          // Mật khẩu đã được hash với bcrypt
          passwordMatch = await bcrypt.compare(currentPassword, user.password);
        } else {
          // Mật khẩu plaintext
          passwordMatch = (user.password === currentPassword);
        }
        
        if (!passwordMatch) {
          return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
        }
      }
      
      // Hash mật khẩu mới
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Cập nhật mật khẩu
      await storage.updateUser(userId, { password: hashedPassword });
      
      res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Lỗi server khi đổi mật khẩu' });
    }
  });

  return router;
} 