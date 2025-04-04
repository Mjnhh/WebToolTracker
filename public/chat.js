// Xử lý hiển thị tin nhắn
function displayMessage(message, isUser = false) {
  // Không hiển thị tin nhắn trống
  if (!message.content && !message.content.trim()) {
    return;
  }

  const chatMessages = document.getElementById('chat-messages');
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  
  if (isUser) {
    messageElement.classList.add('user-message');
  } else {
    messageElement.classList.add('bot-message');
  }
  
  // Tạo nội dung tin nhắn
  messageElement.textContent = message.content;
  
  // Thêm tin nhắn vào container
  chatMessages.appendChild(messageElement);
  
  // Cuộn xuống để hiển thị tin nhắn mới nhất
  chatMessages.scrollTop = chatMessages.scrollHeight;
} 