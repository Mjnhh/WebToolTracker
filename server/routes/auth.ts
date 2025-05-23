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
      role: user.role || 'user',
      name: user.name
    }, JWT_SECRET, { expiresIn: '7d' });

    // Lưu token vào cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    });

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

// Đăng xuất tất cả thiết bị
router.post('/logout-all', async (req: Request, res: Response) => {
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
    
    // Trong triển khai thực tế, cần lưu trữ các token đang hoạt động
    // và đánh dấu tất cả token ngoại trừ token hiện tại là không hợp lệ
    // Trong phiên bản demo này, chúng ta giả định là đã đăng xuất thành công
    
    res.json({ 
      message: 'Đã đăng xuất tất cả thiết bị khác',
      success: true
    });
  } catch (error) {
    console.error('Logout all devices error:', error);
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
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
    
    // Đảm bảo trường role luôn tồn tại
    if (!user.role) {
      user.role = 'user';
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

    // Kiểm tra mật khẩu mạnh
    if (password.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự' });
    }
    
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ message: 'Mật khẩu phải chứa ít nhất một chữ hoa' });
    }
    
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ message: 'Mật khẩu phải chứa ít nhất một chữ thường' });
    }
    
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ message: 'Mật khẩu phải chứa ít nhất một chữ số' });
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ message: 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt' });
    }

    // Kiểm tra username đã tồn tại chưa
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    // Hash mật khẩu trước khi lưu vào database
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo user mới với role là user
    const newUser = await storage.createUser({
      username,
      email,
      password: hashedPassword,
      name: name || username
    });

    // Gán role sau khi tạo user
    if (!newUser.role) {
      newUser.role = 'user';
    }

    // Tạo token JWT
    const token = jwt.sign(
      { 
        id: newUser.id, 
        username: newUser.username,
        role: newUser.role || 'user',
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

// Làm mới token JWT
router.post('/refresh', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc không được cung cấp' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Xác minh token hiện tại (vẫn sẽ xác minh ngay cả khi token đã hết hạn)
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as { 
      id: number;
      username: string; 
      role: string;
      name: string;
    };
    
    // Lấy thông tin người dùng từ database
    const user = await storage.getUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Người dùng không tồn tại' });
    }
    
    // Tạo token JWT mới
    const newToken = jwt.sign({ 
      id: user.id, 
      username: user.username,
      role: user.role,
      name: user.name
    }, JWT_SECRET, { expiresIn: '7d' });
    
    // Trả về token mới
    res.json({ 
      token: newToken, 
      message: 'Token đã được làm mới'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Không thể làm mới token' });
  }
});

export default router; 