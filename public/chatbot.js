class Chatbot {
  constructor() {
    this.sessionId = null;
    this.isMinimized = false;
    this.isTyping = false;
    this.isWithHuman = false;
    this.container = null;
    this.messagesContainer = null;
    this.socket = null;
    this.isInitialized = false;
    this.lastSentMessage = null;
    this.lastSentTimestamp = null;
    this.messages = []; // Mảng lưu trữ các tin nhắn
    
    // Khởi tạo giao diện
    this.initializeUI();
    
    // Khởi tạo session và WebSocket
    this.initialize();
  }
  
  async initialize() {
    try {
      // Khởi tạo session trước
      await this.initializeSession();
      
      // Sau khi có sessionId, khởi tạo WebSocket
      if (this.sessionId) {
        this.initializeWebSocket();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing chatbot:', error);
      this.addSystemMessage('Không thể khởi tạo chat. Vui lòng tải lại trang.');
    }
  }
  
  async initializeSession() {
    try {
      // Kiểm tra xem đã có sessionId trong localStorage chưa
      const savedSessionId = localStorage.getItem('chatbot_session_id');
      
      if (savedSessionId) {
        console.log('Restoring existing session:', savedSessionId);
        this.sessionId = savedSessionId;
        
        // Xác thực session còn hợp lệ không
        try {
          const sessionResponse = await fetch(`/api/chat/session/${this.sessionId}`);
          if (!sessionResponse.ok) {
            console.log('Saved session expired, creating new session');
            await this.createNewSession();
          } else {
            console.log('Existing session is valid');
            // Load tin nhắn cũ
            await this.loadMessages();
          }
        } catch (error) {
          console.error('Error validating existing session:', error);
          await this.createNewSession();
        }
      } else {
        // Tạo session mới nếu chưa có
        await this.createNewSession();
      }
    } catch (error) {
      console.error('Error initializing chat session:', error);
      throw error;
    }
  }
  
  async createNewSession() {
      const response = await fetch('/api/chat/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metadata: JSON.stringify({
            userAgent: navigator.userAgent,
            language: navigator.language,
            timestamp: new Date().toISOString()
          })
        })
      });
      
      if (!response.ok) {
      throw new Error('Failed to initialize chat session');
      }
      
      const session = await response.json();
      this.sessionId = session.id;
      
    // Lưu sessionId vào localStorage
    localStorage.setItem('chatbot_session_id', this.sessionId);
      
    // Load tin nhắn từ server
    await this.loadMessages();
    
    // Không thêm tin nhắn chào mừng ở đây vì tin nhắn chào mừng đã được thêm từ server
  }
  
  async loadMessages() {
    if (!this.sessionId) return;
    
    try {
      const messagesResponse = await fetch(`/api/chat/session/${this.sessionId}/messages`);
      
      if (!messagesResponse.ok) {
        const error = await messagesResponse.text();
        throw new Error(error || 'Failed to load messages');
      }
      
      const messages = await messagesResponse.json();
      
      // Xóa tin nhắn cũ
      this.messagesContainer.innerHTML = '';
      
      // Thêm tin nhắn vào giao diện
      messages.forEach(msg => {
        this.addMessage(msg.content, msg.sender);
      });
      
      // Cuộn xuống tin nhắn mới nhất
      this.scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
      this.addMessage('Không thể tải tin nhắn cũ.', 'bot');
    }
  }
  
  initializeUI() {
    // Xóa chatbot cũ nếu tồn tại
    const existingChatbot = document.getElementById('chatbot-root');
    if (existingChatbot) {
      existingChatbot.remove();
    }
    
    // Tạo container chính
    this.container = document.createElement('div');
    this.container.id = 'chatbot-root';
    
    // Tạo header
    const header = document.createElement('div');
    header.className = 'chat-header';
    header.innerHTML = `
      <h3>Trợ lý TectonicDevs</h3>
      <div class="controls">
        <button class="minimize-btn">−</button>
      </div>
    `;
    
    // Tạo container cho tin nhắn
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'chat-messages';
    
    // Tạo form nhập tin nhắn
    const inputContainer = document.createElement('div');
    inputContainer.className = 'chat-input';
    inputContainer.innerHTML = `
      <input type="text" placeholder="Nhập tin nhắn...">
      <button type="submit">Gửi</button>
    `;
    
    // Thêm các phần tử vào container chính
    this.container.appendChild(header);
    this.container.appendChild(this.messagesContainer);
    this.container.appendChild(inputContainer);
    
    // Thêm vào body
    document.body.appendChild(this.container);
    
    // Gán các sự kiện
    this.attachEventListeners();
    
    // Thêm CSS cho tin nhắn hệ thống và trạng thái
    const style = document.createElement('style');
    style.textContent = `
      .message.system {
        background: #f8f9fa;
        color: #6c757d;
        text-align: center;
        font-style: italic;
        padding: 5px 10px;
        margin: 10px 0;
        border-radius: 10px;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
        margin-left: 5px;
      }
      
      .status-indicator.online {
        background: #28a745;
      }
      
      .staff-typing-indicator {
        color: #6c757d;
        font-style: italic;
        padding: 5px 10px;
        margin: 5px 0;
      }
      
      .staff-typing-indicator.hidden {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }
  
  attachEventListeners() {
    // Sự kiện thu nhỏ chat
    const minimizeBtn = this.container.querySelector('.minimize-btn');
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });
    
    // Sự kiện mở rộng khi click vào header
    const header = this.container.querySelector('.chat-header');
    header.addEventListener('click', () => {
      if (this.isMinimized) {
        this.toggleMinimize();
      }
    });
    
    // Sự kiện gửi tin nhắn
    const input = this.container.querySelector('input');
    const sendBtn = this.container.querySelector('button[type="submit"]');
    
    const sendMessage = () => {
      const message = input.value.trim();
      if (message && !this.isTyping) {
        this.sendMessage(message);
        input.value = '';
      }
    };
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
  
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      this.container.classList.add('minimized');
    } else {
      this.container.classList.remove('minimized');
    }
  }
  
  addMessage(content, sender) {
    // Không hiển thị tin nhắn trống
    if (!content || content.trim() === '') {
      console.log('Skipping empty message');
      return;
    }
    
    // Kiểm tra tin nhắn trùng lặp với tin nhắn cuối cùng
    const lastMessage = this.messagesContainer.lastElementChild;
    if (lastMessage && 
        lastMessage.textContent === content && 
        lastMessage.className.includes(sender)) {
      console.log('Skipping duplicate consecutive message:', content);
      return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = content;
    
    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }
  
  addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    
    this.messagesContainer.appendChild(indicator);
    this.scrollToBottom();
    return indicator;
  }
  
  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  
  initializeWebSocket() {
    try {
      if (!this.sessionId) {
        console.error('Cannot initialize WebSocket: No session ID');
        return;
      }
      
      if (this.socket && this.socket.connected) {
        console.log('WebSocket already connected');
        return;
      }
      
      console.log('Initializing WebSocket connection...');
      this.socket = io({
        query: {
          sessionId: this.sessionId
        }
      });
      
      this.socket.on('connect', () => {
        console.log('WebSocket connected successfully');
        this.socket.emit('join-room', this.sessionId);
      });
      
      // Xử lý tin nhắn từ bot
      this.socket.on('bot_message', (data) => {
        console.log('Received bot message:', data);
        if (data.content && data.content.trim() !== '') {
          this.addMessage(data.content, 'bot');
        }
        
        if (data.requiresHumanSupport) {
          this.addSystemMessage('Đang kết nối với nhân viên hỗ trợ...');
        }
      });
      
      this.socket.on('new-message', (message) => {
        if (!message || !message.content) return;
        
        // Kiểm tra nếu tin nhắn đã được hiển thị (tránh trùng lặp với bot_message)
        if (message.sender === 'bot') {
          return; // Bỏ qua vì đã xử lý qua bot_message
        }
        
        if (message.sender === 'staff') {
          this.isWithHuman = true;
          this.addMessage(message.content, 'staff');
        } else if (message.sender === 'system') {
          this.addSystemMessage(message.content);
        }
      });
      
      this.socket.on('support-staff-joined', (data) => {
        console.log('Support staff joined:', data);
        this.isWithHuman = true;
        this.updateUIForHumanSupport();
        this.addSystemMessage('Nhân viên hỗ trợ đã tham gia cuộc trò chuyện.');
      });
      
      this.socket.on('support-ended', (data) => {
        console.log('Support ended:', data);
        this.isWithHuman = false;
        this.updateUIForBotSupport();
        this.addSystemMessage('Phiên hỗ trợ đã kết thúc.');
        
        // Hiển thị form đánh giá nếu cần
        if (data && data.shouldRate) {
          this.showRatingForm();
        }
      });
      
      this.socket.on('support_status', (data) => {
        console.log('Support status update:', data);
        if (data.message) {
          this.addSystemMessage(data.message);
        }
      });
      
      this.socket.on('staff-typing-status', (isTyping) => {
        const typingIndicator = this.messagesContainer.querySelector('.staff-typing-indicator');
        if (typingIndicator) {
          if (isTyping) {
            typingIndicator.classList.remove('hidden');
          } else {
            typingIndicator.classList.add('hidden');
          }
        }
      });
      
      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.addSystemMessage('Lỗi kết nối: ' + (error.message || 'Không xác định'));
      });
      
      // Thiết lập timeout cho kết nối
      setTimeout(() => {
        if (!this.socket.connected) {
          console.warn('WebSocket connection timeout, using HTTP fallback');
          this.socket.close();
        }
      }, 5000);
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      this.addSystemMessage('Không thể kết nối với server. Vui lòng tải lại trang.');
    }
  }
  
  updateUIForHumanSupport() {
    // Thay đổi giao diện khi có nhân viên hỗ trợ
    const header = this.container.querySelector('.chat-header h3');
    header.innerHTML = '<i class="fas fa-headset"></i> Nhân viên hỗ trợ';
    
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator online';
    header.appendChild(statusIndicator);
    
    // Thêm typing indicator cho nhân viên
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'staff-typing-indicator hidden';
    typingIndicator.textContent = 'Nhân viên đang nhập...';
    this.messagesContainer.appendChild(typingIndicator);
  }
  
  updateUIForBotSupport() {
    // Khôi phục giao diện bot
    const header = this.container.querySelector('.chat-header h3');
    header.innerHTML = '<i class="fas fa-robot"></i> Trợ lý TectonicDevs';
    
    const statusIndicator = this.container.querySelector('.status-indicator');
    if (statusIndicator) {
      statusIndicator.remove();
    }
    
    const typingIndicator = this.container.querySelector('.staff-typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
  
  addSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = content;
    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }
  
  async sendMessage(message) {
    if (!this.isInitialized || !this.sessionId) {
      this.addSystemMessage('Đang khởi tạo chat, vui lòng thử lại sau giây lát...');
      return;
    }
    
    // Ngăn chặn việc gửi tin nhắn trùng lặp
    if (this.lastSentMessage === message && Date.now() - this.lastSentTimestamp < 2000) {
      console.log('Preventing duplicate message send', message);
      return;
    }
    
    try {
      // Lưu thông tin về tin nhắn vừa gửi
      this.lastSentMessage = message;
      this.lastSentTimestamp = Date.now();
      
      // Thêm tin nhắn người dùng vào UI ngay lập tức
      this.addMessage(message, 'user');
      
      // Gửi tin nhắn qua WebSocket nếu có kết nối
      if (this.socket && this.socket.connected) {
        this.socket.emit('user_message', {
          sessionId: this.sessionId,
          message,
          timestamp: new Date().toISOString()
        });
      } else {
        // Hiển thị trạng thái đang gửi
        this.addSystemMessage('Đang gửi tin nhắn...');
        
        // Fallback to HTTP if WebSocket is not available
        const response = await fetch(`/api/chat/session/${this.sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
          sender: 'user'
        })
      });
      
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || 'Không thể gửi tin nhắn');
        }
        
        // Xóa thông báo đang gửi
        const systemMessages = this.messagesContainer.querySelectorAll('.message.system');
        systemMessages[systemMessages.length - 1]?.remove();
        
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        if (data.botMessage) {
          this.addMessage(data.botMessage.content, 'bot');
          if (data.botMessage.requiresHumanSupport) {
            this.addSystemMessage('Đang kết nối với nhân viên hỗ trợ...');
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Xóa thông báo đang gửi nếu có
      const systemMessages = this.messagesContainer.querySelectorAll('.message.system');
      systemMessages[systemMessages.length - 1]?.remove();
      
      // Thêm thông báo lỗi
      this.addSystemMessage(error.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
      
      // Thử kết nối lại WebSocket
      if (!this.socket?.connected) {
        this.initializeWebSocket();
      }
    }
  }
  
  // Hiển thị form đánh giá
  showRatingForm() {
    // Tạo container cho form đánh giá
    const ratingContainer = document.createElement('div');
    ratingContainer.className = 'rating-container';
    
    // HTML cho form đánh giá
    ratingContainer.innerHTML = `
      <div class="rating-header">
        <h4>Đánh giá phiên hỗ trợ</h4>
        <p>Vui lòng đánh giá trải nghiệm hỗ trợ của bạn</p>
      </div>
      <div class="rating-stars">
        <span class="star" data-rating="1">★</span>
        <span class="star" data-rating="2">★</span>
        <span class="star" data-rating="3">★</span>
        <span class="star" data-rating="4">★</span>
        <span class="star" data-rating="5">★</span>
      </div>
      <div class="rating-label">Chọn số sao</div>
      <textarea class="rating-feedback" placeholder="Góp ý thêm (không bắt buộc)..."></textarea>
      <button class="rating-submit-btn" disabled>Gửi đánh giá</button>
    `;
    
    // Thêm vào chat container
    this.messagesContainer.appendChild(ratingContainer);
    
    // Scroll xuống để hiển thị form đánh giá
    this.scrollToBottom();
    
    // Biến lưu rating được chọn
    let selectedRating = 0;
    
    // Xử lý sự kiện cho các ngôi sao
    const stars = ratingContainer.querySelectorAll('.star');
    const ratingLabel = ratingContainer.querySelector('.rating-label');
    const submitButton = ratingContainer.querySelector('.rating-submit-btn');
    
    // Labels cho các mức đánh giá
    const ratingLabels = [
      'Chọn số sao',
      'Không hài lòng',
      'Tạm được',
      'Bình thường',
      'Hài lòng',
      'Rất hài lòng'
    ];
    
    stars.forEach(star => {
      // Hover effect
      star.addEventListener('mouseover', () => {
        const rating = parseInt(star.getAttribute('data-rating'));
        this.updateStars(stars, rating, 'highlight');
        ratingLabel.textContent = ratingLabels[rating];
      });
      
      // Mouseout effect
      star.addEventListener('mouseout', () => {
        this.updateStars(stars, selectedRating, 'highlight'); 
        ratingLabel.textContent = selectedRating > 0 ? ratingLabels[selectedRating] : ratingLabels[0];
      });
      
      // Click to select rating
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.getAttribute('data-rating'));
        this.updateStars(stars, selectedRating, 'selected');
        ratingLabel.textContent = ratingLabels[selectedRating];
        submitButton.disabled = false;
      });
    });
    
    // Xử lý khi submit đánh giá
    submitButton.addEventListener('click', () => {
      if (selectedRating > 0) {
        const feedback = ratingContainer.querySelector('.rating-feedback').value;
        this.submitRating(selectedRating, feedback);
        ratingContainer.remove();
      }
    });
  }
  
  // Cập nhật hiển thị sao đánh giá
  updateStars(stars, rating, action) {
    stars.forEach(star => {
      const starRating = parseInt(star.getAttribute('data-rating'));
      
      if (action === 'highlight') {
        if (starRating <= rating) {
          star.classList.add('hover');
        } else {
          star.classList.remove('hover');
        }
      } else if (action === 'selected') {
        if (starRating <= rating) {
          star.classList.add('selected');
        } else {
          star.classList.remove('selected');
        }
      }
    });
  }
  
  // Gửi đánh giá lên server
  async submitRating(rating, feedback = '') {
    try {
      // Hiển thị thông báo đang gửi
      this.addSystemMessage('Đang gửi đánh giá...');
      
      // Gọi API để lưu đánh giá
      const response = await fetch(`/api/chat/session/${this.sessionId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating,
          feedback
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể gửi đánh giá');
      }
      
      const data = await response.json();
      
      // Hiển thị thông báo thành công
      this.addSystemMessage('Cảm ơn bạn đã đánh giá! Phản hồi của bạn giúp chúng tôi cải thiện dịch vụ.');
      
    } catch (error) {
      console.error('Error submitting rating:', error);
      this.addSystemMessage('Không thể gửi đánh giá: ' + (error.message || 'Lỗi không xác định'));
    }
  }
}

// Khởi tạo chatbot khi DOM đã load
document.addEventListener('DOMContentLoaded', () => {
  window.chatbot = new Chatbot();
}); 