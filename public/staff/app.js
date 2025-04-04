// Biến và cấu hình toàn cục
let currentUser = null;
let currentSessionId = null;
let socket = null;
let sessionList = [];
let activeSessions = [];
let notificationSound = null;
let notificationEnabled = true;
let browserNotificationEnabled = false;
let receivedMessageIds = new Set();
const API_BASE_URL = '/api';
let isSendingMessage = false; // Biến trạng thái để ngăn chặn gửi nhiều lần

// Khởi tạo âm thanh thông báo
function initializeNotificationSound() {
  // Khởi tạo âm thanh thông báo
  notificationSound = new Audio('/sounds/notification.mp3');
  
  // Tạo fallback nếu file không tồn tại
  notificationSound.onerror = function() {
    console.log('Âm thanh thông báo không tồn tại, tạo âm thanh dự phòng');
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 800;
    oscillator.connect(audioContext.destination);
    
    // Chỉ phát trong 200ms
    oscillator.start();
    setTimeout(function() {
      oscillator.stop();
    }, 200);
  };
}

// Khởi tạo thông báo trình duyệt
function initializeNotifications() {
  // Kiểm tra hỗ trợ
  if (!("Notification" in window)) {
    console.log("Trình duyệt này không hỗ trợ thông báo");
    return;
  }
  
  // Yêu cầu quyền
  if (Notification.permission !== "denied") {
    Notification.requestPermission().then(function(permission) {
      if (permission === "granted") {
        browserNotificationEnabled = true;
        console.log("Đã bật thông báo trình duyệt");
      }
    });
  }
}

// Gửi thông báo
function sendNotification(title, message) {
  // Phát âm thanh nếu được bật
  if (notificationEnabled && notificationSound) {
    notificationSound.play().catch(error => {
      console.log('Không thể phát âm thanh thông báo:', error);
    });
  }
  
  // Gửi thông báo trình duyệt nếu được bật và có quyền
  if (browserNotificationEnabled && Notification.permission === "granted") {
    // Chỉ hiển thị thông báo nếu trang không ở trạng thái focus
    if (!document.hasFocus()) {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico'
      });
      
      // Tự động đóng sau 5 giây
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      // Khi người dùng click vào thông báo
      notification.onclick = function() {
        window.focus();
        this.close();
      };
    }
  }
}

// Khởi tạo kết nối socket
function initializeSocket() {
  const token = localStorage.getItem('auth_token');
  if (!token) return;

  socket = io({
    query: { token }
  });

  socket.on('connect', () => {
    console.log('Socket connected successfully');
    socket.emit('join-room', 'support-staff');
    // Cập nhật trạng thái online cho giao diện
    updateConnectionStatus(true);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    // Cập nhật trạng thái offline cho giao diện
    updateConnectionStatus(false);
  });

  socket.on('new-support-request', (session) => {
    console.log('Received new support request:', session);
    // Thêm session mới vào danh sách
    if (!sessionList.some(s => s.id === session.id)) {
      sessionList.push(session);
      updateSessionsList();
      // Gửi thông báo có phiên chat mới
      sendNotification('Yêu cầu hỗ trợ mới', `Phiên ${session.id} đang cần hỗ trợ`);
    }
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    // Cập nhật trạng thái offline cho giao diện
    updateConnectionStatus(false);
  });
  
  // Theo dõi trạng thái người dùng
  socket.on('user-status-change', (data) => {
    console.log('User status changed:', data);
    updateUserStatus(data.sessionId, data.status);
  });
}

// Cập nhật trạng thái kết nối
function updateConnectionStatus(isConnected) {
  const statusIndicator = document.getElementById('connection-status');
  if (!statusIndicator) return;
  
  if (isConnected) {
    statusIndicator.className = 'status-indicator online';
    statusIndicator.title = 'Đang kết nối';
  } else {
    statusIndicator.className = 'status-indicator offline';
    statusIndicator.title = 'Mất kết nối';
  }
}

// Cập nhật trạng thái người dùng
function updateUserStatus(sessionId, status) {
  // Cập nhật trong danh sách phiên
  const sessionItem = document.querySelector(`.session-item[data-session-id="${sessionId}"]`);
  if (sessionItem) {
    const statusIndicator = sessionItem.querySelector('.user-status');
    if (statusIndicator) {
      statusIndicator.className = `user-status ${status}`;
      statusIndicator.title = status === 'online' ? 'Đang trực tuyến' : 'Ngoại tuyến';
    }
  }
  
  // Cập nhật trong phiên đang mở
  if (currentSessionId === sessionId) {
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader) {
      const headerStatus = chatHeader.querySelector('.user-status');
      if (headerStatus) {
        headerStatus.className = `user-status ${status}`;
        headerStatus.title = status === 'online' ? 'Đang trực tuyến' : 'Ngoại tuyến';
      }
    }
  }
}

