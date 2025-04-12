import { Server } from 'socket.io';
import { ChatbotService } from './services/chatbot';
import { storage } from './storage';
import { io as staffSocketServer } from './io';

export function initializeSocket(io: Server) {
  const chatbotService = new ChatbotService(storage);

  io.on('connection', (socket) => {
    const sessionId = socket.handshake.query.sessionId as string;
    
    console.log('Client connected:', sessionId);
    
    socket.join(`chat:${sessionId}`);
    socket.join(sessionId);
    
    // Kiểm tra và gửi tin nhắn chào mừng khi kết nối mới
    (async () => {
      try {
        // Kiểm tra xem session có tồn tại không
        const session = await storage.getChatSession(sessionId);
        if (!session) {
          console.log(`Session ${sessionId} not found, will not send greeting`);
          return;
        }
        
        // Kiểm tra xem session đã có tin nhắn nào chưa
        const messages = await storage.getChatMessages(sessionId);
        if (messages && messages.length === 0) {
          console.log(`Sending welcome message to new session ${sessionId}`);
          
          // Tạo tin nhắn chào mừng
          const welcomeMessage = '👋 Xin chào! Tôi là trợ lý ảo của TectonicDevs. Tôi có thể giúp bạn tìm hiểu về dịch vụ phát triển website, chatbot thông minh và các giải pháp công nghệ của chúng tôi. Bạn cần hỗ trợ gì?';
          
          // Lưu tin nhắn chào mừng vào cơ sở dữ liệu
          const botMessage = await storage.saveChatMessage({
            sessionId,
            content: welcomeMessage,
            sender: 'bot',
            metadata: undefined
          });
          
          // Gửi tin nhắn chào mừng qua WebSocket
          socket.emit('bot_message', {
            content: welcomeMessage,
            requiresHumanSupport: false
          });
        }
      } catch (error) {
        console.error('Error sending welcome message:', error);
      }
    })();
    
    socket.on('user_message', async (data) => {
      try {
        console.log(`Received message from user in session ${data.sessionId}:`, data.message);
        
        // Kiểm tra session
        const checkSession = await storage.getChatSession(data.sessionId);
        let isHumanAssigned = false;
        let sessionMetadata = {};
        
        if (checkSession) {
          // Kiểm tra xem đã có nhân viên hỗ trợ chưa
          if (checkSession.metadata) {
            try {
              sessionMetadata = JSON.parse(checkSession.metadata);
              isHumanAssigned = Boolean((sessionMetadata as { isHumanAssigned?: boolean }).isHumanAssigned);
              console.log(`Chatbot checking session ${data.sessionId} - isHumanAssigned: ${isHumanAssigned}`);
            } catch (e) {
              console.error('Error parsing session metadata:', e);
            }
          }
        } else {
          console.log(`Session ${data.sessionId} not found, creating new session`);
          await storage.createChatSession({
            id: data.sessionId,
            userId: null,
            metadata: JSON.stringify({
              userAgent: socket.handshake.headers['user-agent'],
              language: socket.handshake.headers['accept-language'],
              timestamp: new Date().toISOString()
            })
          });
        }
        
        // Lưu tin nhắn người dùng với timestamp
        const userMessage = await storage.saveChatMessage({
          sessionId: data.sessionId,
          content: data.message,
          sender: 'user',
          metadata: undefined
        });
        
        // Phát tín hiệu realtime về tin nhắn mới thông qua Socket.IO cho các nhân viên hỗ trợ
        if (staffSocketServer) {
          // Gửi tin nhắn cho phòng có sessionId 
          staffSocketServer.to(data.sessionId).emit('new-message', userMessage);
          
          // Thêm broadcast cho support-staff để thông báo phiên có tin nhắn mới
          staffSocketServer.to('support-staff').emit('session-updated', {
            sessionId: data.sessionId,
            hasNewMessages: true,
            lastMessage: userMessage
          });
        }
        
        // Nếu đã có nhân viên hỗ trợ, không gọi chatbot
        if (isHumanAssigned) {
          console.log(`Chatbot skipping message processing for session ${data.sessionId} as human is assigned`);
          return;
        }
        
        // Xử lý phản hồi từ chatbot
        const { response, requiresHumanSupport } = await chatbotService.handleMessage(data.sessionId, data.message);
        
        // Chỉ lưu và gửi phản hồi của bot nếu có nội dung
        if (response && response.trim() !== '') {
          // Lưu phản hồi của bot
          const botMessage = await storage.saveChatMessage({
            sessionId: data.sessionId,
            content: response,
            sender: 'bot',
            metadata: JSON.stringify({ requiresHumanSupport })
          });
          
          // Gửi phản hồi qua WebSocket
          socket.emit('bot_message', {
            content: response,
            requiresHumanSupport
          });
        }
        
        // Nếu cần chuyển sang nhân viên hỗ trợ
        if (requiresHumanSupport) {
          try {
            // Lấy thông tin session hiện tại
            const currentSession = await storage.getChatSession(data.sessionId);
            let sessionMetadata = {};
            
            if (currentSession && currentSession.metadata) {
              try {
                sessionMetadata = JSON.parse(currentSession.metadata);
              } catch (e) {
                console.error('Error parsing existing session metadata:', e);
              }
            }
            
            // Cập nhật session để đánh dấu cần hỗ trợ từ nhân viên
            const updatedMetadata = {
              ...sessionMetadata,
              needsHumanSupport: true,
              lastMessage: data.message,
              lastIntent: 'human_support',
              lastActivity: new Date().toISOString()
            };
            
            const updatedSession = await storage.updateChatSession(data.sessionId, {
              metadata: JSON.stringify(updatedMetadata),
              lastActivity: new Date()
            });
            
            if (!updatedSession) {
              console.error('Failed to update chat session');
              return;
            }
            
            console.log('Session updated successfully:', updatedSession.id);
            console.log('Sending support request to staff channel:', data.sessionId);
            console.log('Staff Socket Server available:', !!staffSocketServer);
            
            // Thông báo cho tất cả nhân viên qua kênh "support-staff"
            if (staffSocketServer) {
              const supportRequest = {
                id: data.sessionId,
                sessionId: data.sessionId,
                lastMessage: data.message,
                timestamp: new Date(),
                needsHumanSupport: true,
                startedAt: currentSession?.startedAt || new Date(),
                lastActivity: new Date(),
                metadata: updatedMetadata
              };
              
              console.log('Emitting new-support-request with data:', JSON.stringify(supportRequest));
              staffSocketServer.to('support-staff').emit('new-support-request', supportRequest);
            } else {
              console.error("Staff socket server not initialized");
            }
            
            // Thông báo người dùng rằng yêu cầu của họ đã được gửi đến nhân viên
            socket.emit('support_status', {
              status: 'requested',
              message: 'Đang kết nối với nhân viên hỗ trợ...'
            });
          } catch (error) {
            console.error('Error handling human support request:', error);
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        socket.emit('error', {
          message: 'Failed to process message'
        });
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Client disconnected:', sessionId);
      console.log(`Client disconnected with reason: ${reason}`);
      
      // Rời khỏi các phòng
      if (sessionId) {
        socket.leave(`chat:${sessionId}`);
        socket.leave(sessionId);
      }
      
      // Có thể thực hiện xử lý dọn dẹp nếu cần
      // Ví dụ: đánh dấu session không hoạt động nếu khách hàng ngắt kết nối
    });

    socket.on('connect_error', (error) => {
      console.error(`Socket connection error for session ${sessionId}:`, error.message);
    });

    socket.on('connect_timeout', () => {
      console.error(`Socket connection timeout for session ${sessionId}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for session ${sessionId}:`, error);
    });
  });
} 