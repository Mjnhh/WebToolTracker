import { Server as SocketServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { Socket } from "socket.io";
import { IncomingMessage } from "http";
import { IStorage } from "./storage";
import jwt from "jsonwebtoken";

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

// Mappping lưu trữ các phiên đang kết nối
const connectedSessions = new Map<string, Set<string>>();

// Lưu socket vào danh sách kết nối theo phiên
function trackSocketInSession(sessionId: string, socketId: string) {
  let sessionSockets = connectedSessions.get(sessionId);
  
  if (!sessionSockets) {
    sessionSockets = new Set<string>();
    connectedSessions.set(sessionId, sessionSockets);
  }
  
  sessionSockets.add(socketId);
  console.log(`Socket ${socketId} added to session ${sessionId}. Total: ${sessionSockets.size} sockets`);
}

// Xóa socket khỏi danh sách phiên khi ngắt kết nối
function removeSocketFromSession(sessionId: string, socketId: string) {
  const sessionSockets = connectedSessions.get(sessionId);
  
  if (sessionSockets) {
    sessionSockets.delete(socketId);
    console.log(`Socket ${socketId} removed from session ${sessionId}. Remaining: ${sessionSockets.size} sockets`);
    
    // Nếu không còn socket nào, xóa phiên khỏi danh sách
    if (sessionSockets.size === 0) {
      connectedSessions.delete(sessionId);
      console.log(`Session ${sessionId} removed from tracking as it has no connected sockets`);
    }
  }
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
    console.log(`New client connected: ${socket.id}`);
    let clientSessionId: string | null = null;
    let isStaff = false;
    
    // Xác định kiểu client (khách hàng hoặc nhân viên)
    const userType = socket.handshake.query.type;
    isStaff = userType === 'staff';
    
    // Lấy sessionId từ query params (nếu có)
    if (socket.handshake.query.sessionId) {
      clientSessionId = socket.handshake.query.sessionId as string;
      console.log(`Client connected with session ID in query: ${clientSessionId}`);
    }
    
    // Xác thực token nếu có
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        socket.data.user = decoded;
        console.log(`Authenticated user connected: ${decoded.username}`);
      } catch (error) {
        console.error('Authentication error:', error);
      }
    }
    
    // Xử lý ping từ client để duy trì kết nối
    socket.on('ping', (data) => {
      console.log(`Received ping from client ${socket.id}, sending pong`);
      socket.emit('pong', { timestamp: Date.now() });
    });
    
    // Đăng ký client vào danh sách kết nối
    socket.on('join-room', (roomId) => {
      console.log(`Client ${socket.id} joining room: ${roomId}`);
      socket.join(roomId);
      
      // Nếu là một phiên chat, theo dõi socket cho phiên này
      if (roomId !== 'support-staff' && !roomId.startsWith('chat:')) {
        clientSessionId = roomId;
        trackSocketInSession(clientSessionId, socket.id);
      }
      
      if (roomId === 'support-staff') {
        console.log('Staff member joined support channel');
      } else if (clientSessionId) {
        // Thêm vào room chat:<sessionId> để nhận tin nhắn từ staff
        const chatRoomId = `chat:${clientSessionId}`;
        if (roomId !== chatRoomId) {
          console.log(`Adding client to chat room: ${chatRoomId}`);
          socket.join(chatRoomId);
        }
      }
    });
    
    // Xử lý gửi tin nhắn từ các thiết bị
    socket.on('send-message', async (data) => {
      try {
        const { sessionId, message, sender } = data;
        console.log(`Received message from ${sender} in session ${sessionId}: ${message}`);
        
        // Lưu tin nhắn vào cơ sở dữ liệu
        const savedMessage = await storage.saveChatMessage({
          sessionId,
          content: message,
          sender: sender || 'user',
          timestamp: new Date(),
          metadata: null
        });
        
        console.log(`Saved message with ID ${savedMessage.id}, ready to broadcast to session ${sessionId}`);
        
        // Chỉ gửi tin nhắn qua socket nếu nó là tin nhắn mới
        if (trackMessage(sessionId, savedMessage.id.toString())) {
          console.log(`Broadcasting message to room ${sessionId} and chat:${sessionId}`);
          
          // Gửi tin nhắn đến cả hai room để đảm bảo mọi người nhận được
          io.to(sessionId).emit('new-message', savedMessage);
          io.to(`chat:${sessionId}`).emit('new-message', savedMessage);
          
          // Debug: Kiểm tra số client trong mỗi room
          const sessionRoom = io.sockets.adapter.rooms.get(sessionId);
          const chatRoom = io.sockets.adapter.rooms.get(`chat:${sessionId}`);
          
          console.log(`Room ${sessionId} has ${sessionRoom ? sessionRoom.size : 0} clients`);
          console.log(`Room chat:${sessionId} has ${chatRoom ? chatRoom.size : 0} clients`);
          
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
      console.log(`Client ${socket.id} disconnected, reason: ${reason}`);
      
      // Xử lý dọn dẹp tài nguyên nếu cần
      if (clientSessionId) {
        removeSocketFromSession(clientSessionId, socket.id);
        console.log(`Cleaned up socket ${socket.id} from session ${clientSessionId}`);
      }
      
      // Thông báo khi staff ngắt kết nối
      if (isStaff) {
        console.log('Staff member disconnected');
      }
    });
  });

  return io;
}

// Hàm tiện ích để broadcast tin nhắn tới một phiên
export function broadcastMessageToSession(sessionId: string, message: any) {
  if (!io) {
    console.error('Socket.IO instance not available for broadcasting');
    return false;
  }
  
  console.log(`Broadcasting message to session ${sessionId}:`, message);
  
  // Gửi tới cả hai room để đảm bảo mọi người đều nhận được
  io.to(sessionId).emit('new-message', message);
  io.to(`chat:${sessionId}`).emit('new-message', message);
  
  return true;
}

// Lấy thể hiện của Socket.IO
export function getSocketServer() {
  return io;
}

// Export io trực tiếp để tương thích với code hiện tại
export { io }; 