// Hàm khởi tạo khi tải xong trang
document.addEventListener('DOMContentLoaded', () => {
  // Khởi tạo âm thanh và thông báo
  initializeNotificationSound();
  initializeNotifications();
  
  // Kiểm tra đăng nhập
  checkLoginStatus();

  // Thiết lập sự kiện
  setupEventListeners();
});

// Kiểm tra trạng thái đăng nhập
function checkLoginStatus() {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    showLoginForm();
    return;
  }

  // Xác thực token
  fetch('/api/auth/verify', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Token không hợp lệ');
    }
    return response.json();
  })
  .then(userData => {
    currentUser = userData;

    // Kiểm tra quyền truy cập
    if (userData.role !== 'staff' && userData.role !== 'admin') {
      localStorage.removeItem('auth_token'); // Xóa token
      alert('Bạn không có quyền truy cập trang này. Chỉ nhân viên hỗ trợ và quản trị viên mới được phép truy cập.');
      window.location.href = '/'; // Chuyển về trang chủ
      return;
    }

    hideLoginForm();
    initializeStaffInterface();
    
    // Hiển thị tên và vai trò
    const staffName = document.getElementById('staff-name');
    if (staffName) {
      staffName.textContent = `${userData.name} (${userData.role})`;
    }
  })
  .catch(error => {
    console.error('Authentication error:', error);
    localStorage.removeItem('auth_token');
    showLoginForm();
  });
}

// Hiển thị form đăng nhập
function showLoginForm() {
  const loginOverlay = document.getElementById('login-overlay');
  if (loginOverlay) loginOverlay.style.display = 'flex';
}

// Ẩn form đăng nhập
function hideLoginForm() {
  const loginOverlay = document.getElementById('login-overlay');
  if (loginOverlay) loginOverlay.style.display = 'none';
}

// Thiết lập các sự kiện
function setupEventListeners() {
  // Sự kiện đăng nhập
  const loginSubmit = document.getElementById('login-submit');
  if (loginSubmit) {
    loginSubmit.addEventListener('click', handleLogin);
  }

  // Sự kiện đăng xuất
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Lọc phiên chat
  const sessionFilter = document.getElementById('session-filter');
  if (sessionFilter) {
    sessionFilter.addEventListener('change', filterSessions);
  }

  // Gửi tin nhắn
  const sendMessageBtn = document.getElementById('send-message-btn');
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', sendMessage);
  }

  // Enter để gửi tin nhắn
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  // Kết thúc phiên
  const endSessionBtn = document.getElementById('end-session-btn');
  if (endSessionBtn) {
    endSessionBtn.addEventListener('click', endSession);
  }

  // Trả lời nhanh
  const quickResponses = document.querySelectorAll('.quick-response-item');
  if (quickResponses) {
    quickResponses.forEach(item => {
      item.addEventListener('click', () => insertQuickResponse(item.textContent));
    });
  }

  // Mẫu trả lời
  const templateBtns = document.querySelectorAll('.template-btn');
  if (templateBtns) {
    templateBtns.forEach(btn => {
      btn.addEventListener('click', () => insertTemplate(btn.dataset.template));
    });
  }

  // Bật/tắt thông báo âm thanh
  const notificationToggle = document.getElementById('notification-toggle');
  if (notificationToggle) {
    // Khởi tạo trạng thái ban đầu
    notificationToggle.checked = notificationEnabled;
    
    notificationToggle.addEventListener('change', function() {
      notificationEnabled = this.checked;
      localStorage.setItem('notification_enabled', notificationEnabled);
      
      if (notificationEnabled) {
        // Yêu cầu quyền thông báo nếu cần
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          Notification.requestPermission().then(function(permission) {
            browserNotificationEnabled = permission === 'granted';
          });
        }
        showNotification('Thông báo đã được bật');
      } else {
        console.log('Thông báo đã tắt');
      }
    });
  }
}

// Xử lý đăng nhập
function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorElement = document.getElementById('login-error');

  if (!username || !password) {
    if (errorElement) errorElement.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu';
    return;
  }

  // Gọi API đăng nhập - sửa đường dẫn đúng
  fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Login failed');
  })
  .then(data => {
    // Kiểm tra quyền
    if (data.user && (data.user.role !== 'staff' && data.user.role !== 'admin')) {
      if (errorElement) errorElement.textContent = 'Tài khoản không có quyền truy cập';
      throw new Error('No permission');
    }

    // Lưu token JWT
    localStorage.setItem('auth_token', data.token);
    currentUser = data.user;

    // Chuyển sang giao diện nhân viên
    hideLoginForm();
    initializeStaffInterface();
  })
  .catch(error => {
    console.error('Login error:', error);
    if (errorElement) errorElement.textContent = 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin đăng nhập.';
  });
}

