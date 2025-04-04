// Biến toàn cục
let socket = null;
let sessionId = null;
let messages = [];
let sentMessages = new Set(); // Theo dõi tin nhắn đã gửi

// Khởi tạo khi tải trang
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  setupEventListeners();
});

// Kiểm tra phiên chat hiện tại
function checkSession() {
  // Lấy sessionId từ localStorage hoặc tạo phiên mới
  sessionId = localStorage.getItem('chat_session_id');
  
  if (sessionId) {
    // Kiểm tra xem phiên có tồn tại trên server không
    fetch(`/api/chat/session/${sessionId}`)
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        // Nếu phiên không tồn tại, tạo phiên mới
        throw new Error('Session not found');
      })
      .then(session => {
        console.log('Existing session found:', session);
        initializeChat(sessionId);
      })
      .catch(error => {
        console.log('Error checking session:', error);
        createNewSession();
      });
  } else {
    createNewSession();
  }
}

// Tạo phiên chat mới
function createNewSession() {
  fetch('/api/chat/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: null // Người dùng ẩn danh
    })
  })
  .then(response => response.json())
  .then(session => {
    console.log('New session created:', session);
    sessionId = session.id;
    localStorage.setItem('chat_session_id', sessionId);
    initializeChat(sessionId);
  })
  .catch(error => {
    console.error('Error creating session:', error);
  });
}

// Khởi tạo kết nối chat
function initializeChat(sessionId) {
  // Tải tin nhắn cũ
  loadMessages(sessionId);
  
  // Kết nối socket và xử lý sự kiện
  connectSocket(sessionId);
}

// Tải tin nhắn cũ
function loadMessages(sessionId) {
  fetch(`/api/chat/session/${sessionId}/messages`)
    .then(response => response.json())
    .then(data => {
      messages = data;
      renderMessages(messages);
    })
    .catch(error => {
      console.error('Error loading messages:', error);
    });
}

// Thiết lập các sự kiện
function setupEventListeners() {
  // Gửi tin nhắn khi nhấn nút
  const sendButton = document.getElementById('send-message');
  sendButton.addEventListener('click', () => {
    sendMessage();
  });
  
  // Gửi tin nhắn khi nhấn Enter
  const inputField = document.getElementById('message-input');
  inputField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  
  // Nút mở rộng/thu gọn chat
  const toggleButton = document.getElementById('toggle-chat');
  toggleButton.addEventListener('click', () => {
    toggleChat();
  });
  
  // Nút đóng
  const closeButton = document.getElementById('close-chat');
  closeButton.addEventListener('click', () => {
    hideChat();
  });
}

// Kết nối WebSocket
function connectSocket(chatSessionId) {
  if (socket) {
    // Ngắt kết nối cũ nếu có
    socket.disconnect();
  }
  
  // Kết nối socket.io
  socket = io({
    query: {
      sessionId: chatSessionId
    }
  });
  
  // Xử lý sự kiện kết nối
  socket.on('connect', () => {
    console.log('Socket connected');
    
    // Tham gia phòng chat
    socket.emit('join-room', chatSessionId);
  });
  
  // Xử lý tin nhắn mới
  socket.on('new-message', (message) => {
    console.log('New message received:', message);
    
    // Kiểm tra xem tin nhắn đã được hiển thị chưa
    const isDuplicate = messages.some(m => m.id === message.id);
    if (isDuplicate) {
      console.log('Duplicate message, ignoring:', message.id);
      return;
    }
    
    // Thêm vào danh sách tin nhắn
    messages.push(message);
    
    // Hiển thị tin nhắn mới
    appendMessage(message);
    
    // Cuộn xuống tin nhắn cuối cùng
    scrollToBottom();
    
    // Hiển thị chat nếu là tin nhắn từ bot hoặc nhân viên
    if (message.sender === 'bot' || message.sender === 'staff') {
      showChat();
    }
  });
  
  // Xử lý khi có nhân viên tham gia
  socket.on('support-staff-joined', (data) => {
    console.log('Support staff joined:', data);
    
    // Hiển thị thông báo
    const staffJoinedMessage = {
      id: 'system-' + Date.now(),
      content: `Nhân viên hỗ trợ đã tham gia cuộc trò chuyện.`,
      sender: 'system',
      timestamp: new Date().toISOString()
    };
    
    appendMessage(staffJoinedMessage);
    scrollToBottom();
  });
  
  // Xử lý khi phiên hỗ trợ kết thúc
  socket.on('support-ended', () => {
    console.log('Support session ended');
    
    // Hiển thị thông báo
    const supportEndedMessage = {
      id: 'system-' + Date.now(),
      content: 'Phiên hỗ trợ đã kết thúc. Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.',
      sender: 'system',
      timestamp: new Date().toISOString()
    };
    
    appendMessage(supportEndedMessage);
    scrollToBottom();
  });
  
  // Xử lý lỗi kết nối
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
  
  // Xử lý mất kết nối
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}

// Hiển thị danh sách tin nhắn
function renderMessages(messageList) {
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.innerHTML = '';
  
  messageList.forEach(message => {
    appendMessage(message);
  });
  
  scrollToBottom();
}

