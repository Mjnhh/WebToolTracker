// Biến và cấu hình toàn cục
let currentUser = null;
let currentSessionId = null;
let socket = null;
let sessionList = [];
let activeSessions = [];
let receivedMessageIds = new Set(); // Set lưu trữ ID tin nhắn đã hiển thị
let tempMessageMap = new Map(); // Map lưu trữ tin nhắn tạm và ID thật của chúng
const API_BASE_URL = '/api';
let isSendingMessage = false; // Biến trạng thái để ngăn chặn gửi nhiều lần
let isLoadingMessages = false; // Biến trạng thái để ngăn chặn việc tải tin nhắn nhiều lần

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
  });

  socket.on('new-support-request', (session) => {
    console.log('Received new support request:', session);
    
    // Phát âm thanh thông báo
    playNotificationSound('new-session');
    
    // Hiển thị thông báo desktop
    showDesktopNotification('Phiên chat mới', 'Có khách hàng mới cần hỗ trợ');
    
    // Thêm session mới vào danh sách
    if (!sessionList.some(s => s.id === session.id)) {
      sessionList.push(session);
      updateSessionsList();
      
      // Kiểm tra và gửi tin nhắn tự động nếu đã bật
      if (localStorage.getItem('auto-reply') === 'true') {
        sendAutoReply(session.id);
      }
    }
  });

  // Lắng nghe tin nhắn mới từ socket
  socket.on('new-message', (message) => {
    console.log('Nhận tin nhắn mới qua socket:', message);
    
    // Thông báo khi có tin nhắn mới từ khách hàng
    if (message.sender === 'user') {
      // Phát âm thanh thông báo
      playNotificationSound('message');
      
      // Hiển thị thông báo desktop nếu không phải là phiên đang mở
      if (message.sessionId !== currentSessionId) {
        showDesktopNotification('Tin nhắn mới', 'Có tin nhắn mới từ khách hàng');
      }
    }
    
    // Kiểm tra xem tin nhắn có thuộc phiên hiện tại và có ID hợp lệ không
    if (!message || !message.id || !message.sessionId || message.sessionId !== currentSessionId) {
      return;
    }
    
    // 1. Kiểm tra xem tin nhắn này có phải là từ mình gửi đi không
    const isSelfMessage = message.sender === 'staff';
    
    // 2. Tìm tin nhắn tạm thời tương ứng
    const tempId = tempMessageMap.get(message.id);
    if (tempId) {
      console.log(`Đã tìm thấy tin nhắn tạm ${tempId} cho tin nhắn thật ${message.id}, chỉ cập nhật ID`);
      // Cập nhật ID
      const tempElement = document.querySelector(`.message-item[data-temp-ref="${message.id}"]`);
      if (tempElement) {
        tempElement.dataset.messageId = message.id;
        delete tempElement.dataset.tempRef;
        
        // Đánh dấu tin nhắn đã được xử lý
        receivedMessageIds.add(message.id);
        
        // Xóa khỏi map tạm thời
        tempMessageMap.delete(message.id);
        return;
      }
    }
    
    // 3. Kiểm tra xem tin nhắn đã hiển thị chưa
    if (receivedMessageIds.has(message.id)) {
      console.log(`Tin nhắn ${message.id} đã hiển thị trước đó, bỏ qua`);
      return;
    }
    
    // 4. Nếu là tin nhắn do mình gửi (staff) và không tìm thấy bản tạm, kiểm tra lần cuối
    if (isSelfMessage) {
      // Tìm tất cả tin nhắn của staff trong DOM để tránh trường hợp trùng lặp
      const existingStaffMessages = document.querySelectorAll('.message.staff.message-item');
      for (let msgElem of existingStaffMessages) {
        // Kiểm tra nội dung và thời gian để tránh hiển thị trùng lặp
        const contentElem = msgElem.querySelector('.content');
        if (contentElem && contentElem.textContent === message.content) {
          console.log(`Phát hiện tin nhắn staff trùng nội dung, bỏ qua: "${message.content}"`);
          receivedMessageIds.add(message.id);
          return;
        }
      }
    }
    
    // 5. Nếu là tin nhắn mới thật sự, thêm vào màn hình
    receivedMessageIds.add(message.id);
    appendMessage(message);
    scrollToBottom();
    
    // Cập nhật danh sách phiên với tin nhắn mới
    updateSessionWithNewMessage(message);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
}

// Hàm khởi tạo khi tải xong trang
document.addEventListener('DOMContentLoaded', () => {
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
      staffName.textContent = `${userData.name || userData.username}`;
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

  // Thiết lập chuyển tab
  setupTabNavigation();
  
  // Thiết lập cài đặt
  setupSettings();
}

// Thiết lập điều hướng tab
function setupTabNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const contentSections = document.querySelectorAll('.content-section');
  
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Xóa trạng thái active từ tất cả các menu items
      menuItems.forEach(mi => mi.classList.remove('active'));
      
      // Thêm trạng thái active cho menu item được chọn
      item.classList.add('active');
      
      // Ẩn tất cả các phần nội dung
      contentSections.forEach(section => section.classList.remove('active'));
      
      // Hiển thị phần nội dung tương ứng
      const targetSection = item.dataset.section;
      const contentSection = document.getElementById(`${targetSection}-section`);
      if (contentSection) {
        contentSection.classList.add('active');
        
        // Nếu chuyển sang tab thống kê, tải dữ liệu thống kê
        if (targetSection === 'stats') {
          const statsFilter = document.getElementById('stats-period-filter');
          const period = statsFilter ? statsFilter.value : 'today';
          fetchStats(period);
        }
      }
    });
  });
}

