import { Server as SocketServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { Socket } from "socket.io";
import { IncomingMessage } from "http";
import { IStorage } from "./storage";
import jwt from "jsonwebtoken";
import { PostgresStorage } from "./storage";
import { InsertChatMessage } from "@shared/schema";
import { io as clientIO } from "socket.io-client";

interface CustomSocket extends Socket {
  request: IncomingMessage & {
    user?: any;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "very-secret-key-for-jwt-tokens";

let io: SocketServer;

// Theo dõi tin nhắn đã gửi để tránh gửi trùng lặp
const messageTracker = new Map<string, Set<string>>();

// Thêm message ID vào bộ theo dõi
function trackMessage(sessionId: string, messageId: string): boolean {
  let sessionMessages = messageTracker.get(sessionId);
  
  // Nếu chưa có tập tin nhắn cho phiên này, tạo mới
  if (!sessionMessages) {
    sessionMessages = new Set<string>();
    messageTracker.set(sessionId, sessionMessages);
  }
  
  // Kiểm tra xem tin nhắn đã tồn tại chưa
  if (sessionMessages.has(messageId)) {
    console.log(`Phát hiện tin nhắn trùng lặp: ${messageId} trong phiên ${sessionId}`);
    return false; // Đã tồn tại
  }
  
  // Nếu chưa tồn tại, thêm vào và giới hạn kích thước (giữ 50 tin nhắn gần nhất)
  sessionMessages.add(messageId);
  if (sessionMessages.size > 50) {
    const oldestMessage = Array.from(sessionMessages)[0];
    sessionMessages.delete(oldestMessage);
  }
  
  return true; // Tin nhắn mới
}

// Xử lý phản hồi tự động của bot
async function handleBotResponse(sessionId: string, userMessage: string) {
  try {
    // Kiểm tra xem phiên đã được gán cho nhân viên chưa
    const storage = (global as any).storageInstance;
    const session = await storage.getChatSession(sessionId);
    
    if (!session) {
      console.log(`Phiên ${sessionId} không tồn tại khi xử lý phản hồi bot`);
      return;
    }
    
    let metadata: any = {};
    try {
      metadata = session.metadata ? JSON.parse(session.metadata) : {};
    } catch (e) {
      console.error("Error parsing session metadata:", e);
    }
    
    // Kiểm tra xem phiên đã có nhân viên hỗ trợ chưa
    console.log(`Chatbot checking session ${sessionId} - isHumanAssigned: ${metadata.isHumanAssigned}`);
    
    if (metadata.isHumanAssigned) {
      console.log(`Chatbot skipping message processing for session ${sessionId} as human is assigned`);
      return;
    }
    
    // Logic xử lý bot ở đây - giữ lại code xử lý bot hiện tại
    // Phần này sẽ phụ thuộc vào cách ứng dụng hiện tại xử lý bot
  } catch (error) {
    console.error('Error in bot response handling:', error);
  }
}

export function initializeSocketServer(httpServer: HTTPServer, storage: IStorage) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Lưu storage vào biến global để có thể sử dụng trong các hàm khác
  (global as any).storageInstance = storage;

  io.on("connection", (socket: CustomSocket) => {
    console.log("New client connected");
    let clientSessionId: string | null = null;
    let isStaff = false;
    
    // Xác định kiểu client (khách hàng hoặc nhân viên)
    const userType = socket.handshake.query.type;
    isStaff = userType === 'staff';
    console.log(`Client type: ${userType}, isStaff: ${isStaff}`);
    
    // Xác thực token nếu có
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        socket.data.user = decoded;
        console.log(`Authenticated user connected: ${decoded.username} (${decoded.id})`);
        
        // Nếu là nhân viên, thêm vào phòng nhân viên
        if (decoded.role === 'staff' || decoded.role === 'admin') {
          socket.join('support-staff');
          console.log(`Staff member ${decoded.username} (${decoded.id}) joined support-staff room`);
          isStaff = true;
        }
      } catch (error) {
        console.error('Authentication error:', error);
      }
    }
    
    // Đăng ký client vào danh sách kết nối
    socket.on('join-room', (roomId) => {
      console.log(`Client joining room: ${roomId}`);
      socket.join(roomId);
      
      if (roomId === 'support-staff') {
        console.log('Staff member joined support channel');
        
        // Gửi danh sách phiên cần hỗ trợ ngay khi staff tham gia
        setTimeout(async () => {
          try {
            const allSessions = await storage.getAllChatSessions();
            const sessionsNeedingSupport = allSessions.filter(session => {
              try {
                const metadata = session.metadata ? JSON.parse(session.metadata) : {};
                return metadata.needsHumanSupport && !metadata.isHumanAssigned;
              } catch (e) {
                console.error('Error parsing session metadata:', e);
                return false;
              }
            });
            
            if (sessionsNeedingSupport.length > 0) {
              console.log(`Sending ${sessionsNeedingSupport.length} sessions needing support to newly joined staff member`);
              socket.emit('pending-support-sessions', sessionsNeedingSupport);
            }
          } catch (error) {
            console.error('Error fetching sessions for staff:', error);
          }
        }, 1000);
      } else {
        // Tham gia vào phiên hỗ trợ
        socket.on('join-chat', (data) => {
          if (data && data.sessionId) {
            clientSessionId = data.sessionId;
            console.log(`Client joined chat session: ${clientSessionId}`);
          }
        });
      }
    });
    
    // Kiểm tra tư cách thành viên phòng (để debug)
    socket.on('check-room-membership', (data) => {
      const room = data.room;
      const isMember = socket.rooms.has(room);
      console.log(`Check room membership for ${room}: ${isMember}`);
      socket.emit('room-membership-result', {
        room, 
        isMember,
        allRooms: Array.from(socket.rooms),
        roomSize: io.sockets.adapter.rooms.get(room)?.size || 0,
        roomMembers: Array.from(io.sockets.adapter.rooms.get(room) || new Set())
      });
    });
    
    // Xử lý gửi tin nhắn từ các thiết bị
    socket.on('send-message', async (data) => {
      try {
        const { sessionId, message, sender } = data;
        console.log(`Received message from ${sender} in session ${sessionId}: ${message}`);
        
        // Lưu tin nhắn vào database
        const savedMessage = await storage.saveChatMessage({
          content: message.content,
          sender: message.sender,
          sessionId: message.sessionId,
          metadata: undefined
        });
        
        // Chỉ gửi tin nhắn qua socket nếu nó là tin nhắn mới
        if (trackMessage(sessionId, savedMessage.id.toString())) {
          // Gửi lại tin nhắn cho tất cả mọi người trong phòng
          io.to(sessionId).emit('new-message', savedMessage);
          
          // Kiểm tra trạng thái phiên và xử lý bot nếu cần
          handleBotResponse(sessionId, message);
        } else {
          console.log(`Không gửi lại tin nhắn trùng lặp ${savedMessage.id} trong phiên ${sessionId}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
    
    // Xử lý ngắt kết nối
    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${clientSessionId || 'no-session'}, reason: ${reason}`);
      
      // Xử lý dọn dẹp tài nguyên nếu cần
      if (clientSessionId) {
        socket.leave(clientSessionId);
      }
      
      // Thông báo khi staff ngắt kết nối
      if (isStaff) {
        console.log('Staff member disconnected');
      }
    });
  });

  return io;
}

// Lấy thể hiện của Socket.IO
export function getSocketServer() {
  return io;
}

// Export io trực tiếp để tương thích với code hiện tại
export { io }; 