// Xử lý đăng xuất
function handleLogout() {
  // Xóa token JWT khỏi localStorage
  localStorage.removeItem('auth_token');
  currentUser = null;

  // Ngắt kết nối socket nếu có
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  // Quay lại trang đăng nhập
  showLoginForm();
}

// Khởi tạo giao diện nhân viên
function initializeStaffInterface() {
  // Khôi phục trạng thái thông báo từ localStorage
  const savedNotificationState = localStorage.getItem('notification_enabled');
  if (savedNotificationState !== null) {
    notificationEnabled = savedNotificationState === 'true';
    const notificationToggle = document.getElementById('notification-toggle');
    if (notificationToggle) {
      notificationToggle.checked = notificationEnabled;
    }
  }

  // Khởi tạo kết nối socket
  initializeSocket();

  // Tải danh sách phiên chat
  fetchSupportSessions();
  
  // Hiển thị tên nhân viên
  const staffNameElement = document.getElementById('staff-name');
  if (staffNameElement) staffNameElement.textContent = currentUser.name || currentUser.username;

  // Kết nối socket
  connectSocket();

  // Tải danh sách phiên hỗ trợ
  fetchSupportSessions();
}

// Kết nối WebSocket
function connectSocket() {
  if (socket) {
    socket.disconnect();
  }

  // Lấy token xác thực
  const token = localStorage.getItem('auth_token');

  // Kết nối socket với xác thực
  socket = io({
    auth: {
      token: token
    },
    query: {
      type: 'staff'
    }
  });

  // Tham gia kênh hỗ trợ
  socket.on('connect', () => {
    console.log('Socket connected to server');
    socket.emit('join-room', 'support-staff');

    // Khi chuyển phiên chat, tham gia phòng mới
    if (currentSessionId) {
      socket.emit('join-chat', { sessionId: currentSessionId });
    }
  });

  // Sự kiện nhận tin nhắn mới
  socket.on('new-message', message => {
    console.log('Received new message via socket:', message);

    // Bỏ qua tin nhắn không hợp lệ
    if (!message || !message.id) {
      console.log('Tin nhắn không hợp lệ, bỏ qua');
      return;
    }

    // Kiểm tra chặt chẽ hơn - thêm kiểm tra sessionId
    if (!message.sessionId || message.sessionId !== currentSessionId) {
      console.log(`Tin nhắn không thuộc phiên hiện tại hoặc không có sessionId, bỏ qua`);
      if (message.sessionId !== currentSessionId) {
        // Vẫn cập nhật danh sách phiên nếu có tin nhắn mới từ phiên khác
        updateSessionWithNewMessage(message);
      }
      return;
    }
    // Khai báo một Set để lưu trữ mốc thời gian của các tin nhắn đã hiển thị
const displayedMessageTimestamps = new Set();

// Hàm xử lý tin nhắn mới
function handleNewMessage(message) {
    const messageTimestamp = message.timestamp; // Giả sử message có thuộc tính timestamp

    // Kiểm tra xem mốc thời gian đã hiển thị chưa
    if (!displayedMessageTimestamps.has(messageTimestamp)) {
        // Nếu chưa, hiển thị tin nhắn và thêm mốc thời gian vào Set
        renderMessage(message);
        displayedMessageTimestamps.add(messageTimestamp);
    }
}
    // Kiểm tra xem tin nhắn đã được xử lý chưa (sử dụng cả ID và timestamp)
    const messageIdentifier = `${message.id}-${message.timestamp || Date.now()}`;
    if (receivedMessageIds.has(messageIdentifier) || receivedMessageIds.has(message.id)) {
      console.log(`Tin nhắn trùng lặp với identifier ${messageIdentifier}, bỏ qua`);
      return;
    }

    // Kiểm tra thêm xem tin nhắn đã tồn tại trong DOM chưa
    const existingMessage = document.querySelector(`.message-item[data-message-id="${message.id}"]`);
    if (existingMessage) {
      console.log(`Tin nhắn ${message.id} đã tồn tại trong DOM, bỏ qua`);
      return;
    }

    // Kiểm tra xem tin nhắn có phải tin nhắn tạm thời không (gửi từ chính nhân viên này)
    // Tin nhắn tạm thường có ID bắt đầu bằng "temp-"
    if (message.sender === 'staff' && document.querySelector(`.message-item[data-message-id^="temp-"][data-temp-ref="${message.id}"]`)) {
      console.log(`Tin nhắn ${message.id} là phiên bản chính thức của tin nhắn tạm, bỏ qua`);
      return;
    }

    // Thêm identifier vào danh sách đã xử lý
    receivedMessageIds.add(messageIdentifier);
    receivedMessageIds.add(message.id);

    // Giới hạn kích thước của Set để tránh tiêu thụ quá nhiều bộ nhớ
    if (receivedMessageIds.size > 100) {
      const idsArray = Array.from(receivedMessageIds);
      for (let i = 0; i < idsArray.length - 100; i++) {
        receivedMessageIds.delete(idsArray[i]);
      }
    }

    // Thêm tin nhắn và cuộn xuống
    appendMessage(message);
    scrollToBottom();
  });

  // Sự kiện có phiên yêu cầu hỗ trợ mới
  socket.on('session-needs-support', session => {
    fetchSupportSessions();

    // Hiển thị thông báo
    showNotification(`Phiên ${session.id} cần hỗ trợ`);
  });
}