// Thiết lập cài đặt
function setupSettings() {
  // Dark mode toggle
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    // Kiểm tra cài đặt đã lưu
    const darkMode = localStorage.getItem('dark-mode') === 'true';
    darkModeToggle.checked = darkMode;
    
    if (darkMode) {
      document.body.classList.add('dark-mode');
    }
    
    darkModeToggle.addEventListener('change', () => {
      if (darkModeToggle.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('dark-mode', 'true');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('dark-mode', 'false');
      }
    });
  }
  
  // Font size setting
  const fontSizeSetting = document.getElementById('font-size-setting');
  if (fontSizeSetting) {
    // Kiểm tra cài đặt đã lưu
    const fontSize = localStorage.getItem('font-size') || 'medium';
    fontSizeSetting.value = fontSize;
    
    document.body.classList.add(`font-${fontSize}`);
    
    fontSizeSetting.addEventListener('change', () => {
      // Xóa tất cả các class font size
      document.body.classList.remove('font-small', 'font-medium', 'font-large');
      // Thêm class mới
      document.body.classList.add(`font-${fontSizeSetting.value}`);
      localStorage.setItem('font-size', fontSizeSetting.value);
    });
  }
  
  // Thiết lập âm thanh thông báo
  const notificationSoundToggle = document.getElementById('notification-sound');
  if (notificationSoundToggle) {
    // Kiểm tra cài đặt đã lưu
    const notificationSound = localStorage.getItem('notification-sound') !== 'false';
    notificationSoundToggle.checked = notificationSound;
    
    notificationSoundToggle.addEventListener('change', () => {
      localStorage.setItem('notification-sound', notificationSoundToggle.checked);
      // Kiểm tra thiết lập ngay lập tức
      if (notificationSoundToggle.checked) {
        playNotificationSound('test');
      }
    });
  }
  
  // Thiết lập loại âm thanh thông báo
  const notificationSoundType = document.getElementById('notification-sound-type');
  if (notificationSoundType) {
    // Kiểm tra cài đặt đã lưu
    const soundType = localStorage.getItem('notification-sound-type') || 'default';
    notificationSoundType.value = soundType;
    
    // Thêm debounce để tránh gọi nhiều lần khi người dùng thay đổi nhanh
    let soundTypeChangeTimeout;
    
    notificationSoundType.addEventListener('change', () => {
      const selectedSoundType = notificationSoundType.value;
      localStorage.setItem('notification-sound-type', selectedSoundType);
      
      // Sử dụng debounce để tránh phát nhiều âm thanh liên tiếp
      clearTimeout(soundTypeChangeTimeout);
      soundTypeChangeTimeout = setTimeout(() => {
        // Phát âm thanh để kiểm tra
        if (notificationSoundToggle && notificationSoundToggle.checked) {
          playNotificationSound('test');
        }
      }, 300);
    });
  }
  
  // Nút nghe thử âm thanh
  const testSoundBtn = document.getElementById('test-sound-btn');
  if (testSoundBtn) {
    testSoundBtn.addEventListener('click', () => {
      if (notificationSoundToggle && notificationSoundToggle.checked) {
        playNotificationSound('test');
      } else {
        showNotification('Bạn cần bật âm thanh thông báo trước', 'warning');
      }
    });
  }
  
  // Thiết lập thông báo desktop
  const desktopNotificationsToggle = document.getElementById('desktop-notifications');
  if (desktopNotificationsToggle) {
    // Kiểm tra cài đặt đã lưu và quyền thông báo
    const desktopNotificationsEnabled = localStorage.getItem('desktop-notifications') !== 'false';
    desktopNotificationsToggle.checked = desktopNotificationsEnabled;
    
    desktopNotificationsToggle.addEventListener('change', () => {
      if (desktopNotificationsToggle.checked) {
        // Yêu cầu quyền thông báo
        requestNotificationPermission();
      }
      localStorage.setItem('desktop-notifications', desktopNotificationsToggle.checked);
    });
    
    // Kiểm tra quyền thông báo khi tải trang
    checkNotificationPermission();
  }
  
  // Thiết lập tự động trả lời
  const autoReplyToggle = document.getElementById('auto-reply');
  if (autoReplyToggle) {
    // Kiểm tra cài đặt đã lưu
    const autoReplyEnabled = localStorage.getItem('auto-reply') === 'true';
    autoReplyToggle.checked = autoReplyEnabled;
    
    autoReplyToggle.addEventListener('change', () => {
      localStorage.setItem('auto-reply', autoReplyToggle.checked);
      
      // Hiện/ẩn textarea cài đặt nội dung tự động trả lời
      const autoReplyContentWrapper = document.getElementById('auto-reply-content-wrapper');
      if (autoReplyContentWrapper) {
        autoReplyContentWrapper.style.display = autoReplyToggle.checked ? 'block' : 'none';
      }
    });
    
    // Khởi tạo hiển thị textarea dựa trên trạng thái
    const autoReplyContentWrapper = document.getElementById('auto-reply-content-wrapper');
    if (autoReplyContentWrapper) {
      autoReplyContentWrapper.style.display = autoReplyEnabled ? 'block' : 'none';
    }
    
    // Lưu nội dung tự động trả lời
    const autoReplyContent = document.getElementById('auto-reply-content');
    if (autoReplyContent) {
      // Lấy nội dung đã lưu
      autoReplyContent.value = localStorage.getItem('auto-reply-content') || 'Cảm ơn bạn đã liên hệ. Nhân viên sẽ phản hồi trong thời gian sớm nhất.';
      
      // Lắng nghe sự kiện thay đổi
      autoReplyContent.addEventListener('input', () => {
        localStorage.setItem('auto-reply-content', autoReplyContent.value);
      });
    }
  }
  
  // Thiết lập theme màu
  const colorThemeSelect = document.getElementById('color-theme');
  if (colorThemeSelect) {
    // Kiểm tra cài đặt đã lưu
    const colorTheme = localStorage.getItem('color-theme') || 'default';
    colorThemeSelect.value = colorTheme;
    
    // Áp dụng theme màu
    applyColorTheme(colorTheme);
    
    colorThemeSelect.addEventListener('change', () => {
      const selectedTheme = colorThemeSelect.value;
      applyColorTheme(selectedTheme);
      localStorage.setItem('color-theme', selectedTheme);
    });
  }
  
  // Lưu tất cả cài đặt
  const saveSettingsBtn = document.getElementById('save-settings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // Hiển thị thông báo đã lưu
      showNotification('Đã lưu cài đặt của bạn!', 'success');
    });
  }
  
  // Cài đặt mẫu câu trả lời
  setupTemplates();
}

