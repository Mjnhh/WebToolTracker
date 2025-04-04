import express from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import bcrypt from "bcryptjs";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-for-jwt-tokens";

// Kiểm tra xem người dùng đã đăng nhập chưa
router.get("/session", (req: Request & { isAuthenticated?: () => boolean, user?: any }, res: Response) => {
  if (req.isAuthenticated?.()) {
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  } else {
    res.status(401).json({ message: "Không có phiên đăng nhập" });
  }
});

// Đăng nhập
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin đăng nhập" });
    }

    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    // Kiểm tra mật khẩu - hỗ trợ cả bcrypt và plaintext
    let passwordMatch = false;
    
    if (user.password.startsWith('$2')) {
      // Mật khẩu đã được hash với bcrypt
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      // Mật khẩu plaintext
      passwordMatch = (user.password === password);
    }

    if (!passwordMatch) {
      return res.status(401).json({ message: "Tên đăng nhập hoặc mật khẩu không đúng" });
    }

    // Không còn kiểm tra role để mọi người đều có thể đăng nhập
    // Tạo JWT token
    const { password: _, ...userWithoutPassword } = user;
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username,
      role: user.role,
      name: user.name
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      token, 
      user: userWithoutPassword
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Lỗi máy chủ, vui lòng thử lại sau" });
  }
});

// Đăng xuất
router.post('/logout', (req: Request & { logout?: (callback: (err: any) => void) => void }, res: Response) => {
  if (req.logout) {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Lỗi khi đăng xuất" });
      }
      res.json({ message: "Đăng xuất thành công" });
    });
  } else {
    res.json({ message: "Đăng xuất thành công" });
  }
});

// Xác thực token JWT
router.get('/verify', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await storage.getUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Người dùng không tồn tại' });
    }
    
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
});

// Đăng ký tài khoản mới
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    // Kiểm tra username đã tồn tại chưa
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
    }

    // Tạo user mới
    const newUser = await storage.createUser({
      username,
      email,
      password, // Trong thực tế nên hash password
      name: name || username,
      role: 'user' // Mặc định là user thường
    });

    // Tạo token JWT
    const token = jwt.sign(
      { 
        id: newUser.id, 
        username: newUser.username,
        role: newUser.role,
        name: newUser.name
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // Trả về token và thông tin user
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ 
      token, 
      user: userWithoutPassword,
      message: 'Đăng ký thành công'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Lỗi server khi đăng ký' });
  }
});

export default router; 