// Tải danh sách phiên hỗ trợ
function fetchSupportSessions() {
  const token = localStorage.getItem('auth_token');

  fetch(`${API_BASE_URL}/support/sessions`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to fetch sessions');
  })
  .then(data => {
    console.log('Received sessions:', data); // Log để debug
    sessionList = data;
    
    // Lọc các phiên không hợp lệ
    sessionList = sessionList.filter(session => session && session.id);
    
    if (sessionList.length === 0) {
      const sessionsContainer = document.getElementById('sessions-list');
      if (sessionsContainer) {
        sessionsContainer.innerHTML = '<div class="empty-message">Chưa có phiên hỗ trợ nào</div>';
      }
    } else {
      renderSessionList(sessionList);
    }
  })
  .catch(error => {
    console.error('Error fetching sessions:', error);
    const sessionsContainer = document.getElementById('sessions-list');
    if (sessionsContainer) {
      sessionsContainer.innerHTML = '<div class="error-message">Không thể tải danh sách phiên</div>';
    }
  });

  // Tự động cập nhật sau mỗi 30 giây
  setTimeout(fetchSupportSessions, 30000);
}

// Hiển thị danh sách phiên
function renderSessionList(sessions) {
  const sessionContainer = document.getElementById('sessions-list');
  if (sessionContainer) sessionContainer.innerHTML = '';

  if (sessions.length === 0) {
    if (sessionContainer) sessionContainer.innerHTML = '<div class="empty-message">Không có phiên hỗ trợ nào</div>';
    return;
  }

  sessions.forEach(session => {
    // Tạo phần tử hiển thị phiên
    const sessionItem = document.createElement('div');
    sessionItem.className = 'session-item';
    sessionItem.dataset.sessionId = session.id;

    // Thêm class active nếu là phiên hiện tại
    if (session.id === currentSessionId) {
      sessionItem.classList.add('active');
    }

    // Xác định trạng thái phiên
    let statusBadge = '';
    if (session.isHumanAssigned && session.assignedTo === currentUser.id) {
      statusBadge = '<span class="status-badge mine">Của tôi</span>';
    } else if (session.isHumanAssigned) {
      statusBadge = '<span class="status-badge active">Đang xử lý</span>';
    } else if (session.needsHumanSupport) {
      statusBadge = '<span class="status-badge waiting">Chờ hỗ trợ</span>';
    }

    // Định dạng thời gian
    const sessionTime = formatTime(new Date(session.updatedAt || session.createdAt));

    // Lấy tin nhắn cuối cùng nếu có
    let lastMessage = 'Chưa có tin nhắn';
    if (session.lastMessage) {
      lastMessage = session.lastMessage.content;
    }

    // Hiển thị thông tin phiên
    sessionItem.innerHTML = `
      <div class="user-name">
        Phiên ${session.id.substr(0, 8)}... ${statusBadge}
      </div>
      <div class="last-message">${lastMessage}</div>
      <div class="session-time">${sessionTime}</div>
    `;

    // Sự kiện khi click vào phiên
    sessionItem.addEventListener('click', () => selectSession(session.id));

    if (sessionContainer) sessionContainer.appendChild(sessionItem);
  });
}