// Áp dụng theme màu
function applyColorTheme(theme) {
  // Xóa tất cả class theme cũ
  document.body.classList.remove('theme-default', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
  
  // Thêm class theme mới
  document.body.classList.add(`theme-${theme}`);
  
  // Cập nhật biến CSS tương ứng với theme
  switch (theme) {
    case 'blue':
      document.documentElement.style.setProperty('--primary-color', '#3B82F6');
      document.documentElement.style.setProperty('--primary-light', '#60A5FA');
      document.documentElement.style.setProperty('--primary-dark', '#2563EB');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)');
      break;
    case 'green':
      document.documentElement.style.setProperty('--primary-color', '#10B981');
      document.documentElement.style.setProperty('--primary-light', '#34D399');
      document.documentElement.style.setProperty('--primary-dark', '#059669');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #10B981 0%, #059669 100%)');
      break;
    case 'purple':
      document.documentElement.style.setProperty('--primary-color', '#8B5CF6');
      document.documentElement.style.setProperty('--primary-light', '#A78BFA');
      document.documentElement.style.setProperty('--primary-dark', '#7C3AED');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)');
      break;
    case 'orange':
      document.documentElement.style.setProperty('--primary-color', '#F59E0B');
      document.documentElement.style.setProperty('--primary-light', '#FBBF24');
      document.documentElement.style.setProperty('--primary-dark', '#D97706');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)');
      break;
    default: // Default theme (indigo)
      document.documentElement.style.setProperty('--primary-color', '#6366F1');
      document.documentElement.style.setProperty('--primary-light', '#818CF8');
      document.documentElement.style.setProperty('--primary-dark', '#4F46E5');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)');
      break;
  }
}

// Xử lý thông báo desktop
function checkNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Trình duyệt này không hỗ trợ thông báo desktop');
    const desktopNotificationsToggle = document.getElementById('desktop-notifications');
    if (desktopNotificationsToggle) {
      desktopNotificationsToggle.checked = false;
      desktopNotificationsToggle.disabled = true;
    }
    return;
  }
  
  if (Notification.permission === 'denied') {
    console.log('Quyền thông báo đã bị từ chối');
    const desktopNotificationsToggle = document.getElementById('desktop-notifications');
    if (desktopNotificationsToggle) {
      desktopNotificationsToggle.checked = false;
    }
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return;
  }
  
  Notification.requestPermission().then(permission => {
    if (permission !== 'granted') {
      console.log('Quyền thông báo không được cấp');
      const desktopNotificationsToggle = document.getElementById('desktop-notifications');
      if (desktopNotificationsToggle) {
        desktopNotificationsToggle.checked = false;
      }
    }
  });
}

// Hiển thị thông báo desktop
function showDesktopNotification(title, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  
  // Kiểm tra xem người dùng có bật thông báo desktop không
  if (localStorage.getItem('desktop-notifications') === 'false') {
    return;
  }
  
  const notification = new Notification(title, {
    body: message,
    icon: '/logo.png'
  });
  
  notification.onclick = function() {
    window.focus();
    this.close();
  };
  
  // Tự đóng sau 5 giây
  setTimeout(() => notification.close(), 5000);
}

// Phát âm thanh thông báo
function playNotificationSound(type) {
  // Kiểm tra xem người dùng có bật âm thanh thông báo không
  if (localStorage.getItem('notification-sound') === 'false') {
    return;
  }
  
  // Lấy loại âm thanh từ cài đặt
  const selectedSoundType = localStorage.getItem('notification-sound-type') || 'default';
  
  let soundPath;
  
  // Tạo các dạng âm thanh khác nhau theo loại
  const getAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    return new AudioContext();
  };
  
  // Tạo âm thanh động nếu không tìm thấy file
  const createDynamicSound = (frequency, duration, type = 'sine') => {
    try {
      const audioCtx = getAudioContext();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
      
      return true;
    } catch (error) {
      console.error("Không thể tạo âm thanh động:", error);
      return false;
    }
  };
  
  // Xác định đường dẫn âm thanh dựa trên loại và cài đặt
  if (type === 'test') {
    // Sử dụng âm thanh test để kiểm tra
    switch (selectedSoundType) {
      case 'beep':
        // Tạo âm thanh beep (âm thanh vuông với tần số cao)
        if (createDynamicSound(1000, 0.2, 'square')) {
          return;
        }
        soundPath = '/sounds/beep/test-notification.mp3';
        break;
      case 'chime':
        // Tạo âm thanh chime (âm thanh sin với tần số trung bình)
        if (createDynamicSound(784, 0.5)) {
          return;
        }
        soundPath = '/sounds/chime/test-notification.mp3';
        break;
      case 'ding':
        // Tạo âm thanh ding (âm thanh sin với tần số cao)
        if (createDynamicSound(1200, 0.3)) {
          return;
        }
        soundPath = '/sounds/ding/test-notification.mp3';
        break;
      case 'custom':
        soundPath = '/sounds/custom/test-notification.mp3';
        break;
      default:
        // Âm thanh mặc định (âm thanh sin với tần số thay đổi)
        if (createDynamicSound(659.25, 0.3)) {
          return;
        }
        soundPath = '/sounds/test-notification.mp3';
        break;
    }
  } else {
    // Sử dụng âm thanh thông thường
    switch (type) {
      case 'message':
        switch (selectedSoundType) {
          case 'beep':
            // Tạo âm thanh beep cho tin nhắn
            if (createDynamicSound(900, 0.2, 'square')) {
              return;
            }
            soundPath = '/sounds/beep/message.mp3';
            break;
          case 'chime':
            // Tạo âm thanh chime cho tin nhắn
            if (createDynamicSound(700, 0.4)) {
              return;
            }
            soundPath = '/sounds/chime/message.mp3';
            break;
          case 'ding':
            // Tạo âm thanh ding cho tin nhắn
            if (createDynamicSound(1100, 0.2)) {
              return;
            }
            soundPath = '/sounds/ding/message.mp3';
            break;
          case 'custom':
            soundPath = '/sounds/custom/message.mp3';
            break;
          default:
            soundPath = '/sounds/message.mp3';
            break;
        }
        break;
        
      case 'new-session':
        switch (selectedSoundType) {
          case 'beep':
            // Tạo âm thanh beep cho phiên mới (2 beep liên tiếp)
            if (createDynamicSound(800, 0.4, 'square')) {
              setTimeout(() => createDynamicSound(1000, 0.4, 'square'), 500);
              return;
            }
            soundPath = '/sounds/beep/new-session.mp3';
            break;
          case 'chime':
            // Tạo âm thanh chime cho phiên mới (2 note)
            if (createDynamicSound(523.25, 0.3)) {
              setTimeout(() => createDynamicSound(783.99, 0.3), 350);
              return;
            }
            soundPath = '/sounds/chime/new-session.mp3';
            break;
          case 'ding':
            // Tạo âm thanh ding cho phiên mới (2 ding)
            if (createDynamicSound(1100, 0.2)) {
              setTimeout(() => createDynamicSound(1300, 0.3), 300);
              return;
            }
            soundPath = '/sounds/ding/new-session.mp3';
            break;
          case 'custom':
            soundPath = '/sounds/custom/new-session.mp3';
            break;
          default:
            soundPath = '/sounds/new-session.mp3';
            break;
        }
        break;
        
      default:
        switch (selectedSoundType) {
          case 'beep':
            // Tạo âm thanh beep cho thông báo
            if (createDynamicSound(600, 0.1, 'square')) {
              setTimeout(() => createDynamicSound(800, 0.1, 'square'), 200);
              setTimeout(() => createDynamicSound(1000, 0.1, 'square'), 400);
              return;
            }
            soundPath = '/sounds/beep/notification.mp3';
            break;
          case 'chime':
            // Tạo âm thanh chime cho thông báo
            if (createDynamicSound(440, 0.4)) {
              setTimeout(() => createDynamicSound(880, 0.4), 450);
              return;
            }
            soundPath = '/sounds/chime/notification.mp3';
            break;
          case 'ding':
            // Tạo âm thanh ding cho thông báo
            if (createDynamicSound(1000, 0.2)) {
              setTimeout(() => createDynamicSound(1200, 0.3), 250);
              return;
            }
            soundPath = '/sounds/ding/notification.mp3';
            break;
          case 'custom':
            soundPath = '/sounds/custom/notification.mp3';
            break;
          default:
            soundPath = '/sounds/notification.mp3';
            break;
        }
        break;
    }
  }
  
  console.log("Playing sound:", soundPath);
  
  // Phát âm thanh
  const sound = new Audio(soundPath);
  
  sound.onerror = function() {
    console.error('Không thể tải file âm thanh:', soundPath);
    // Sử dụng âm thanh mặc định nếu không tìm thấy
    const defaultSound = new Audio('/sounds/message.mp3');
    defaultSound.play().catch(error => {
      console.error('Không thể phát âm thanh mặc định:', error);
      // Nếu không thể phát âm thanh mặc định, tạo âm thanh động
      createDynamicSound(880, 0.3);
    });
  };
  
  sound.play().catch(error => {
    console.error('Không thể phát âm thanh thông báo:', error);
    // Sử dụng âm thanh động nếu không thể phát âm thanh từ file
    createDynamicSound(880, 0.3);
  });
}

