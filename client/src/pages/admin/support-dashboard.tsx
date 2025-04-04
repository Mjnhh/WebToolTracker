import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminHeader } from '../../components/AdminHeader';
import { Sidebar } from '../../components/Sidebar';
import { useAuth } from '@/hooks/use-auth';
import axios from 'axios';
import io from 'socket.io-client';
import ChatSupportInterface from '../../components/ChatSupportInterface';

interface ChatSession {
  id: string;
  userId: string | null;
  startedAt: Date;
  lastActivity: Date;
  metadata: any;
  needsHumanSupport?: boolean;
  isHumanAssigned?: boolean;
  assignedTo?: string;
  unreadCount?: number;
}

const SupportDashboard: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [pendingSessions, setPendingSessions] = useState<ChatSession[]>([]);
  const [assignedSessions, setAssignedSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'staff')) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    // Kết nối Socket.IO
    const newSocket = io({
      query: {
        token: localStorage.getItem('token')
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected to server');
      
      // Yêu cầu quyền thông báo nếu chưa có
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
      
      newSocket.emit('join-room', 'support-staff');
    });

    newSocket.on('new-support-request', (session: ChatSession) => {
      console.log('Received new support request:', session);
      
      // Thông báo âm thanh
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Could not play notification sound:', e));
      
      // Hiển thị thông báo trên desktop
      if (Notification.permission === 'granted') {
        new Notification('Yêu cầu hỗ trợ mới', {
          body: `Phiên ${session.id.substring(0, 8)}... cần hỗ trợ`,
          icon: '/favicon.ico'
        });
      }
      
      // Cập nhật danh sách phiên chờ
      setPendingSessions(prev => {
        // Kiểm tra xem session đã tồn tại trong danh sách chưa
        if (!prev.some(s => s.id === session.id)) {
          console.log('Adding new session to pending list:', session.id);
          return [...prev, session];
        }
        return prev;
      });
    });

    newSocket.on('session-updated', (session: ChatSession) => {
      // Cập nhật danh sách phiên chat khi có thay đổi
      if (session.isHumanAssigned && session.assignedTo === user?.id) {
        setAssignedSessions(prev => {
          const exists = prev.find(s => s.id === session.id);
          if (exists) {
            return prev.map(s => s.id === session.id ? session : s);
          } else {
            return [...prev, session];
          }
        });
        setPendingSessions(prev => prev.filter(s => s.id !== session.id));
      } else if (!session.isHumanAssigned) {
        setAssignedSessions(prev => prev.filter(s => s.id !== session.id));
        if (session.needsHumanSupport) {
          setPendingSessions(prev => {
            const exists = prev.find(s => s.id === session.id);
            if (!exists) {
              return [...prev, session];
            }
            return prev.map(s => s.id === session.id ? session : s);
          });
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    // Lấy danh sách phiên chat cần hỗ trợ
    const fetchSupportSessions = async () => {
      try {
        const { data } = await axios.get('/api/support/sessions', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        const pending = data.filter((session: ChatSession) => 
          session.needsHumanSupport && !session.isHumanAssigned
        );
        setPendingSessions(pending);

        const assigned = data.filter((session: ChatSession) => 
          session.isHumanAssigned && session.assignedTo === user?.id
        );
        setAssignedSessions(assigned);
      } catch (error) {
        console.error('Error fetching support sessions:', error);
      }
    };

    if (user && user.role === 'staff') {
      fetchSupportSessions();
    }
  }, [user]);

  const handleAssignSession = async (sessionId: string) => {
    try {
      await axios.post('/api/support/assign', 
        { sessionId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      // Cập nhật UI sau khi gán phiên chat thành công
      const session = pendingSessions.find(s => s.id === sessionId);
      if (session) {
        const updatedSession = {
          ...session,
          isHumanAssigned: true,
          assignedTo: user?.id?.toString()
        };
        
        setAssignedSessions(prev => [...prev, updatedSession]);
        setPendingSessions(prev => prev.filter(s => s.id !== sessionId));
        setSelectedSession(sessionId);
      }
    } catch (error) {
      console.error('Error assigning session:', error);
      alert('Không thể tiếp nhận phiên chat này.');
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await axios.post('/api/support/end', 
        { sessionId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      // Cập nhật UI sau khi kết thúc phiên chat
      setAssignedSessions(prev => prev.filter(s => s.id !== sessionId));
      if (selectedSession === sessionId) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Không thể kết thúc phiên chat này.');
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-container">
      <Sidebar />
      <div className="admin-content">
        <AdminHeader title="Hỗ Trợ Trực Tuyến" onMobileMenuToggle={() => {}} />
        
        <div className="support-dashboard">
          <div className="support-sessions">
            <div className="sessions-container">
              <h3>Đang chờ hỗ trợ ({pendingSessions.length})</h3>
              <div className="session-list">
                {pendingSessions.map(session => (
                  <div 
                    key={session.id}
                    className="session-item pending"
                    onClick={() => handleAssignSession(session.id)}
                  >
                    <div className="session-info">
                      <span className="session-id">ID: {session.id.substring(0, 8)}...</span>
                      <span className="session-time">
                        {new Date(session.lastActivity).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="session-metadata">
                      {session.metadata?.lastIntent && (
                        <span className="intent-badge">{session.metadata.lastIntent}</span>
                      )}
                      <button className="assign-btn">Tiếp nhận</button>
                    </div>
                  </div>
                ))}
                {pendingSessions.length === 0 && (
                  <div className="empty-state">Không có phiên chat nào đang chờ</div>
                )}
              </div>
              
              <h3>Đang hỗ trợ ({assignedSessions.length})</h3>
              <div className="session-list">
                {assignedSessions.map(session => (
                  <div 
                    key={session.id}
                    className={`session-item assigned ${selectedSession === session.id ? 'active' : ''}`}
                    onClick={() => setSelectedSession(session.id)}
                  >
                    <div className="session-info">
                      <span className="session-id">ID: {session.id.substring(0, 8)}...</span>
                      <span className="session-time">
                        {new Date(session.lastActivity).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="session-actions">
                      {session.unreadCount && session.unreadCount > 0 && (
                        <span className="unread-badge">{session.unreadCount}</span>
                      )}
                      <button 
                        className="end-session-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEndSession(session.id);
                        }}
                      >
                        Kết thúc
                      </button>
                    </div>
                  </div>
                ))}
                {assignedSessions.length === 0 && (
                  <div className="empty-state">Không có phiên chat nào đang hỗ trợ</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="chat-interface">
            {selectedSession ? (
              <ChatSupportInterface 
                sessionId={selectedSession}
                socket={socket}
                onEndSession={() => handleEndSession(selectedSession)}
              />
            ) : (
              <div className="empty-chat">
                <div className="empty-chat-message">
                  <h3>Chọn một phiên chat để bắt đầu hỗ trợ</h3>
                  <p>Hoặc tiếp nhận một phiên chat mới từ danh sách bên trái</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportDashboard; 