// Lọc danh sách phiên
function filterSessions() {
  const filterValue = document.getElementById('session-filter').value;
  let filteredSessions = sessionList;

  // Lọc theo trạng thái
  switch (filterValue) {
    case 'waiting':
      filteredSessions = sessionList.filter(session => 
        session.needsHumanSupport && !session.isHumanAssigned
      );
      break;
    case 'active':
      filteredSessions = sessionList.filter(session => 
        session.isHumanAssigned
      );
      break;
    case 'my':
      filteredSessions = sessionList.filter(session => 
        session.assignedTo === currentUser.id
      );
      break;
  }

  renderSessionList(filteredSessions);
}

// Chọn phiên hỗ trợ
function selectSession(sessionId) {
  currentSessionId = sessionId;

  // Đánh dấu phiên đang chọn
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.sessionId === sessionId) {
      item.classList.add('active');
    }
  });

  // Ẩn thông báo chưa chọn phiên
  const noSessionSelected = document.querySelector('.no-chat-selected');
  if (noSessionSelected) {
    noSessionSelected.style.display = 'none';
  }

  // Hiển thị giao diện chat
  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    chatContainer.innerHTML = `
      <div class="chat-header">
        <div class="user-name">Phiên ${sessionId.substr(0, 8)}...</div>
        <button onclick="endSession()" class="end-session-btn">Kết thúc</button>
      </div>
      <div id="chat-messages" class="chat-messages"></div>
      <div class="chat-input-form">
        <input type="text" id="chat-input" placeholder="Nhập tin nhắn...">
        <button onclick="sendMessage()">Gửi</button>
      </div>
    `;
  }


  // Kết nối socket với phiên hiện tại
  joinChatSession(sessionId);

  // Kiểm tra và tiếp nhận phiên nếu cần
  const selectedSession = sessionList.find(session => session.id === sessionId);

  if (selectedSession && selectedSession.needsHumanSupport && !selectedSession.isHumanAssigned) {
    // Phiên cần hỗ trợ và chưa được tiếp nhận, tiếp nhận trước rồi mới tải tin nhắn
    assignSession(sessionId)
      .then(() => {
        // Sau khi tiếp nhận thành công, tải tin nhắn
        fetchSessionMessages(sessionId);
      })
      .catch(error => {
        console.error('Failed to assign session:', error);
        // Vẫn thử tải tin nhắn ngay cả khi không tiếp nhận được
        fetchSessionMessages(sessionId);
      });
  } else {
    // Phiên đã được tiếp nhận, tải tin nhắn ngay
    fetchSessionMessages(sessionId);
  }
}

// Tham gia vào phiên chat qua socket
function joinChatSession(sessionId) {
  if (socket) {
    // Tham gia vào room với sessionId
    socket.emit('join-room', sessionId);
    socket.emit('join-chat', { sessionId: sessionId });

    console.log(`Joined chat session: ${sessionId}`);
  }
}

// Tải tin nhắn của phiên
function fetchSessionMessages(sessionId) {
  // Kiểm tra nếu đang gọi API để tránh gọi nhiều lần
  if (fetchSessionMessages.isFetching) {
    console.log('Đang tải tin nhắn, bỏ qua yêu cầu trùng lặp');
    return;
  }

  fetchSessionMessages.isFetching = true;

  const messagesContainer = document.getElementById('chat-messages');
  if (messagesContainer) messagesContainer.innerHTML = '<div class="loading-messages">Đang tải tin nhắn...</div>';

  const token = localStorage.getItem('auth_token');

  fetch(`${API_BASE_URL}/support/messages/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to fetch messages');
  })
  .then(data => {
    console.log(`Received ${data.length} messages for session ${sessionId}`);

    // Xóa thông báo đang tải
    if (messagesContainer) messagesContainer.innerHTML = '';

    // Hiển thị tin nhắn
    if (data.length === 0) {
      if (messagesContainer) messagesContainer.innerHTML = '<div class="empty-message">Chưa có tin nhắn trong phiên này</div>';
    } else {
      // Sắp xếp tin nhắn theo thời gian (đảm bảo hiển thị đúng thứ tự)
      data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Đặt lại receivedMessageIds để tránh trùng lặp khi chuyển phiên
      receivedMessageIds = new Set();

      renderMessages(data);

      // Cuộn xuống tin nhắn mới nhất
      scrollToBottom();
    }

    // Cập nhật trạng thái phiên
    markSessionAsRead(sessionId);
  })
  .catch(error => {
    console.error('Error fetching messages:', error);
    if (messagesContainer) messagesContainer.innerHTML = '<div class="error-message">Lỗi khi tải tin nhắn</div>';
  })
  .finally(() => {
    // Đánh dấu là đã hoàn thành gọi API
    fetchSessionMessages.isFetching = false;
  });
}

// Đánh dấu phiên đã đọc - API chưa hỗ trợ nhưng chuẩn bị cho tương lai
function markSessionAsRead(sessionId) {
  console.log(`Marking session ${sessionId} as read`);
  // Đây là hàm chuẩn bị cho tương lai
  // Sẽ được triển khai khi API hỗ trợ
}

// Tiếp nhận phiên hỗ trợ
function assignSession(sessionId) {
  if (!sessionId) return Promise.reject(new Error('Session ID is required'));

  const token = localStorage.getItem('auth_token');

  // Trả về Promise để có thể xử lý tiếp theo
  return fetch(`${API_BASE_URL}/support/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to assign session');
  })
  .then(data => {
    console.log('Phiên đã được tiếp nhận thành công:', data);
    // Cập nhật UI
    fetchSupportSessions();

    // Hiển thị thông báo đã tiếp nhận
    const successMessage = {
      id: 'system-' + Date.now(),
      sessionId: sessionId,
      sender: 'system',
      content: 'Bạn đã tiếp nhận phiên hỗ trợ này.',
      timestamp: new Date().toISOString()
    };
    appendMessage(successMessage);

    return data;
  })
  .catch(error => {
    console.error('Error assigning session:', error);
    throw error; // Chuyển tiếp lỗi để xử lý ở nơi gọi hàm
  });
}