// Hiển thị thông báo trong ứng dụng
function showNotification(message, type = 'info') {
  // Kiểm tra xem container thông báo đã tồn tại chưa
  let notificationContainer = document.getElementById('notification-container');
  
  if (!notificationContainer) {
    // Tạo container nếu chưa tồn tại
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    document.body.appendChild(notificationContainer);
  }
  
  // Tạo thông báo mới
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  // Thêm icon dựa vào loại thông báo
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<i class="fas fa-check-circle"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-exclamation-circle"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    default:
      icon = '<i class="fas fa-info-circle"></i>';
      break;
  }
  
  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-content">${message}</div>
    <button class="notification-close"><i class="fas fa-times"></i></button>
  `;
  
  // Thêm vào container
  notificationContainer.appendChild(notification);
  
  // Thêm nút đóng thông báo
  const closeButton = notification.querySelector('.notification-close');
  closeButton.addEventListener('click', () => {
    notification.classList.add('notification-hide');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // Tự động đóng sau 5 giây
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('notification-hide');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }, 5000);
}

// Thiết lập mẫu câu trả lời
function setupTemplates() {
  // Sự kiện khi nhấp vào mẫu câu
  const templateItems = document.querySelectorAll('.template-item .template-content');
  templateItems.forEach(item => {
    item.addEventListener('click', () => {
      const templateText = item.textContent.trim();
      insertTemplate(templateText);
    });
  });
  
  // Nút thêm mẫu mới
  const addTemplateBtn = document.getElementById('add-template-btn');
  if (addTemplateBtn) {
    addTemplateBtn.addEventListener('click', () => {
      // Đây là nơi bạn sẽ hiển thị modal để thêm mẫu mới
      alert('Tính năng đang phát triển');
    });
  }
  
  // Nút sửa mẫu
  const editBtns = document.querySelectorAll('.template-edit-btn');
  editBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const templateItem = btn.closest('.template-item');
      const templateContent = templateItem.querySelector('.template-content p').textContent;
      // Đây là nơi bạn sẽ hiển thị modal để sửa mẫu
      alert(`Sửa mẫu: ${templateContent}`);
    });
  });
  
  // Nút xóa mẫu
  const deleteBtns = document.querySelectorAll('.template-delete-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Bạn có chắc muốn xóa mẫu này không?')) {
        const templateItem = btn.closest('.template-item');
        templateItem.remove();
      }
    });
  });
}

// Chèn mẫu câu vào ô nhập tin nhắn
function insertTemplate(text) {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    // Thay thế các biến trong mẫu
    let processedText = text;
    
    // Thay thế ${name} bằng tên nhân viên
    if (currentUser) {
      processedText = processedText.replace('${name}', currentUser.name || currentUser.username);
    }
    
    chatInput.value = processedText;
    chatInput.focus();
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

    // Lưu token
    localStorage.setItem('auth_token', data.token);
    
    // Cập nhật user hiện tại
    currentUser = data.user;
    
    // Ẩn form đăng nhập
    hideLoginForm();
    
    // Khởi tạo giao diện
    initializeStaffInterface();
    
    // Hiển thị tên và vai trò
    const staffName = document.getElementById('staff-name');
    if (staffName) {
      staffName.textContent = `${data.user.name || data.user.username}`;
    }
  })
  .catch(error => {
    console.error('Login error:', error);
    if (errorElement) {
      errorElement.textContent = 'Tên đăng nhập hoặc mật khẩu không đúng';
      errorElement.style.display = 'block';
    }
  });
}

// Khởi tạo giao diện nhân viên
function initializeStaffInterface() {
  // Khởi tạo socket
  initializeSocket();
  
  // Tải danh sách phiên hỗ trợ
  fetchSupportSessions();
}

// Xử lý logout
function handleLogout() {
  // Xóa token
  localStorage.removeItem('auth_token');
  
  // Ngắt kết nối socket
  if (socket) {
    socket.disconnect();
  }
  
  // Reset state
  currentUser = null;
  currentSessionId = null;
  sessionList = [];
  
  // Hiển thị form đăng nhập
  showLoginForm();
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
      <div class="chat-support-container">
        <div class="chat-header">
          <div class="chat-header-info">
            <span class="session-badge">Phiên ${sessionId.substr(0, 8)}...</span>
          </div>
          <div class="chat-header-actions">
            <button id="end-session-btn" class="chat-header-button end-session" title="Kết thúc phiên">
              <i class="fas fa-times-circle"></i>
            </button>
          </div>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <div class="chat-input-form">
          <input type="text" id="chat-input" placeholder="Nhập tin nhắn của bạn...">
          <button id="send-message-btn">
            <i class="fas fa-paper-plane"></i> Gửi
          </button>
        </div>
        <div class="quick-responses">
          <div class="quick-response-item">Xin chào!</div>
          <div class="quick-response-item">Tôi có thể giúp gì cho bạn?</div>
          <div class="quick-response-item">Vui lòng đợi trong giây lát.</div>
          <div class="quick-response-item">Cảm ơn bạn đã liên hệ với chúng tôi.</div>
        </div>
      </div>
    `;

    // Thêm lại các event handler cho các nút mới
    const sendButton = document.getElementById('send-message-btn');
    if (sendButton) {
      sendButton.addEventListener('click', sendMessage);
    }

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });
    }

    const endSessionBtn = document.getElementById('end-session-btn');
    if (endSessionBtn) {
      endSessionBtn.addEventListener('click', endSession);
    }

    // Thiết lập câu trả lời nhanh
    setupQuickResponses();
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

