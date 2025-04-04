import express from "express";
import type { Request, Response } from "express";
import { ChatbotService } from "../services/chatbot";
import { storage } from "../storage";
import { InsertChatSession } from "../types";
import { getSocketServer } from "../io";

const router = express.Router();
const chatbotService = new ChatbotService(storage);

// Khởi tạo chat session mới
router.post("/session", async (req: Request, res: Response) => {
  try {
    const { metadata } = req.body;
    const sessionData: InsertChatSession = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      metadata: metadata || null
    };
    const session = await storage.createChatSession(sessionData);
    res.json(session);
  } catch (error) {
    console.error("Error creating chat session:", error);
    res.status(500).json({ error: "Failed to create chat session" });
  }
});

// Lấy thông tin chat session
router.get("/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const session = await storage.getChatSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Chat session not found" });
    }
    res.json(session);
  } catch (error) {
    console.error("Error getting chat session:", error);
    res.status(500).json({ error: "Failed to get chat session" });
  }
});

// Gửi tin nhắn mới
router.post("/session/:sessionId/message", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { message, sender } = req.body;

    if (!message || !sender) {
      return res.status(400).json({ error: "Message and sender are required" });
    }

    // Trước tiên kiểm tra xem phiên này đã có nhân viên hỗ trợ chưa
    const session = await storage.getChatSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Chat session not found" });
    }
    
    // Parse metadata để kiểm tra trạng thái nhân viên hỗ trợ
    let sessionMetadata: any = {};
    let isHumanAssigned = false;
    
    if (session.metadata) {
      try {
        sessionMetadata = JSON.parse(session.metadata);
        isHumanAssigned = Boolean(sessionMetadata.isHumanAssigned);
        console.log(`Session ${sessionId} human assigned status:`, isHumanAssigned);
      } catch (e) {
        console.error('Error parsing session metadata:', e);
      }
    }

    // Log khi nhận được tin nhắn mới từ người dùng
    if (sender === "user") {
      console.log(`Received message from user in session ${sessionId}: ${message}`);
      
      // Ghi lại thời gian tin nhắn đầu tiên của khách hàng nếu chưa có
      if (!sessionMetadata.firstCustomerMessageTime) {
        sessionMetadata.firstCustomerMessageTime = new Date().toISOString();
        
        // Cập nhật metadata của phiên
        await storage.updateChatSession(sessionId, {
          metadata: JSON.stringify(sessionMetadata)
        });
        
        console.log(`Recorded first customer message time for session ${sessionId}`);
      }
    } 
    
    // Ghi lại thời gian phản hồi đầu tiên của nhân viên
    if (sender === "staff") {
      // Chỉ ghi lại nếu đã có tin nhắn từ khách hàng và chưa có phản hồi
      if (sessionMetadata.firstCustomerMessageTime && !sessionMetadata.firstResponseTime) {
        sessionMetadata.firstResponseTime = new Date().toISOString();
        
        // Tính thời gian phản hồi (phút)
        const responseTimeMs = new Date(sessionMetadata.firstResponseTime).getTime() - 
                               new Date(sessionMetadata.firstCustomerMessageTime).getTime();
        const responseTimeMinutes = (responseTimeMs / 1000 / 60).toFixed(2);
        
        // Lưu thêm thời gian phản hồi tính bằng phút
        sessionMetadata.responseTime = parseFloat(responseTimeMinutes);
        
        // Cập nhật metadata của phiên
        await storage.updateChatSession(sessionId, {
          metadata: JSON.stringify(sessionMetadata)
        });
        
        console.log(`Recorded first staff response time for session ${sessionId}: ${responseTimeMinutes} minutes`);
      }
    }

    // Lưu tin nhắn người dùng hoặc nhân viên
    const savedMessage = await storage.saveChatMessage({
      sessionId,
      content: message,
      sender,
      timestamp: new Date(),
      metadata: null
    });
    
    // Phát tín hiệu realtime về tin nhắn mới thông qua Socket.IO
    if (getSocketServer()) {
      getSocketServer().to(sessionId).emit('new-message', savedMessage);
    }

    console.log(`Processing message in session ${sessionId}. isHumanAssigned: ${isHumanAssigned}, sender: ${sender}`);

    // Nếu tin nhắn từ user và chưa có nhân viên tham gia, mới xử lý với chatbot
    if (sender === "user" && !isHumanAssigned) {
      console.log(`Forwarding message to chatbot for session ${sessionId}`);
      // Sử dụng handleMessage với đầy đủ phân tích
      const { response, requiresHumanSupport } = await chatbotService.handleMessage(sessionId, message);
      
      // Lấy context để biết intent của tin nhắn người dùng
      const context = await chatbotService.getMessageContext(sessionId);
      
      // Lưu phản hồi của bot
      const botMessage = await storage.saveChatMessage({
        sessionId,
        content: response,
        sender: "bot",
        timestamp: new Date(),
        metadata: JSON.stringify({ 
          requiresHumanSupport,
          intent: context?.intent || 'unknown',
          confidence: context?.confidence || 0
        })
      });

      // Phát tín hiệu realtime về phản hồi từ bot
      if (getSocketServer()) {
        getSocketServer().to(sessionId).emit('new-message', botMessage);
      }

      // Nếu cần chuyển sang nhân viên hỗ trợ
      if (requiresHumanSupport) {
        // Cập nhật session để đánh dấu cần hỗ trợ từ nhân viên
        await storage.updateChatSession(sessionId, { 
          metadata: JSON.stringify({
            ...sessionMetadata,
            needsHumanSupport: true,
            lastMessage: message,
            lastIntent: context?.intent || 'human_support',
            lastActivity: new Date().toISOString()
          })
        });
        
        console.log(`Session updated successfully: ${sessionId}`);
        console.log(`Sending support request to staff channel: ${sessionId}`);
        
        // Thông báo cho nhân viên support về phiên chat mới cần hỗ trợ
        if (getSocketServer()) {
          const staffAvailable = getSocketServer().of('/').adapter.rooms.has('support-staff');
          console.log(`Staff Socket Server available: ${staffAvailable}`);
          
          const supportData = {
            id: sessionId,
            sessionId,
            lastMessage: message,
            timestamp: new Date(),
            needsHumanSupport: true,
            startedAt: session.startedAt,
            lastActivity: new Date(),
            metadata: sessionMetadata
          };
          
          console.log(`Emitting new-support-request with data: ${JSON.stringify(supportData)}`);
          getSocketServer().to('support-staff').emit('new-support-request', supportData);
        }
      }
      
      return res.json({
        userMessage: savedMessage,
        botMessage
      });
    } else {
      // Nếu đã có nhân viên tham gia hoặc tin nhắn từ nhân viên, chỉ trả về tin nhắn đã lưu
      if (sender === "user") {
        console.log(`Human support is assigned for session ${sessionId}, skipping chatbot processing`);
      }
      return res.json({
        userMessage: savedMessage
      });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

// Lấy lịch sử tin nhắn
router.get("/session/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const messages = await storage.getChatMessages(req.params.sessionId);
    res.json(messages);
  } catch (error) {
    console.error("Error getting chat messages:", error);
    res.status(500).json({ error: "Failed to get chat messages" });
  }
});