// Hiển thị tin nhắn
function renderMessages(messages) {
  const messagesContainer = document.getElementById('chat-messages');
  if (messagesContainer) {
    // Tạo một Set để lưu trữ ID tin nhắn đã hiển thị
    const displayedMessageIds = new Set();

    // Lấy tất cả ID tin nhắn đã hiển thị trên UI
    document.querySelectorAll('.message-item').forEach(el => {
      if (el.dataset.messageId) {
        displayedMessageIds.add(el.dataset.messageId);
        console.log(`Phát hiện tin nhắn đã hiển thị: ${el.dataset.messageId}`);
      }
    });

    // Tạo bản đồ để theo dõi tin nhắn đã thêm trong lần render này
    const newMessageMap = new Map();

    // Lọc tin nhắn trùng lặp trong danh sách từ API trước khi hiển thị
    const uniqueMessages = messages.filter((message, index, self) => {
      if (!message || !message.id) return false;

      // Kiểm tra xem tin nhắn này đã tồn tại trong danh sách tin nhắn API không
      const isDuplicate = self.findIndex(m => m && m.id === message.id) !== index;
      if (isDuplicate) {
        console.log(`Tin nhắn trùng lặp từ API: ${message.id} - "${message.content}"`);
        return false;
      }

      return true;
    });

    console.log(`Có ${messages.length} tin nhắn từ API, sau khi lọc còn ${uniqueMessages.length} tin nhắn duy nhất`);

    // Không xóa tin nhắn hiện tại, chỉ thêm tin nhắn mới và tránh trùng lặp
    uniqueMessages.forEach(message => {
      // Kiểm tra xem tin nhắn đã tồn tại trên UI chưa
      if (message && message.id && typeof message.id === 'string') {
        // Đã xử lý tin nhắn này trước đó hoặc đã thêm trong lần render này
        if (displayedMessageIds.has(message.id) || newMessageMap.has(message.id)) {
          console.log(`Tin nhắn có ID ${message.id} đã tồn tại, bỏ qua`);
          return; // Bỏ qua nếu tin nhắn đã tồn tại
        }

        // Thêm ID vào danh sách đã xử lý và bản đồ tin nhắn mới
        displayedMessageIds.add(message.id);
        newMessageMap.set(message.id, message);
        appendMessage(message);
      } else {
        // Tin nhắn không có ID, vẫn thêm vào
        appendMessage(message);
      }
    });
  }
}