// Thiết lập câu trả lời nhanh
function setupQuickResponses() {
  const quickResponseItems = document.querySelectorAll('.quick-response-item');
  if (quickResponseItems) {
    quickResponseItems.forEach(item => {
      item.addEventListener('click', () => {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
          chatInput.value = item.textContent;
          chatInput.focus();
        }
      });
    });
  }
}

// Tham gia vào phiên chat qua socket
function joinChatSession(sessionId) {
  if (socket) {
    // Rời khỏi tất cả các phòng chat trước đó
    if (socket.previousSessionId) {
      socket.emit('leave-room', socket.previousSessionId);
    }
    
    // Tham gia vào room với sessionId
    socket.emit('join-room', sessionId);
    socket.emit('join-chat', { sessionId: sessionId });
    
    // Lưu sessionId hiện tại để có thể rời phòng sau này
    socket.previousSessionId = sessionId;

    console.log(`Joined chat session: ${sessionId}`);
  }
}

// Tải tin nhắn của phiên
function fetchSessionMessages(sessionId) {
  // Kiểm tra nếu đang gọi API hoặc sessionId không hợp lệ
  if (isLoadingMessages || !sessionId) {
    console.log('Không thể tải tin nhắn: đang tải hoặc sessionId không hợp lệ');
    return;
  }

  isLoadingMessages = true;

  // Đặt lại biến theo dõi tin nhắn khi chuyển phiên
  receivedMessageIds.clear();
  tempMessageMap.clear();

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

      // Xóa tin nhắn hiện tại trước khi hiển thị tin nhắn mới
      messagesContainer.innerHTML = '';
      
      // Hiển thị tin nhắn mới
      data.forEach(message => {
        if (message && message.id) {
          receivedMessageIds.add(message.id);
          appendMessage(message);
        }
      });

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
    isLoadingMessages = false;
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

// Thêm tin nhắn vào khung chat
function appendMessage(message) {
  if (!message || !message.content) {
    console.error('Invalid message object:', message);
    return;
  }
  
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  
  // Kiểm tra lần cuối xem tin nhắn đã tồn tại trong DOM chưa
  const existingMessage = document.querySelector(`.message-item[data-message-id="${message.id}"]`);
  if (existingMessage) {
    console.log(`Tin nhắn ID ${message.id} đã tồn tại trong DOM, bỏ qua`);
    return;
  }
  
  // Kiểm tra xem có tin nhắn tạm với temp-ref trỏ đến tin nhắn này không
  const tempMessageElement = document.querySelector(`.message-item[data-temp-ref="${message.id}"]`);
  if (tempMessageElement) {
    console.log(`Tin nhắn ID ${message.id} đã có bản tạm thời hiển thị, bỏ qua`);
    return;
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
  } else if (message.sender === 'system') {
    senderName = '<div class="sender">Hệ thống</div>';
  }

  messageElement.innerHTML = `
    ${senderName}
    <div class="content">${message.content}</div>
    <div class="time">${messageTime}</div>
  `;

  messagesContainer.appendChild(messageElement);
  console.log(`Đã thêm tin nhắn ${message.id} với nội dung "${message.content}"`);
}

// Gửi tin nhắn
function sendMessage() {
  if (isSendingMessage) return; // Ngăn chặn gửi nhiều lần
  isSendingMessage = true;

  const input = document.getElementById('chat-input');
  const content = input.value.trim();

  if (!content || !currentSessionId) {
    isSendingMessage = false; // Đặt lại trạng thái
    return;
  }

  const token = localStorage.getItem('auth_token');

  // Tạo ID duy nhất cho tin nhắn tạm
  const tempId = 'temp-' + Date.now();

  // Tạo một bản sao tạm thời của tin nhắn để hiển thị ngay lập tức
  const tempMessage = {
    id: tempId,
    sessionId: currentSessionId,
    sender: 'staff',
    content: content,
    timestamp: new Date().toISOString()
  };

  // Xóa nội dung input ngay lập tức để cải thiện UX 
  input.value = '';

  // Hiển thị tin nhắn tạm thời ngay lập tức
  appendMessage(tempMessage);
  scrollToBottom();

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
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to send message');
  })
  .then(sentMessage => {
    if (sentMessage && sentMessage.id) {
      console.log(`Tin nhắn đã được gửi thành công với ID: ${sentMessage.id}`);
      
      // Lưu mối quan hệ giữa ID thật và ID tạm
      tempMessageMap.set(sentMessage.id, tempId);
      
      // Đánh dấu ID thật đã được xử lý
      receivedMessageIds.add(sentMessage.id);
      
      // Cập nhật thuộc tính data-temp-ref của tin nhắn tạm trong DOM
      const tempElement = document.querySelector(`.message-item[data-message-id="${tempId}"]`);
      if (tempElement) {
        tempElement.dataset.tempRef = sentMessage.id;
      }
    }
  })
  .catch(error => {
    console.error('Error sending message:', error);
    // Hiển thị thông báo lỗi nếu gửi thất bại
    const errorMessage = {
      id: 'error-' + Date.now(),
      sessionId: currentSessionId,
      sender: 'system',
      content: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
      timestamp: new Date().toISOString()
    };
    appendMessage(errorMessage);
  })
  .finally(() => {
    isSendingMessage = false; // Đặt lại trạng thái sau khi hoàn thành
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
  
  // Hiển thị đánh giá nếu có
  const ratingElement = document.getElementById('session-rating');
  if (ratingElement) {
    if (session.rating) {
      // Hiển thị đánh giá bằng sao
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (i <= session.rating) {
          starsHtml += '<i class="fas fa-star"></i>';
        } else {
          starsHtml += '<i class="far fa-star"></i>';
        }
      }
      ratingElement.innerHTML = `<div class="rating-stars">${starsHtml}</div>`;
      ratingElement.style.display = 'block';
    } else {
      ratingElement.style.display = 'none';
    }
  }
  
  // Hiển thị phản hồi đánh giá nếu có
  const feedbackElement = document.getElementById('session-feedback');
  if (feedbackElement) {
    if (session.feedback) {
      feedbackElement.textContent = `Phản hồi: "${session.feedback}"`;
      feedbackElement.style.display = 'block';
    } else {
      feedbackElement.style.display = 'none';
    }
  }
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
  // Sử dụng API Notification nếu được hỗ trợ
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Tectonic Devs Support', {
        body: message,
        icon: '/logo.png'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Tectonic Devs Support', {
            body: message,
            icon: '/logo.png'
          });
        }
      });
    }
  }
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
  
  // Đặt lại các biến theo dõi tin nhắn
  receivedMessageIds.clear();
  tempMessageMap.clear();
  
  // Hiển thị màn hình không có phiên được chọn
  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    chatContainer.innerHTML = `
      <div class="no-chat-selected">
        <i class="fas fa-comments"></i>
        <h3>Chưa có phiên chat nào được chọn</h3>
        <p>Vui lòng chọn một phiên từ danh sách bên trái để bắt đầu cuộc hội thoại với khách hàng.</p>
      </div>
    `;
  }
  
  // Bỏ chọn tất cả các phiên trong danh sách
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Rời khỏi phòng chat socket nếu đang kết nối
  if (socket && socket.previousSessionId) {
    socket.emit('leave-room', socket.previousSessionId);
    socket.previousSessionId = null;
  }
}

