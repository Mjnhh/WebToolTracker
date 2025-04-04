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
              isHumanAssigned = Boolean(sessionMetadata.isHumanAssigned);
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
          timestamp: new Date(data.timestamp),
          metadata: null
        });
        
        // Phát tín hiệu realtime về tin nhắn mới thông qua Socket.IO cho các nhân viên hỗ trợ
        if (staffSocketServer) {
          staffSocketServer.to(data.sessionId).emit('new-message', userMessage);
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
            timestamp: new Date(),
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
              metadata: JSON.stringify(updatedMetadata)
            });
            
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
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', sessionId);
    });
  });
} 