import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-for-jwt-tokens";

// Middleware để xác thực người dùng thông qua JWT token
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('Auth header received:', authHeader ? 'exists' : 'missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Không có quyền truy cập - Thiếu token xác thực' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Không có quyền truy cập - Token không hợp lệ' });
    }
    
    // Xác thực token
    console.log('Trying to verify token...');
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log('Token verified:', decoded);
    
    // Lấy thông tin user từ database
    storage.getUser(decoded.id).then(user => {
      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại' });
      }
      
      console.log('User found:', user.username, 'role:', user.role);
      
      // Lưu thông tin user vào request
      (req as any).user = user;
      
      next();
    }).catch(error => {
      console.error('Authentication error:', error);
      return res.status(500).json({ message: 'Lỗi xác thực người dùng' });
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Middleware để kiểm tra quyền nhân viên
export function isStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('Staff auth header received:', authHeader ? 'exists' : 'missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Không có quyền truy cập - Thiếu token xác thực' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Không có quyền truy cập - Token không hợp lệ' });
    }
    
    // Xác thực token
    console.log('Trying to verify staff token...');
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log('Staff token verified:', decoded);
    
    // Lấy thông tin user từ database
    storage.getUser(decoded.id).then(user => {
      if (!user) {
        return res.status(401).json({ message: 'Người dùng không tồn tại' });
      }
      
      console.log('Staff check - User role:', user.role);
      
      // Kiểm tra quyền staff hoặc admin
      if (user.role !== 'staff' && user.role !== 'admin') {
        return res.status(403).json({ message: 'Quyền truy cập bị từ chối: Yêu cầu quyền nhân viên' });
      }
      
      // Lưu thông tin user vào request
      (req as any).user = user;
      
      next();
    }).catch(error => {
      console.error('Staff authentication error:', error);
      return res.status(500).json({ message: 'Lỗi xác thực người dùng' });
    });
  } catch (error) {
    console.error('Staff authentication error:', error);
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
} 