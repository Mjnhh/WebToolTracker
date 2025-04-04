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
    },
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });
  
  // Xử lý sự kiện kết nối
  socket.on('connect', () => {
    console.log('Socket connected with session ID:', chatSessionId);
    
    // Tham gia phòng chat với sessionId
    socket.emit('join-room', chatSessionId);
    
    // Thêm tham gia vào phòng chat:sessionId
    socket.emit('join-room', `chat:${chatSessionId}`);
    
    // Thông báo đã kết nối
    console.log(`Client joined rooms: ${chatSessionId} and chat:${chatSessionId}`);
    
    // Thiết lập ping định kỳ để duy trì kết nối socket
    startPingInterval();
  });
  
  // Xử lý tin nhắn mới
  socket.on('new-message', (message) => {
    // Thêm thời gian nhận để debug
    const receiveTime = new Date().toISOString();
    console.log(`New message received at ${receiveTime}:`, message);
    
    // Log chi tiết hơn để debug
    console.log(`Message details - ID: ${message.id}, Sender: ${message.sender}, Content: "${message.content}"`);
    
    // Kiểm tra xem tin nhắn đã được hiển thị chưa
    const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
    if (existingMessage) {
      console.log(`Duplicate message found in DOM, ignoring: ${message.id}`);
      return;
    }
    
    const isDuplicate = messages.some(m => m.id === message.id);
    if (isDuplicate) {
      console.log('Duplicate message in array, ignoring:', message.id);
      return;
    }
    
    // Kiểm tra đặc biệt cho tin nhắn từ staff
    if (message.sender === 'staff') {
      console.log('Staff message received, ensuring it gets displayed');
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
    
    // Phát tiếng thông báo khi có tin nhắn mới từ staff
    if (message.sender === 'staff') {
      playNotificationSound();
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

  // Xử lý mất kết nối
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${reason}`);
    
    // Hiển thị thông báo mất kết nối cho người dùng
    const disconnectMessage = {
      id: 'system-' + Date.now(),
      content: 'Mất kết nối với máy chủ. Đang thử kết nối lại...',
      sender: 'system',
      timestamp: new Date().toISOString()
    };
    
    appendMessage(disconnectMessage);
    
    // Dừng ping interval khi mất kết nối
    stopPingInterval();
    
    // Tự động thử kết nối lại
    setTimeout(() => {
      if (!socket.connected) {
        console.log('Attempting to reconnect automatically...');
        connectSocket(chatSessionId);
      }
    }, 5000);
  });
  
  // Xử lý các sự kiện khác
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    // Thử kết nối lại sau 5 giây
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      socket.connect();
    }, 5000);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`Socket reconnected after ${attemptNumber} attempts`);
    
    // Thông báo kết nối lại thành công
    const reconnectMessage = {
      id: 'system-' + Date.now(),
      content: 'Đã kết nối lại thành công!',
      sender: 'system',
      timestamp: new Date().toISOString()
    };
    
    appendMessage(reconnectMessage);
    
    // Tham gia lại phòng chat sau khi kết nối lại
    socket.emit('join-room', chatSessionId);
    socket.emit('join-room', `chat:${chatSessionId}`);
    
    // Tải lại tin nhắn để đảm bảo không bỏ lỡ tin nhắn nào
    fetchMessages(chatSessionId);
    
    // Bắt đầu lại ping interval
    startPingInterval();
  });
  
  // Ping để đảm bảo kết nối vẫn hoạt động
  socket.on('pong', () => {
    console.log('Received pong from server, connection is alive');
    updateConnectionStatus(true);
  });
}

// Biến lưu trữ interval ID
let pingIntervalId = null;

// Bắt đầu gửi ping định kỳ để duy trì kết nối
function startPingInterval() {
  // Dừng interval cũ nếu có
  stopPingInterval();
  
  // Tạo interval mới, ping mỗi 30 giây
  pingIntervalId = setInterval(() => {
    if (socket && socket.connected) {
      console.log('Sending ping to server...');
      socket.emit('ping', { timestamp: Date.now() });
      
      // Tự động tải lại tin nhắn mỗi lần ping
      if (sessionId) {
        fetchMessages(sessionId);
      }
    } else {
      console.log('Socket disconnected, stopping ping interval');
      stopPingInterval();
    }
  }, 30000); // 30 giây
  
  console.log('Started ping interval to keep connection alive');
}

// Dừng ping interval
function stopPingInterval() {
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
    console.log('Stopped ping interval');
  }
}

// Cập nhật trạng thái kết nối trên giao diện
function updateConnectionStatus(isConnected) {
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    if (isConnected) {
      statusElement.className = 'connection-status connected';
      statusElement.title = 'Đã kết nối đến máy chủ';
    } else {
      statusElement.className = 'connection-status disconnected';
      statusElement.title = 'Đã mất kết nối với máy chủ';
    }
  }
}

// Phát âm thanh thông báo khi có tin nhắn mới từ nhân viên
function playNotificationSound() {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(error => {
      console.log('Không thể phát âm thanh thông báo:', error);
    });
  } catch (e) {
    console.error('Error playing notification sound:', e);
  }
}

// Tải lại tin nhắn từ server để đảm bảo không bỏ lỡ tin nhắn nào
function fetchMessages(sessionId) {
  if (!sessionId) return;
  
  fetch(`/api/chat/messages/${sessionId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      return response.json();
    })
    .then(data => {
      console.log(`Fetched ${data.length} messages for session ${sessionId}`);
      
      // Thêm tin nhắn mới vào danh sách
      data.forEach(message => {
        // Kiểm tra xem tin nhắn đã tồn tại chưa
        const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
        if (existingMessage) {
          // Tin nhắn đã tồn tại, bỏ qua
          return;
        }
        
        // Kiểm tra xem tin nhắn đã có trong mảng chưa
        const isDuplicate = messages.some(m => m.id === message.id);
        if (isDuplicate) {
          // Tin nhắn đã có trong mảng, bỏ qua
          return;
        }
        
        // Thêm tin nhắn mới
        messages.push(message);
        appendMessage(message);
      });
      
      // Cuộn xuống cuối nếu có tin nhắn mới
      if (data.length > messages.length) {
        scrollToBottom();
      }
    })
    .catch(error => {
      console.error('Error fetching messages:', error);
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

// Khởi tạo chatbot
function initializeChatbot() {
  // Xác định session ID
  sessionId = localStorage.getItem('chat_session_id');
  
  if (!sessionId) {
    // Tạo session ID mới nếu chưa có
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chat_session_id', sessionId);
  }
  
  console.log('Initializing chatbot with session ID:', sessionId);
  
  // Kết nối socket với session ID
  connectSocket(sessionId);
  
  // Tải tin nhắn cũ (nếu có)
  fetchChatHistory();
  
  // Thiết lập sự kiện cho form gửi tin nhắn
  setupEventHandlers();
} 