// updateSessionsList function was missing from original code, adding a placeholder
function updateSessionsList(){
    //Add your implementation here
}

// Gửi tin nhắn tự động
function sendAutoReply(sessionId) {
  const token = localStorage.getItem('auth_token');
  if (!token) return;
  
  // Lấy nội dung tin nhắn tự động từ cài đặt
  const autoReplyContent = localStorage.getItem('auto-reply-content') || 
                          'Cảm ơn bạn đã liên hệ. Nhân viên sẽ phản hồi trong thời gian sớm nhất.';
  
  fetch(`${API_BASE_URL}/support/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId: sessionId,
      content: autoReplyContent
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to send auto-reply message');
  })
  .then(sentMessage => {
    console.log('Đã gửi tin nhắn tự động:', sentMessage);
  })
  .catch(error => {
    console.error('Error sending auto-reply message:', error);
  });
}

// Hàm lấy dữ liệu thống kê
function fetchStats(period = 'today') {
  // Hiển thị loading
  const statsCards = document.querySelectorAll('.stat-value');
  statsCards.forEach(card => {
    card.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  });
  
  const chartContainer = document.querySelector('.chart-container');
  if (chartContainer) {
    chartContainer.innerHTML = '<div class="loading-chart">Đang tải dữ liệu...</div>';
  }
  
  // Hiển thị loading cho phần góp ý
  const recentRatingsContainer = document.getElementById('recent-ratings');
  if (recentRatingsContainer) {
    recentRatingsContainer.innerHTML = '<div class="loading-chart">Đang tải dữ liệu...</div>';
  }
  
  // Gọi API
  fetch('/api/support/stats?period=' + period, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Hiển thị dữ liệu lên giao diện
    displayStats(data);
    
    // Vẽ biểu đồ
    renderStatsChart(data.sessionsByDay);
    
    // Hiển thị dữ liệu góp ý đánh giá
    displayRecentRatings(data.recentRatings || []);
  })
  .catch(error => {
    console.error('Error fetching stats:', error);
    showNotification('Không thể tải dữ liệu thống kê', 'error');
    
    // Hiển thị thông báo lỗi cho biểu đồ
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = '<div class="error-message">Không thể tải dữ liệu biểu đồ</div>';
    }
    
    // Hiển thị thông báo lỗi cho phần góp ý
    const recentRatingsContainer = document.getElementById('recent-ratings');
    if (recentRatingsContainer) {
      recentRatingsContainer.innerHTML = '<div class="error-message">Không thể tải dữ liệu đánh giá</div>';
    }
  });
}

// Hiển thị dữ liệu thống kê
function displayStats(data) {
  // Cập nhật các giá trị thống kê
  const statElements = {
    'total-sessions': data.totalSessions,
    'completed-sessions': data.completedSessions,
    'avg-response-time': `${data.avgResponseTime} phút`,
    'avg-rating': data.avgRating
  };
  
  // Cập nhật từng phần tử
  Object.keys(statElements).forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = statElements[id];
    }
  });
  
  // Hiển thị thông tin nhân viên nếu có
  if (data.staffStats && data.staffStats.length > 0) {
    const staffStatsContainer = document.getElementById('staff-stats-container');
    if (staffStatsContainer) {
      staffStatsContainer.innerHTML = '';
      
      // Tạo bảng thống kê nhân viên
      const staffTable = document.createElement('table');
      staffTable.className = 'staff-stats-table';
      
      // Tạo header
      const tableHeader = document.createElement('thead');
      tableHeader.innerHTML = `
        <tr>
          <th>Nhân viên</th>
          <th>Phiên hỗ trợ</th>
          <th>Hoàn thành</th>
          <th>Thời gian TB</th>
          <th>Đánh giá</th>
        </tr>
      `;
      staffTable.appendChild(tableHeader);
      
      // Tạo body
      const tableBody = document.createElement('tbody');
      data.staffStats.forEach(staff => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${staff.name}</td>
          <td>${staff.sessions}</td>
          <td>${staff.completed}</td>
          <td>${staff.avgResponseTime} phút</td>
          <td>${staff.rating}/5</td>
        `;
        tableBody.appendChild(row);
      });
      staffTable.appendChild(tableBody);
      
      // Thêm bảng vào container
      staffStatsContainer.appendChild(staffTable);
    }
  }
}

