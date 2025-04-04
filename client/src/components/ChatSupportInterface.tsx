import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

interface Message {
  id: number;
  sessionId: string;
  content: string;
  sender: string;
  timestamp: Date;
  metadata?: any;
}

interface ChatSupportInterfaceProps {
  sessionId: string;
  socket: any;
  onEndSession: () => void;
}

const ChatSupportInterface: React.FC<ChatSupportInterfaceProps> = ({ 
  sessionId, 
  socket,
  onEndSession
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Lấy lịch sử tin nhắn khi component mount hoặc sessionId thay đổi
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        // Lấy tin nhắn từ API
        const { data } = await axios.get(`/api/chat/session/${sessionId}/messages`);
        setMessages(data);
        
        // Lấy thông tin session
        const sessionResponse = await axios.get(`/api/chat/session/${sessionId}`);
        setSessionInfo(sessionResponse.data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    if (sessionId) {
      fetchMessages();
    }
  }, [sessionId]);

  // Xử lý tin nhắn mới từ socket
  useEffect(() => {
    const handleNewMessage = (data: Message) => {
      if (data.sessionId === sessionId) {
        // Kiểm tra xem tin nhắn đã tồn tại chưa
        setMessages(prev => {
          const messageExists = prev.some(msg => msg.id === data.id);
          if (messageExists) {
            return prev;
          }
          return [...prev, data];
        });
      }
    };

    socket.on('new-message', handleNewMessage);

    // Tham gia phòng chat của phiên này
    socket.emit('join-chat', { sessionId });

    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, sessionId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await axios.post('/api/support/message', { 
        sessionId,
        content: newMessage 
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-support-container">
      <div className="chat-header">
        <div className="chat-session-info">
          <h3>Phiên chat #{sessionId.substring(0, 8)}</h3>
          {sessionInfo && (
            <div className="user-info">
              <span>Bắt đầu: {new Date(sessionInfo.startedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
        <button className="end-session-button" onClick={onEndSession}>
          Kết thúc phiên hỗ trợ
        </button>
      </div>
      
      <div className="chat-messages">
        {messages.map(message => (
          <div 
            key={message.id}
            className={`message ${message.sender === 'staff' ? 'staff' : 'user'}`}
          >
            <div className="message-content">{message.content}</div>
            <div className="message-info">
              <span className="message-sender">
                {message.sender === 'staff' ? 'Nhân viên' : 
                 message.sender === 'bot' ? 'Chatbot' : 'Khách hàng'}
              </span>
              <span className="message-time">{formatTimestamp(message.timestamp)}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Nhập tin nhắn..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit" disabled={!newMessage.trim()}>
          Gửi
        </button>
      </form>
    </div>
  );
};

export default ChatSupportInterface; 