// API để khách hàng gửi đánh giá phiên hỗ trợ
router.post("/session/:sessionId/rate", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { rating, feedback } = req.body;

    // Kiểm tra đầu vào
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Đánh giá không hợp lệ. Vui lòng đánh giá từ 1-5 sao." });
    }

    // Kiểm tra phiên hỗ trợ
    const session = await storage.getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Phiên hỗ trợ không tồn tại" });
    }

    // Parse metadata
    let sessionMetadata = {};
    try {
      sessionMetadata = session.metadata ? JSON.parse(session.metadata) : {};
    } catch (e) {
      console.error('Error parsing session metadata:', e);
      return res.status(500).json({ error: "Lỗi xử lý dữ liệu phiên" });
    }

    // Chỉ cho phép đánh giá phiên đã kết thúc (có status = completed)
    if (sessionMetadata.status !== 'completed') {
      return res.status(400).json({ error: "Chỉ có thể đánh giá phiên hỗ trợ đã hoàn thành" });
    }

    // Cập nhật metadata với đánh giá
    const updatedMetadata = {
      ...sessionMetadata,
      rating,
      feedback: feedback || '',
      ratedAt: new Date().toISOString()
    };

    // Lưu vào database
    await storage.updateChatSession(sessionId, {
      metadata: JSON.stringify(updatedMetadata)
    });

    // Thông báo cho nhân viên về đánh giá mới (nếu cần)
    if (sessionMetadata.completedBy && getSocketServer()) {
      getSocketServer().to('support-staff').emit('new-rating', {
        sessionId,
        rating,
        feedback,
        staffId: sessionMetadata.completedBy
      });
    }

    // Ghi log
    console.log(`Session ${sessionId} rated ${rating}/5 stars with feedback: "${feedback}"`);

    // Thêm tin nhắn hệ thống về đánh giá
    await storage.saveChatMessage({
      sessionId,
      content: `Khách hàng đã đánh giá phiên hỗ trợ với ${rating}/5 sao.`,
      sender: 'system',
      timestamp: new Date(),
      metadata: null
    });

    // Trả về kết quả thành công
    res.json({ 
      success: true, 
      message: "Cảm ơn bạn đã đánh giá phiên hỗ trợ!" 
    });
  } catch (error) {
    console.error("Error rating support session:", error);
    res.status(500).json({ error: "Lỗi khi lưu đánh giá" });
  }
});

export default router; 