// Vẽ biểu đồ thống kê
function renderStatsChart(data) {
  // Lấy phần tử container
  const chartContainer = document.querySelector('.chart-container');
  if (!chartContainer) return;
  
  // Xóa nội dung cũ
  chartContainer.innerHTML = '';
  
  // Tạo tiêu đề
  const chartTitle = document.createElement('h3');
  chartTitle.textContent = 'Số phiên hỗ trợ theo ngày';
  chartContainer.appendChild(chartTitle);
  
  // Tính toán giá trị lớn nhất
  const maxValue = Math.max(...data.map(item => item.count), 1);
  
  // Tạo canvas cho biểu đồ
  const chartCanvas = document.createElement('div');
  chartCanvas.className = 'chart-canvas';
  
  // Tạo các thanh biểu đồ
  data.forEach(item => {
    const percentage = (item.count / maxValue) * 100;
    
    const chartBar = document.createElement('div');
    chartBar.className = 'chart-bar';
    
    chartBar.innerHTML = `
      <div class="chart-bar-fill" style="height: ${percentage}%"></div>
      <div class="chart-bar-value">${item.count}</div>
      <div class="chart-bar-label">${item.date}</div>
    `;
    
    chartCanvas.appendChild(chartBar);
  });
  
  chartContainer.appendChild(chartCanvas);
}

// Thiết lập phần thống kê
function setupStats() {
  // Lấy bộ lọc thống kê
  const statsFilter = document.getElementById('stats-period-filter');
  if (statsFilter) {
    // Thêm bộ lọc thời gian
    statsFilter.addEventListener('change', () => {
      fetchStats(statsFilter.value);
    });
  }
  
  // Thêm ID cho các phần tử thống kê
  const statValueElements = document.querySelectorAll('#stats-section .stat-value');
  const statTitles = ['total-sessions', 'completed-sessions', 'avg-response-time', 'avg-rating'];
  
  statValueElements.forEach((element, index) => {
    if (index < statTitles.length) {
      element.id = statTitles[index];
    }
  });
  
  // Thêm container cho thống kê nhân viên
  const statsCharts = document.querySelector('.stats-charts');
  if (statsCharts) {
    const staffStatsContainer = document.createElement('div');
    staffStatsContainer.id = 'staff-stats-container';
    staffStatsContainer.className = 'staff-stats-container';
    statsCharts.appendChild(staffStatsContainer);
  }
  
  // Tải dữ liệu thống kê ban đầu
  fetchStats('today');
}