// Thêm tin nhắn vào khung chat
function appendMessage(message) {
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        // Kiểm tra xem tin nhắn đã tồn tại chưa
        if (message.id && typeof message.id === 'string') {
            const existingMessage = document.querySelector(`.message-item[data-message-id="${message.id}"]`);
            if (existingMessage) {
                console.log(`Tin nhắn có ID ${message.id} đã tồn tại trong DOM, bỏ qua`);
                return; // Bỏ qua nếu tin nhắn đã tồn tại
            }
        }

        // Tạo phần tử tin nhắn mới
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender} message-item`;
        messageElement.dataset.messageId = message.id;

        // Định dạng thời gian
        const messageTime = formatTime(new Date(message.timestamp));

        // Hiển thị người gửi
        let senderName = '';
        if (message.sender === 'user') {
            senderName = '<div class="sender">Khách hàng</div>';
        } else if (message.sender === 'bot') {
            senderName = '<div class="sender">Chatbot</div>';
        } else if (message.sender === 'staff') {
            senderName = '<div class="sender">Nhân viên</div>';
        }

        messageElement.innerHTML = `
            ${senderName}
            <div class="content">${message.content}</div>
            <div class="time">${messageTime}</div>
        `;

        messagesContainer.appendChild(messageElement);
        console.log(`Đã thêm tin nhắn ${message.id} với nội dung "${message.content}"`);
    }
}

// Gửi tin nhắn
function sendMessage() {
  if (isSendingMessage) {
    console.log('Đang trong quá trình gửi tin nhắn, bỏ qua yêu cầu mới');
    return; // Ngăn chặn gửi nhiều lần
  }
  
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  const sendBtn = document.getElementById('send-message-btn');

  if (!content || !currentSessionId) {
    return;
  }

  // Đánh dấu đang gửi
  isSendingMessage = true;
  
  // Vô hiệu hóa nút gửi để tránh click nhiều lần
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="sending-spinner"></span> Đang gửi...';
  }

  // Lưu tin nhắn input trước khi xóa để khôi phục nếu cần
  const originalMessage = content;
  
  // Xóa nội dung input ngay lập tức để cải thiện UX 
  input.value = '';

  // Tạo ID duy nhất cho tin nhắn tạm
  const tempId = 'temp-' + Date.now();

  // Tạo một tin nhắn tạm thời để hiển thị ngay lập tức
  const tempMessage = {
    id: tempId,
    sessionId: currentSessionId,
    sender: 'staff',
    content: content,
    timestamp: new Date().toISOString()
  };

  // Hiển thị tin nhắn tạm thời ngay lập tức
  appendMessage(tempMessage);
  scrollToBottom();

  const token = localStorage.getItem('auth_token');

  // Thêm logging
  console.log(`Gửi tin nhắn đến phiên ${currentSessionId}: "${content}"`);

  fetch(`${API_BASE_URL}/support/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId: currentSessionId,
      content
    })
  })
  .then(response => {
    // Lưu status code để xử lý lỗi chính xác
    const statusCode = response.status;
    console.log(`Nhận phản hồi từ server với mã trạng thái: ${statusCode}`);
    
    // Xử lý cả lỗi và thành công với detail
    return response.json().then(data => {
      return { 
        ok: response.ok, 
        status: statusCode,
        data: data 
      };
    });
  })
  .then(result => {
    if (result.ok) {
      console.log('Gửi tin nhắn thành công:', result.data);
      
      // Cập nhật tin nhắn tạm với ID thật
      const tempElement = document.querySelector(`.message-item[data-message-id="${tempId}"]`);
      if (tempElement) {
        tempElement.dataset.messageId = result.data.id;
        // Thêm vào danh sách tin nhắn đã nhận để tránh hiển thị lại
        receivedMessageIds.add(result.data.id);
        console.log(`Đã cập nhật tin nhắn tạm ${tempId} thành tin nhắn thật ${result.data.id}`);
      }
      
      // Xóa phần tử lỗi nếu có
      const errorElement = document.querySelector('.message.system[data-error="send-error"]');
      if (errorElement) {
        errorElement.remove();
      }
    } else {
      throw new Error(`Error ${result.status}: ${result.data.error || 'Unknown error'}`);
    }
  })
  .catch(error => {
    console.error('Lỗi khi gửi tin nhắn:', error);
    
    // Xóa tin nhắn tạm
    const tempElement = document.querySelector(`.message-item[data-message-id="${tempId}"]`);
    if (tempElement) {
      tempElement.remove();
    }
    
    // Khôi phục nội dung input để người dùng không phải nhập lại
    input.value = originalMessage;
    
    // Hiển thị thông báo lỗi
    const errorMessage = {
      id: 'error-' + Date.now(),
      sessionId: currentSessionId,
      sender: 'system',
      content: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
      timestamp: new Date().toISOString()
    };
    
    // Thêm thuộc tính để nhận dạng thông báo lỗi
    const errorElement = document.createElement('div');
    errorElement.className = 'message system message-item';
    errorElement.setAttribute('data-error', 'send-error');
    errorElement.innerHTML = `
      <div class="content" style="color: #d32f2f;">Không thể gửi tin nhắn. Vui lòng thử lại.</div>
      <div class="time">${formatTime(new Date())}</div>
    `;
    
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.appendChild(errorElement);
      scrollToBottom();
    }
  })
  .finally(() => {
    // Đặt lại trạng thái và giao diện
    isSendingMessage = false;
    
    // Kích hoạt lại nút gửi
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = 'Gửi';
    }
    
    // Focus lại vào input
    input.focus();
  });
}

