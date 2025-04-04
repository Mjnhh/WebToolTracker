import express from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { io } from "../io";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-for-jwt-tokens";

// Middleware to check if user is a staff member or admin
function isStaff(req: Request, res: Response, next: any) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Không có quyền truy cập - Thiếu token xác thực' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Không có quyền truy cập - Token không hợp lệ' });
    }
    
    // Xác thực token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Lấy thông tin user từ database
    storage.getUserById(decoded.id).then(user => {
      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại' });
      }
      
      // Kiểm tra quyền staff hoặc admin
      if (user.role !== 'staff' && user.role !== 'admin') {
        return res.status(403).json({ message: 'Staff privileges required' });
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

// API để nhân viên tiếp nhận hỗ trợ
router.post("/assign", isStaff, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { sessionId } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      return res.status(401).json({ message: "Staff ID not found" });
    }

    // Kiểm tra xem session đã được assign chưa
    const session = await storage.getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Parse metadata
    let sessionData = {} as { assignedTo?: string | null };
    try {
      sessionData = session.metadata ? JSON.parse(session.metadata) : {} as { assignedTo?: string | null };
    } catch (e) {
      console.error('Error parsing session metadata:', e);
    }

    if (sessionData.assignedTo && sessionData.assignedTo !== staffId) {
      return res.status(400).json({ 
        message: "Session đã được assign cho nhân viên khác" 
      });
    }

    // In log để debug
    console.log(`Assigning session ${sessionId} to staff ${staffId}. Current metadata:`, sessionData);

    // Cập nhật session với nhân viên phụ trách
    const updatedMetadata = {
      ...sessionData,
      assignedTo: staffId,
      isHumanAssigned: true,
      lastReadByStaff: Date.now()
    };
    
    console.log(`Updated metadata for session ${sessionId}:`, updatedMetadata);
    
    await storage.updateChatSession(sessionId, {
      metadata: JSON.stringify(updatedMetadata)
    });

    // Thông báo cho client
    io.to(sessionId).emit('support-staff-joined', {
      staffId,
      staffName: req.user?.name || 'Nhân viên hỗ trợ'
    });

    res.json({ message: "Assigned successfully" });
  } catch (error) {
    console.error("Error assigning support staff:", error);
    res.status(500).json({ message: "Failed to assign support staff" });
  }
});

