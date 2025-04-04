import { Server as SocketIOServer } from "socket.io";
import { ChatbotService } from './services/chatbot';
import { storage } from './storage';
import { io as staffSocketServer } from './io';
import { IStorage } from "./storage";

// Map lưu trữ ánh xạ giữa ID người dùng và socket ID
const userSocketMap = new Map();
// Map lưu trữ ánh xạ giữa sessionId và trạng thái người dùng
const sessionStatusMap = new Map();

export function initializeSocket(io: SocketIOServer) {
  const chatbotService = new ChatbotService(storage);

  io.on('connection', (socket) => {
    console.log("New client connected");
    let userId: number | null = null;
    let sessionId: string | null = null;
    
    // Kiểm tra token
    const token = socket.handshake.auth.token || 
                 (socket.handshake.query && socket.handshake.query.token);
    
    // Gán thông tin client
    socket.data.clientId = socket.id;

    if (token) {
      try {
        // Lưu ý: trích xuất thông tin từ token
        const tokenParts = token.toString().split('.');
        if (tokenParts.length === 3) {
          try {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            userId = payload.id;
            socket.data.userId = userId;
            socket.data.username = payload.username;
            socket.data.role = payload.role;
            
            // Lưu ánh xạ user ID với socket ID
            userSocketMap.set(userId, socket.id);
            
            console.log(`Authenticated user connected: ${payload.username}`);
          } catch (error) {
            console.error('Error parsing token:', error);
          }
        }
      } catch (error) {
        console.error('Error processing token:', error);
      }
    }
    
    // Lưu ID client
    console.log(`Client connected: ${socket.id}`);
    
    // Xử lý tham gia phòng
    socket.on("join-room", (room) => {
      socket.join(room);
      console.log(`Client joining room: ${room}`);
      
      if (room === 'support-staff') {
        console.log('Staff member joined support channel');
      }
    });
    
    // Xử lý tham gia chat
    socket.on("join-chat", (data) => {
      if (data && data.sessionId) {
        sessionId = data.sessionId;
        socket.join(`chat:${sessionId}`);
        console.log(`Client joined chat session: ${sessionId}`);
        
        // Đánh dấu phiên này là trực tuyến
        sessionStatusMap.set(sessionId, 'online');
        
        // Gửi thông báo trạng thái online cho tất cả nhân viên
        io.to('support-staff').emit('user-status-change', {
          sessionId: sessionId,
          status: 'online'
        });
      }
    });
    
    // Xử lý rời phòng chat
    socket.on("leave-chat", (data) => {
      if (data && data.sessionId) {
        socket.leave(`chat:${data.sessionId}`);
        console.log(`Client left chat session: ${data.sessionId}`);
        
        // Kiểm tra xem còn client nào khác trong phòng không
        const room = io.sockets.adapter.rooms.get(`chat:${data.sessionId}`);
        if (!room || room.size === 0) {
          // Nếu không còn ai trong phòng, đánh dấu phiên là offline
          sessionStatusMap.set(data.sessionId, 'offline');
          
          // Gửi thông báo trạng thái offline cho tất cả nhân viên
          io.to('support-staff').emit('user-status-change', {
            sessionId: data.sessionId,
            status: 'offline'
          });
        }
      }
    });
    
    // Xử lý ngắt kết nối
    socket.on("disconnect", (reason) => {
      console.log("Client disconnected");
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      
      // Xóa ánh xạ user ID với socket ID
      if (userId) {
        userSocketMap.delete(userId);
      }
      
      // Nếu client đang trong phiên chat, đánh dấu là offline
      if (sessionId) {
        // Kiểm tra xem còn client nào khác trong phòng không
        const room = io.sockets.adapter.rooms.get(`chat:${sessionId}`);
        if (!room || room.size === 0) {
          // Nếu không còn ai trong phòng, đánh dấu phiên là offline
          sessionStatusMap.set(sessionId, 'offline');
          
          // Gửi thông báo trạng thái offline cho tất cả nhân viên
          io.to('support-staff').emit('user-status-change', {
            sessionId: sessionId,
            status: 'offline'
          });
        }
      }
      
      if (socket.data.role === 'staff') {
        console.log('Staff member disconnected');
      }
    });

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
  
  return io;
} 