// Thêm tin nhắn vào giao diện
function appendMessage(message) {
  const chatMessages = document.getElementById('chat-messages');
  
  // Kiểm tra xem tin nhắn đã hiển thị chưa
  if (message.id && document.querySelector(`[data-message-id="${message.id}"]`)) {
    console.log(`Tin nhắn ${message.id} đã tồn tại trong DOM, bỏ qua`);
    return;
  }
  
  // Tạo phần tử tin nhắn
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  
  // Đặt ID để tránh trùng lặp
  if (message.id) {
    messageElement.setAttribute('data-message-id', message.id);
  }
  
  // Thiết lập class dựa trên người gửi
  if (message.sender === 'user') {
    messageElement.classList.add('user-message');
  } else if (message.sender === 'bot') {
    messageElement.classList.add('bot-message');
  } else if (message.sender === 'staff') {
    messageElement.classList.add('staff-message');
  } else if (message.sender === 'system') {
    messageElement.classList.add('system-message');
  }
  
  // Format nội dung tin nhắn
  let content = message.content;
  
  // Xử lý nội dung đặc biệt (nếu cần)
  if (message.metadata) {
    try {
      const metadata = JSON.parse(message.metadata);
      if (metadata.type === 'quick_replies') {
        content += createQuickReplies(metadata.options);
      }
    } catch (e) {
      console.error('Error parsing message metadata:', e);
    }
  }
  
  // Format thời gian
  let timeDisplay = '';
  if (message.timestamp) {
    const messageTime = new Date(message.timestamp);
    timeDisplay = `<div class="message-time">${messageTime.toLocaleTimeString()}</div>`;
  }
  
  // Hiển thị người gửi cho tin nhắn từ bot/nhân viên
  let senderName = '';
  if (message.sender === 'bot') {
    senderName = '<div class="sender-name">Bot</div>';
  } else if (message.sender === 'staff') {
    senderName = '<div class="sender-name">Nhân viên hỗ trợ</div>';
  }
  
  // Cập nhật nội dung HTML
  messageElement.innerHTML = `
    ${senderName}
    <div class="message-content">${content}</div>
    ${timeDisplay}
  `;
  
  chatMessages.appendChild(messageElement);
}

// Tạo các nút trả lời nhanh
function createQuickReplies(options) {
  if (!options || !Array.isArray(options)) return '';
  
  let buttonsHtml = '<div class="quick-replies">';
  options.forEach(option => {
    buttonsHtml += `<button class="quick-reply-button" data-value="${option.value}">${option.label}</button>`;
  });
  buttonsHtml += '</div>';
  
  // Thêm sự kiện click sau khi hiển thị
  setTimeout(() => {
    document.querySelectorAll('.quick-reply-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const value = e.target.getAttribute('data-value');
        document.getElementById('message-input').value = value;
        sendMessage();
        
        // Xóa các nút sau khi chọn
        document.querySelectorAll('.quick-replies').forEach(el => el.remove());
      });
    });
  }, 100);
  
  return buttonsHtml;
}

// Gửi tin nhắn
function sendMessage() {
  const inputField = document.getElementById('message-input');
  const message = inputField.value.trim();
  
  if (!message || !sessionId) return;
  
  // Kiểm tra tin nhắn trùng lặp bằng content và timestamp
  const messageKey = `${message}-${Date.now()}`;
  if (sentMessages.has(messageKey)) {
    console.log('Duplicate message detected, ignoring send request');
    return;
  }
  
  // Đánh dấu tin nhắn đã gửi
  sentMessages.add(messageKey);
  
  // Xóa tin nhắn đã gửi cũ trong Set để tránh Set quá lớn
  if (sentMessages.size > 20) {
    const oldestKey = Array.from(sentMessages)[0];
    sentMessages.delete(oldestKey);
  }
  
  // Hiển thị tin nhắn ngay lập tức trước khi gửi đi server
  const tempMessage = {
    id: 'temp-' + Date.now(),
    content: message,
    sender: 'user',
    timestamp: new Date().toISOString()
  };
  
  // Thêm vào giao diện
  appendMessage(tempMessage);
  scrollToBottom();
  
  // Xóa nội dung input
  inputField.value = '';
  
  // Gửi qua socket
  socket.emit('send-message', {
    sessionId: sessionId,
    message: message, 
    sender: 'user'
  });
}

// Cuộn xuống tin nhắn cuối cùng
function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Hiển thị chat
function showChat() {
  const chatWidget = document.getElementById('chat-widget');
  chatWidget.classList.remove('collapsed');
  chatWidget.classList.add('expanded');
}

// Ẩn chat
function hideChat() {
  const chatWidget = document.getElementById('chat-widget');
  chatWidget.classList.remove('expanded');
  chatWidget.classList.add('collapsed');
}

// Chuyển đổi trạng thái hiển thị
function toggleChat() {
  const chatWidget = document.getElementById('chat-widget');
  if (chatWidget.classList.contains('collapsed')) {
    showChat();
  } else {
    hideChat();
  }
} 