// Hàm khởi tạo
function init() {
  // Kiểm tra token
  const token = getToken();
  if (!token) {
    showLogin();
  } else {
    // Xác thực token
    fetch('/api/auth/verify', {
      method: 'GET',
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
    .then(data => {
      currentUser = data;
      hideLogin();
      
      // Hiển thị tên nhân viên
      document.getElementById('staff-name').textContent = data.name || data.username;
      
      // Thiết lập các tab
      setupTabs();
      
      // Thiết lập cài đặt
      setupSettings();
      
      // Thiết lập thống kê
      setupStats();
      
      // Tải danh sách phiên hỗ trợ
      fetchSupportSessions();

      // Kết nối socket.io cho nhân viên
      connectSocket();

      // Thiết lập lọc phiên
      document.getElementById('session-filter').addEventListener('change', filterSessions);
    })
    .catch(error => {
      console.error('Lỗi xác thực:', error);
      showLogin();
    });
  }
}

// Hàm lấy token xác thực
function getToken() {
  return localStorage.getItem('auth_token');
}

// Kết nối socket.io
function connectSocket() {
  if (socket) {
    socket.disconnect();
  }
  
  const token = getToken();
  if (!token) return;
  
  socket = io({
    query: { token }
  });
  
  socket.on('connect', () => {
    console.log('Staff socket connected successfully');
    socket.emit('join-room', 'support-staff');
  });
  
  socket.on('new-support-request', (session) => {
    console.log('Received new support request:', session);
    
    // Phát âm thanh thông báo
    playNotificationSound('new-session');
    
    // Hiển thị thông báo desktop
    showDesktopNotification('Phiên chat mới', 'Có khách hàng mới cần hỗ trợ');
    
    // Thêm session mới vào danh sách
    if (!sessionList.some(s => s.id === session.id)) {
      sessionList.push(session);
      updateSessionsList();
      
      // Kiểm tra và gửi tin nhắn tự động nếu đã bật
      if (localStorage.getItem('auto-reply') === 'true') {
        sendAutoReply(session.id);
      }
    }
  });
  
  // Lắng nghe tin nhắn mới
  socket.on('new-message', (message) => {
    handleNewMessage(message);
  });
  
  // Lắng nghe đánh giá mới
  socket.on('new-rating', (data) => {
    console.log('Nhận đánh giá mới:', data);
    
    // Phát âm thanh thông báo
    playNotificationSound('notification');
    
    // Hiển thị thông báo desktop
    showDesktopNotification(
      'Đánh giá mới', 
      `Phiên ${data.sessionId.substring(0, 8)} đã được đánh giá ${data.rating}/5 sao`
    );
    
    // Hiển thị thông báo trong phiên chat hiện tại nếu đang mở
    if (data.sessionId === currentSessionId) {
      const ratingMessage = {
        id: 'rating-' + Date.now(),
        sessionId: data.sessionId,
        sender: 'system',
        content: `Khách hàng đã đánh giá phiên hỗ trợ: ${data.rating}/5 sao${data.feedback ? `. Góp ý: "${data.feedback}"` : ''}`,
        timestamp: new Date().toISOString()
      };
      
      appendMessage(ratingMessage);
      scrollToBottom();
    }
    
    // Cập nhật thẻ đánh giá trong danh sách phiên nếu có
    updateSessionWithRating(data.sessionId, data.rating);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
}

// Xử lý tin nhắn mới
function handleNewMessage(message) {
  console.log('Nhận tin nhắn mới qua socket:', message);
  
  // Thông báo khi có tin nhắn mới từ khách hàng
  if (message.sender === 'user') {
    // Phát âm thanh thông báo
    playNotificationSound('message');
    
    // Hiển thị thông báo desktop nếu không phải là phiên đang mở
    if (message.sessionId !== currentSessionId) {
      showDesktopNotification('Tin nhắn mới', 'Có tin nhắn mới từ khách hàng');
    }
  }
  
  // Kiểm tra xem tin nhắn có thuộc phiên hiện tại và có ID hợp lệ không
  if (!message || !message.id || !message.sessionId || message.sessionId !== currentSessionId) {
    return;
  }
  
  // 1. Kiểm tra xem tin nhắn này có phải là từ mình gửi đi không
  const isSelfMessage = message.sender === 'staff';
  
  // 2. Tìm tin nhắn tạm thời tương ứng
  const tempId = tempMessageMap.get(message.id);
  if (tempId) {
    console.log(`Đã tìm thấy tin nhắn tạm ${tempId} cho tin nhắn thật ${message.id}, chỉ cập nhật ID`);
    // Cập nhật ID
    const tempElement = document.querySelector(`.message-item[data-temp-ref="${message.id}"]`);
    if (tempElement) {
      tempElement.dataset.messageId = message.id;
      delete tempElement.dataset.tempRef;
      
      // Đánh dấu tin nhắn đã được xử lý
      receivedMessageIds.add(message.id);
      
      // Xóa khỏi map tạm thời
      tempMessageMap.delete(message.id);
      return;
    }
  }
  
  // 3. Kiểm tra xem tin nhắn đã hiển thị chưa
  if (receivedMessageIds.has(message.id)) {
    console.log(`Tin nhắn ${message.id} đã hiển thị trước đó, bỏ qua`);
    return;
  }
  
  // 4. Nếu là tin nhắn do mình gửi (staff) và không tìm thấy bản tạm, kiểm tra lần cuối
  if (isSelfMessage) {
    // Tìm tất cả tin nhắn của staff trong DOM để tránh trường hợp trùng lặp
    const existingStaffMessages = document.querySelectorAll('.message.staff.message-item');
    for (let msgElem of existingStaffMessages) {
      // Kiểm tra nội dung và thời gian để tránh hiển thị trùng lặp
      const contentElem = msgElem.querySelector('.content');
      if (contentElem && contentElem.textContent === message.content) {
        console.log(`Phát hiện tin nhắn staff trùng nội dung, bỏ qua: "${message.content}"`);
        receivedMessageIds.add(message.id);
        return;
      }
    }
  }
  
  // 5. Nếu là tin nhắn mới thật sự, thêm vào màn hình
  receivedMessageIds.add(message.id);
  appendMessage(message);
  scrollToBottom();
  
  // Cập nhật danh sách phiên với tin nhắn mới
  updateSessionWithNewMessage(message);
}

// Cập nhật phiên với đánh giá
function updateSessionWithRating(sessionId, rating) {
  // Tìm phiên trong danh sách
  const sessionIndex = sessionList.findIndex(s => s.id === sessionId);
  if (sessionIndex === -1) return;
  
  // Cập nhật đánh giá
  sessionList[sessionIndex].rating = rating;
  
  // Cập nhật danh sách phiên
  renderSessionList(sessionList);
  
  // Cập nhật chi tiết phiên nếu đang mở
  if (currentSessionId === sessionId) {
    updateSessionInfo(sessionId);
  }
}

// Hiển thị góp ý đánh giá gần đây
function displayRecentRatings(ratings) {
  const recentRatingsContainer = document.getElementById('recent-ratings');
  if (!recentRatingsContainer) return;
  
  if (!ratings || ratings.length === 0) {
    recentRatingsContainer.innerHTML = '<div class="empty-ratings">Chưa có đánh giá nào trong khoảng thời gian này</div>';
    return;
  }
  
  // Tạo bảng đánh giá
  const table = document.createElement('table');
  table.className = 'recent-ratings-table';
  
  // Tạo header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Thời gian</th>
      <th>Mã phiên</th>
      <th>Nhân viên</th>
      <th>Đánh giá</th>
      <th>Góp ý</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Tạo body
  const tbody = document.createElement('tbody');
  
  ratings.forEach(rating => {
    const row = document.createElement('tr');
    
    // Hiển thị thời gian định dạng đẹp
    const date = new Date(rating.timestamp);
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes() < 10 ? '0' : ''}${date.getMinutes()}`;
    
    // Tạo HTML cho stars
    let starsHtml = '<div class="rating-stars-small">';
    for (let i = 1; i <= 5; i++) {
      if (i <= rating.rating) {
        starsHtml += '<i class="fas fa-star"></i>';
      } else {
        starsHtml += '<i class="far fa-star"></i>';
      }
    }
    starsHtml += '</div>';
    
    // Tạo nội dung hàng
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${rating.sessionId}</td>
      <td>${rating.staffName || 'N/A'}</td>
      <td><div class="rating-cell">${starsHtml} (${rating.rating}/5)</div></td>
      <td class="rating-feedback">${rating.feedback || '-'}</td>
    `;
    
    // Thêm sự kiện click để hiển thị phiên
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      selectSession(rating.sessionId);
      
      // Chuyển đến tab chat
      const chatMenuItem = document.querySelector('.menu-item[data-section="chat"]');
      if (chatMenuItem) {
        chatMenuItem.click();
      }
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  recentRatingsContainer.innerHTML = '';
  recentRatingsContainer.appendChild(table);
}