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
    
    // Cập nhật cả trong metadata và trường trong cơ sở dữ liệu
    await storage.updateChatSession(sessionId, {
      metadata: JSON.stringify(updatedMetadata),
      isHumanAssigned: true,
      assignedTo: staffId
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

    // Cập nhật thông tin metadata
    const updatedMetadata = {
      ...sessionData,
      isHumanAssigned: false,
      assignedTo: undefined,
      status: 'completed',  // Đánh dấu phiên hoàn thành
      completedAt: new Date().toISOString(), // Thêm thời gian hoàn thành
      completedBy: staffId, // Lưu ID nhân viên kết thúc phiên
      staffName: req.user?.name || 'Staff' // Lưu tên nhân viên
    };

    // Cập nhật session cả trong metadata và trường cơ sở dữ liệu
    await storage.updateChatSession(sessionId, {
      metadata: JSON.stringify(updatedMetadata),
      isHumanAssigned: false,  // Cập nhật trường is_human_assigned trong cơ sở dữ liệu
      assignedTo: undefined     // Cập nhật trường assigned_to trong cơ sở dữ liệu
    });

    // Thông báo cho client
    io.to(sessionId).emit('support-ended', {
      staffId,
      timestamp: new Date(),
      shouldRate: true // Thêm flag yêu cầu đánh giá
    });

    // Gửi tin nhắn kết thúc
    await storage.saveChatMessage({
      sessionId,
      content: "Phiên hỗ trợ đã kết thúc. Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.",
      sender: 'bot',
      timestamp: new Date(),
      metadata: undefined
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
      let lastMessage = '';
      
      try {
        if (session.metadata) {
          metadata = JSON.parse(session.metadata);
          needsHumanSupport = metadata.needsHumanSupport || false;
          lastMessage = metadata.lastMessage || '';
        }
      } catch (e) {
        console.error("Error parsing session metadata for session", session.id, e);
      }
      
      // Sử dụng trường isHumanAssigned và assignedTo từ cơ sở dữ liệu
      // thay vì trong metadata
      const isHumanAssigned = session.isHumanAssigned || false;
      const assignedTo = session.assignedTo || null;
      
      // Thêm thông tin vào session
      return {
        ...session,
        metadata,
        needsHumanSupport,
        isHumanAssigned,  // Sử dụng giá trị từ cơ sở dữ liệu
        assignedTo,       // Sử dụng giá trị từ cơ sở dữ liệu  
        lastMessage
      };
    }).filter(session => {
      // Admin có thể xem tất cả các phiên cần hỗ trợ, kể cả đã được gán cho nhân viên khác
      if (isAdmin) {
        return session.needsHumanSupport;
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

// API để lấy thống kê phiên hỗ trợ
router.get("/stats", isStaff, async (req: Request & { user?: any }, res: Response) => {
  try {
    const period = req.query.period || 'today';
    const staffId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!staffId) {
      return res.status(401).json({ message: "Staff ID not found" });
    }

    // Lấy tất cả các phiên chat
    const allSessions = await storage.getAllChatSessions();

    // Xác định thời gian bắt đầu dựa vào period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'custom':
        const customStart = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
        customStart.setDate(customStart.getDate() - 30); // Mặc định 30 ngày nếu không có ngày cụ thể
        startDate = customStart;
        break;
      default: // today
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    // Lọc phiên chat trong khoảng thời gian
    const filteredSessions = allSessions.filter(session => {
      const sessionDate = new Date(session.startedAt || session.lastActivity || Date.now());
      return sessionDate >= startDate && sessionDate <= now;
    });

    // Tính toán các số liệu
    let totalSessions = filteredSessions.length;
    let completedSessions = 0;
    let totalResponseTime = 0;
    let sessionsWithResponseTime = 0;
    let averageRating = 0;
    let ratingsCount = 0;
    let sessionsByDay: Record<string, number> = {};
    
    // Dữ liệu theo nhân viên
    let staffStats: Record<string, { 
      id: string, 
      name: string, 
      sessions: number, 
      completed: number, 
      avgResponseTime: number,
      rating: number
    }> = {};
    
    // Danh sách các đánh giá gần đây
    let recentRatings: Array<{
      sessionId: string,
      rating: number,
      feedback: string,
      timestamp: string,
      staffName: string
    }> = [];

    // Phân tích từng phiên
    for (const session of filteredSessions) {
      let metadata: any = {};
      try {
        metadata = session.metadata ? JSON.parse(session.metadata) : {};
      } catch (e) {
        console.error("Error parsing session metadata for session", session.id, e);
        continue;
      }

      // Đếm phiên đã hoàn thành
      if (metadata.status === 'completed') {
        completedSessions++;
      }

      // Tính thời gian phản hồi trung bình
      if (metadata.firstResponseTime && metadata.firstCustomerMessageTime) {
        const responseTime = 
          (new Date(metadata.firstResponseTime).getTime() - 
           new Date(metadata.firstCustomerMessageTime).getTime()) / 1000 / 60; // Phút
        
        if (responseTime > 0) {
          totalResponseTime += responseTime;
          sessionsWithResponseTime++;
        }
      }

      // Đánh giá trung bình
      if (metadata.rating) {
        averageRating += metadata.rating;
        ratingsCount++;
        
        // Thu thập các đánh giá gần đây
        recentRatings.push({
          sessionId: session.id,
          rating: metadata.rating,
          feedback: metadata.feedback || '',
          timestamp: metadata.ratedAt || metadata.completedAt || session.lastActivity,
          staffName: metadata.staffName || 'Nhân viên'
        });
      }

      // Thống kê theo ngày
      const sessionDate = new Date(session.startedAt || session.lastActivity || Date.now());
      const dateKey = sessionDate.toISOString().split('T')[0];
      sessionsByDay[dateKey] = (sessionsByDay[dateKey] || 0) + 1;
      
      // Thống kê theo nhân viên
      if (metadata.assignedTo) {
        if (!staffStats[metadata.assignedTo]) {
          // Tìm tên nhân viên từ DB hoặc dùng ID nếu không tìm thấy
          // Giả lập: sẽ cập nhật tên thật sau
          staffStats[metadata.assignedTo] = {
            id: metadata.assignedTo,
            name: metadata.staffName || `Staff ${metadata.assignedTo.substring(0, 6)}`,
            sessions: 0,
            completed: 0,
            avgResponseTime: 0,
            rating: 0
          };
        }
        
        staffStats[metadata.assignedTo].sessions++;
        
        if (metadata.status === 'completed') {
          staffStats[metadata.assignedTo].completed++;
        }
        
        if (metadata.rating) {
          staffStats[metadata.assignedTo].rating += metadata.rating;
        }
      }
    }

    // Tính trung bình
    const avgResponseTime = sessionsWithResponseTime > 0 
      ? (totalResponseTime / sessionsWithResponseTime).toFixed(2) 
      : 0;
    
    const avgRating = ratingsCount > 0 
      ? (averageRating / ratingsCount).toFixed(1) 
      : 0;
    
    // Tính trung bình cho từng nhân viên
    Object.keys(staffStats).forEach(staffId => {
      const staff = staffStats[staffId];
      staff.avgResponseTime = parseFloat((totalResponseTime / (staff.sessions || 1)).toFixed(2));
      staff.rating = staff.rating > 0 ? parseFloat((staff.rating / staff.sessions).toFixed(1)) : 0;
    });

    // Tạo dữ liệu cho biểu đồ (7 ngày gần nhất)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const formattedDate = `${d.getDate()}/${d.getMonth() + 1}`;
      
      last7Days.push({
        date: formattedDate,
        count: sessionsByDay[dateKey] || 0
      });
    }
    
    // Sắp xếp đánh giá gần đây theo thời gian và giới hạn số lượng
    recentRatings.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // Giới hạn số lượng đánh giá hiển thị (tối đa 10 đánh giá gần nhất)
    const limitedRatings = recentRatings.slice(0, 10);

    // Trả về kết quả
    res.json({
      totalSessions,
      completedSessions,
      avgResponseTime,
      avgRating: `${avgRating}/5`,
      sessionsByDay: last7Days,
      staffStats: Object.values(staffStats),
      recentRatings: limitedRatings // Thêm danh sách đánh giá gần đây
    });
    
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ message: "Failed to get statistics" });
  }
});

// API để xóa phiên chat
router.post("/delete-session", isStaff, async (req: Request & { user?: any }, res: Response) => {
  try {
    const { sessionId } = req.body;
    const staffId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!staffId) {
      return res.status(401).json({ message: "Staff ID not found" });
    }

    // Kiểm tra quyền xóa phiên chat
    const session = await storage.getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    let sessionData: any = {};
    try {
      sessionData = session.metadata ? JSON.parse(session.metadata) : {};
    } catch (e) {
      console.error('Error parsing session metadata:', e);
    }

    // Chỉ admin hoặc nhân viên được gán cho phiên chat mới có quyền xóa
    if (!isAdmin && sessionData.assignedTo !== staffId.toString()) {
      return res.status(403).json({ 
        message: "Bạn không có quyền xóa phiên chat này" 
      });
    }

    // Xóa tất cả tin nhắn trong phiên chat
    try {
      // Lấy danh sách tin nhắn
      const messages = await storage.getChatMessages(sessionId);
      console.log(`Deleting ${messages.length} messages from session ${sessionId}`);
      
      // Trong một hệ thống thực tế, cần transaction để đảm bảo tính nhất quán dữ liệu
      // Ở đây, chúng ta chỉ xóa phiên chat mà không cần xóa tin nhắn vì
      // hệ thống đã có ràng buộc khóa ngoại tự động xóa tin nhắn khi xóa phiên
      
    } catch (error) {
      console.error('Error during message deletion:', error);
      // Không return ở đây để vẫn tiếp tục xóa phiên chat
    }

    // Xóa phiên chat từ cơ sở dữ liệu
    // Ở đây giả sử có phương thức deleteChatSession() trong storage
    // Nếu chưa có, cần thêm vào lớp storage
    await storage.deleteChatSession(sessionId);

    // Thông báo cho client
    io.to(sessionId).emit('session-deleted', {
      deletedBy: staffId,
      deletedByName: req.user?.name || 'Nhân viên',
      message: 'Phiên hỗ trợ đã bị xóa bởi nhân viên hỗ trợ'
    });

    res.json({ success: true, message: "Phiên chat đã được xóa thành công" });
  } catch (error) {
    console.error("Error deleting chat session:", error);
    res.status(500).json({ message: "Không thể xóa phiên chat" });
  }
});

export default router; 