// API để gửi tin nhắn từ nhân viên
router.post("/message", isStaff, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { sessionId, content } = req.body;
    const staffId = req.user?.id;
    
    if (!sessionId || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    if (!staffId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Kiểm tra session và quyền gửi tin nhắn
    const session = await storage.getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Kiểm tra xem tin nhắn tương tự đã tồn tại gần đây không
    const recentMessages = await storage.getChatMessages(sessionId);
    
    // Chỉ kiểm tra 10 tin nhắn gần nhất
    const lastMessages = recentMessages.slice(-10);
    const duplicateMessage = lastMessages.find(m => 
      m.content === content && 
      m.sender === 'staff' && 
      new Date().getTime() - (m.timestamp ? new Date(String(m.timestamp)).getTime() : 0) < 5000 // 5 giây
    );
    
    if (duplicateMessage) {
      console.log(`Phát hiện tin nhắn trùng lặp, trả về tin nhắn đã tồn tại: ${duplicateMessage.id}`);
      return res.status(200).json(duplicateMessage);
    }
    
    // Bỏ qua kiểm tra assignedTo để cho phép bất kỳ nhân viên nào cũng có thể trả lời
    
    // Lưu tin nhắn vào cơ sở dữ liệu
    const message = await storage.saveChatMessage({
      sessionId,
      content,
      sender: 'staff',
      timestamp: new Date(),
      metadata: JSON.stringify({ staffId })
    });
    
    // Gửi tin nhắn qua socket.io
    if (io) {
      io.to(sessionId).emit('new-message', message);
    }
    
    res.json(message);
  } catch (error) {
    console.error('Error sending support message:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// API để kết thúc phiên hỗ trợ
router.post("/end", isStaff, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { sessionId } = req.body;
    const staffId = req.user?.id;

    if (!staffId) {
      return res.status(401).json({ message: "Staff ID not found" });
    }

    // Kiểm tra quyền kết thúc
    const session = await storage.getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const sessionData = JSON.parse(session.metadata || "{}");
    if (sessionData.assignedTo !== staffId) {
      return res.status(403).json({ 
        message: "Không có quyền kết thúc session này" 
      });
    }

    // Cập nhật session
    await storage.updateChatSession(sessionId, {
      metadata: JSON.stringify({
        ...sessionData,
        isHumanAssigned: false,
        assignedTo: null
      })
    });

    // Thông báo cho client
    io.to(sessionId).emit('support-ended', {
      staffId,
      timestamp: new Date()
    });

    // Gửi tin nhắn kết thúc
    await storage.saveChatMessage({
      sessionId,
      content: "Phiên hỗ trợ đã kết thúc. Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.",
      sender: 'bot',
      timestamp: new Date(),
      metadata: null
    });

    res.json({ message: "Support session ended successfully" });
  } catch (error) {
    console.error("Error ending support session:", error);
    res.status(500).json({ message: "Failed to end support session" });
  }
});

// API để lấy danh sách phiên chat cần hỗ trợ
router.get("/sessions", isStaff, async (req: Request & { user?: any }, res: Response) => {
  try {
    const staffId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!staffId) {
      return res.status(401).json({ message: "Staff ID not found" });
    }

    // Lấy tất cả các phiên chat
    const allSessions = await storage.getAllChatSessions();
    console.log(`Found ${allSessions.length} total chat sessions`);
    
    // Lọc những phiên cần hỗ trợ hoặc đã được assign cho nhân viên này
    const filteredSessions = allSessions.map(session => {
      // Parse metadata
      let metadata: Record<string, any> = {};
      let needsHumanSupport = false;
      let isHumanAssigned = false;
      let assignedTo = null;
      let lastMessage = '';
      
      try {
        if (session.metadata) {
          metadata = JSON.parse(session.metadata);
          needsHumanSupport = metadata.needsHumanSupport || false;
          isHumanAssigned = metadata.isHumanAssigned || false;
          assignedTo = metadata.assignedTo || null;
          lastMessage = metadata.lastMessage || '';
        }
      } catch (e) {
        console.error("Error parsing session metadata for session", session.id, e);
      }
      
      // Thêm thông tin vào session
      return {
        ...session,
        metadata,
        needsHumanSupport,
        isHumanAssigned,
        assignedTo,
        lastMessage
      };
    }).filter(session => {
      // Admin có thể xem tất cả các phiên cần hỗ trợ, kể cả đã được gán cho nhân viên khác
      if (isAdmin) {
        const result = session.needsHumanSupport;
        return result;
      }
      
      // Staff chỉ xem những phiên cần hỗ trợ chưa được assign hoặc đã được assign cho mình
      return (
        (session.needsHumanSupport && !session.assignedTo) || 
        (session.isHumanAssigned && session.assignedTo === staffId)
      );
    });
    
    console.log(`Filtered to ${filteredSessions.length} sessions needing support`);
    
    // Thêm số tin nhắn chưa đọc cho mỗi phiên chat
    const sessionsWithUnreadCount = await Promise.all(
      filteredSessions.map(async (session) => {
        // Lấy danh sách tin nhắn
        const messages = await storage.getChatMessages(session.id);
        
        // Đếm số tin nhắn chưa đọc (từ user và sau thời điểm nhân viên tham gia)
        let unreadCount = 0;
        
        // Lấy thời điểm gần nhất nhân viên đọc tin nhắn từ metadata
        const lastReadTimestamp = session.metadata.lastReadByStaff ? Number(session.metadata.lastReadByStaff) : 0;
        
        for (const message of messages) {
          if (
            message.sender === 'user' && 
            message.timestamp && 
            new Date(typeof message.timestamp === 'string' ? message.timestamp : new Date()).getTime() > lastReadTimestamp
          ) {
            unreadCount++;
          }
        }
        
        return {
          ...session,
          unreadCount,
          messages: messages.length
        };
      })
    );
    
    res.json(sessionsWithUnreadCount);
  } catch (error) {
    console.error("Error getting support sessions:", error);
    res.status(500).json({ message: "Failed to get support sessions" });
  }
});

// API để lấy danh sách tin nhắn của một phiên chat
router.get("/messages/:sessionId", isStaff, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { sessionId } = req.params;
    const staffId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!staffId) {
      return res.status(401).json({ message: "Staff ID not found" });
    }

    // Kiểm tra quyền truy cập session (admin có thể xem mọi phiên, staff chỉ xem phiên được assign)
    const session = await storage.getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    let sessionData: any = {};
    try {
      sessionData = JSON.parse(session.metadata || "{}");
    } catch (e) {
      console.error("Error parsing session metadata:", e);
    }

    if (!isAdmin && sessionData.assignedTo !== staffId) {
      return res.status(403).json({ 
        message: "Không có quyền xem tin nhắn trong session này" 
      });
    }

    // Lấy tin nhắn và trả về
    const messages = await storage.getChatMessages(sessionId);
    
    // Nếu chưa từng được gán cho nhân viên này hoặc đã gán nhưng là người khác, thì cập nhật
    if (!sessionData.assignedTo || (sessionData.assignedTo !== staffId && isAdmin)) {
      // Cập nhật session với nhân viên phụ trách
      await storage.updateChatSession(sessionId, {
        metadata: JSON.stringify({
          ...sessionData,
          assignedTo: staffId,
          isHumanAssigned: true,
          lastReadByStaff: Date.now()
        })
      });

      // Thông báo cho client
      io.to(sessionId).emit('support-staff-joined', {
        staffId,
        staffName: req.user?.name || 'Nhân viên hỗ trợ'
      });
    } else {
      // Chỉ cập nhật thời điểm đọc tin nhắn
      await storage.updateChatSession(sessionId, {
        metadata: JSON.stringify({
          ...sessionData,
          lastReadByStaff: Date.now()
        })
      });
    }
    
    res.json(messages);
  } catch (error) {
    console.error("Error getting chat messages:", error);
    res.status(500).json({ message: "Failed to get chat messages" });
  }
});

export default router; 