// Kết thúc phiên hỗ trợ
function endSession() {
  if (!currentSessionId) return;

  if (!confirm('Bạn có chắc chắn muốn kết thúc phiên hỗ trợ này?')) {
    return;
  }

  const token = localStorage.getItem('auth_token');

  fetch(`${API_BASE_URL}/support/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId: currentSessionId
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to end session');
  })
  .then(() => {
    // Đóng phiên hiện tại
    closeChatSession();

    // Cập nhật danh sách phiên
    fetchSupportSessions();
  })
  .catch(error => {
    console.error('Error ending session:', error);
  });
}

// Thêm câu trả lời nhanh vào khung chat
function insertQuickResponse(text) {
  const inputElement = document.getElementById('chat-input');
  if (inputElement) {
    inputElement.value = text;
    inputElement.focus();
  }
}

// Thêm mẫu trả lời vào khung chat
function insertTemplate(templateType) {
  let templateText = '';

  switch (templateType) {
    case 'technical':
      templateText = 'Về vấn đề kỹ thuật của bạn, chúng tôi cần thêm thông tin sau để hỗ trợ tốt hơn: 1) Phiên bản phần mềm bạn đang sử dụng, 2) Các bước để tái hiện lỗi, 3) Thông báo lỗi cụ thể nếu có.';
      break;
    case 'pricing':
      templateText = 'Về báo giá dịch vụ, chi phí sẽ phụ thuộc vào quy mô và yêu cầu cụ thể của dự án. Bạn có thể cho tôi biết thêm về nhu cầu của bạn để chúng tôi có thể cung cấp báo giá chi tiết hơn.';
      break;
    case 'timeline':
      templateText = 'Thời gian hoàn thành dự án thường từ 4-6 tuần tùy thuộc vào quy mô và độ phức tạp. Chúng tôi sẽ cung cấp lộ trình chi tiết sau khi thảo luận kỹ hơn về yêu cầu của bạn.';
      break;
    case 'contact':
      templateText = 'Bạn có thể liên hệ với chúng tôi qua email support@tectonicdevs.com hoặc số điện thoại 0903-123-456 trong giờ làm việc từ 8:00 đến 17:30, Thứ Hai đến Thứ Sáu.';
      break;
  }

  const inputElement = document.getElementById('chat-input');
  if (inputElement) {
    inputElement.value = templateText;
    inputElement.focus();
  }
}

// Cập nhật thông tin phiên hiện tại
function updateSessionInfo(sessionId) {
  const session = sessionList.find(s => s.id === sessionId);
  if (!session) return;

  // Cập nhật tiêu đề
  const clientNameElement = document.getElementById('client-name');
  if (clientNameElement) clientNameElement.textContent = `Phiên ${session.id.substr(0, 8)}...`;

  // Cập nhật thời gian
  const sessionTime = formatTime(new Date(session.createdAt));
  const sessionTimeElement = document.getElementById('session-time');
  if (sessionTimeElement) sessionTimeElement.textContent = `Bắt đầu: ${sessionTime}`;
}

// Cập nhật danh sách phiên khi có tin nhắn mới
function updateSessionWithNewMessage(message) {
  // Tìm phiên trong danh sách
  const sessionIndex = sessionList.findIndex(s => s.id === message.sessionId);
  if (sessionIndex === -1) return;

  // Cập nhật tin nhắn cuối cùng
  sessionList[sessionIndex].lastMessage = message;
  sessionList[sessionIndex].updatedAt = new Date();

  // Sắp xếp lại danh sách theo thời gian cập nhật
  sessionList.sort((a, b) => {
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });

  // Render lại danh sách
  renderSessionList(sessionList);
}

// Cuộn xuống cuối khung chat
function scrollToBottom() {
  const messagesContainer = document.getElementById('chat-messages');
  if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Hiển thị thông báo
function showNotification(message) {
  // Thay thế hàm cũ bằng hàm sendNotification
  sendNotification('Thông báo mới', message);
}

// Hàm định dạng thời gian
function formatTime(date) {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  });
}

function closeChatSession() {
    currentSessionId = null;
    // Ẩn giao diện chat
    document.querySelector('.chat-interface').style.display = 'none';
    document.querySelector('.no-session-selected').style.display = 'block';
    // Đặt lại receivedMessageIds
    receivedMessageIds = new Set();
    // Làm sạch nội dung chat
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('chat-input').value = '';
}

// updateSessionsList function was missing from original code, adding a placeholder
function updateSessionsList(){
    //Add your implementation here
}