document.addEventListener('DOMContentLoaded', function() {
  // Biến toàn cục
  let currentUser = null;
  let socket = null;

  // Kiểm tra token và tải thông tin người dùng
  checkAuth();

  // Thiết lập sự kiện cho các tab và nút
  setupTabs();
  setupButtons();
  
  // Thiết lập các modal
  setupModals();

  /**
   * Kiểm tra xác thực người dùng
   */
  function checkAuth() {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    
    if (!token) {
      console.log('Không tìm thấy token, chuyển hướng đến trang đăng nhập');
      window.location.href = '/login.html';
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
      
      // Cập nhật UI với thông tin người dùng
      updateProfileUI(userData);
      
      // Kết nối socket nếu cần
      initializeSocket();
      
      // Tải hoạt động gần đây
      loadRecentActivities();
    })
    .catch(error => {
      console.error('Lỗi xác thực:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      window.location.href = '/login.html';
    });
  }

  /**
   * Cập nhật UI với thông tin người dùng
   */
  function updateProfileUI(user) {
    // Cập nhật tên người dùng ở header
    document.getElementById('user-display-name').textContent = user.name || user.username;
    
    // Cập nhật thông tin trên trang hồ sơ
    document.getElementById('profile-name').textContent = user.name || user.username;
    document.getElementById('profile-role').textContent = `Quyền: ${translateRole(user.role) || 'Người dùng'}`;
    document.getElementById('profile-email').textContent = user.email || 'Chưa cập nhật email';
    
    // Cập nhật form
    document.getElementById('username').value = user.username;
    document.getElementById('name').value = user.name || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('role').value = translateRole(user.role) || 'Người dùng';
    
    // Hiển thị ngày tạo tài khoản
    const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
    document.getElementById('createdAt').value = formatDate(createdDate);
  }

  /**
   * Thiết lập sự kiện cho các tab
   */
  function setupTabs() {
    const tabs = document.querySelectorAll('.nav-menu li[data-tab]');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Xóa class active từ tất cả tab
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.querySelectorAll('.nav-menu li').forEach(item => {
          item.classList.remove('active');
        });
        
        // Thêm class active cho tab được chọn
        const tabId = this.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        this.classList.add('active');
      });
    });
  }

  /**
   * Thiết lập sự kiện cho các nút
   */
  function setupButtons() {
    // Nút đăng xuất
    document.getElementById('logout-btn').addEventListener('click', function() {
      logout();
    });
    
    // Nút chỉnh sửa hồ sơ
    document.getElementById('edit-profile-btn').addEventListener('click', function() {
      openEditProfileModal();
    });
    
    // Nút đăng xuất tất cả thiết bị khác
    document.getElementById('logout-all-btn').addEventListener('click', function() {
      logoutAllDevices();
    });
    
    // Form đổi mật khẩu
    document.getElementById('password-form').addEventListener('submit', function(e) {
      e.preventDefault();
      changePassword();
    });
  }

  /**
   * Thiết lập các modal
   */
  function setupModals() {
    // Đóng modal khi click vào nút X
    document.querySelectorAll('.modal .close').forEach(button => {
      button.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
      });
    });
    
    // Đóng modal khi click bên ngoài
    window.addEventListener('click', function(event) {
      if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
      }
    });
    
    // Nút lưu thông tin cá nhân
    document.getElementById('save-profile-btn').addEventListener('click', function() {
      saveProfile();
    });
  }

  /**
   * Mở modal chỉnh sửa thông tin cá nhân
   */
  function openEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    
    // Điền thông tin hiện tại vào form
    document.getElementById('edit-name').value = currentUser.name || '';
    document.getElementById('edit-email').value = currentUser.email || '';
    
    // Hiển thị modal
    modal.style.display = 'block';
  }

  /**
   * Lưu thông tin cá nhân
   */
  function saveProfile() {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    const userId = currentUser.id;
    
    const userData = {
      name: document.getElementById('edit-name').value,
      email: document.getElementById('edit-email').value
    };
    
    fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Cập nhật thông tin thất bại');
      }
      return response.json();
    })
    .then(updatedUser => {
      // Cập nhật thông tin người dùng hiện tại
      currentUser = { ...currentUser, ...updatedUser };
      
      // Cập nhật UI
      updateProfileUI(currentUser);
      
      // Đóng modal
      document.getElementById('edit-profile-modal').style.display = 'none';
      
      // Hiển thị thông báo
      alert('Cập nhật thông tin thành công!');
    })
    .catch(error => {
      console.error('Lỗi khi cập nhật thông tin:', error);
      alert('Có lỗi xảy ra khi cập nhật thông tin.');
    });
  }

  /**
   * Đổi mật khẩu
   */
  function changePassword() {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    const userId = currentUser.id;
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Kiểm tra mật khẩu mới và xác nhận mật khẩu
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    
    const passwordData = {
      currentPassword: currentPassword,
      newPassword: newPassword
    };
    
    fetch(`/api/users/${userId}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(passwordData)
    })
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Mật khẩu hiện tại không đúng');
        }
        throw new Error('Đổi mật khẩu thất bại');
      }
      return response.json();
    })
    .then(data => {
      // Reset form
      document.getElementById('password-form').reset();
      
      // Hiển thị thông báo
      alert('Đổi mật khẩu thành công!');
    })
    .catch(error => {
      console.error('Lỗi khi đổi mật khẩu:', error);
      alert(error.message || 'Có lỗi xảy ra khi đổi mật khẩu.');
    });
  }

  /**
   * Đăng xuất tất cả thiết bị khác
   */
  function logoutAllDevices() {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    
    fetch('/api/auth/logout-all', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Đăng xuất thất bại');
      }
      return response.json();
    })
    .then(data => {
      // Hiển thị thông báo
      alert('Đã đăng xuất tất cả thiết bị khác!');
    })
    .catch(error => {
      console.error('Lỗi khi đăng xuất thiết bị khác:', error);
      alert('Có lỗi xảy ra khi đăng xuất thiết bị khác.');
    });
  }

  /**
   * Đăng xuất
   */
  function logout() {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(() => {
      // Xóa token
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      
      // Chuyển hướng đến trang đăng nhập
      window.location.href = '/login.html';
    })
    .catch(error => {
      console.error('Lỗi khi đăng xuất:', error);
      
      // Nếu lỗi, vẫn đăng xuất cục bộ
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      window.location.href = '/login.html';
    });
  }

  /**
   * Tải hoạt động gần đây
   */
  function loadRecentActivities() {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    const userId = currentUser.id;
    
    // Hiển thị trạng thái tải
    document.getElementById('activity-list').innerHTML = `
      <div class="timeline-item">
        <div class="timeline-icon"><i class="fas fa-spinner fa-spin"></i></div>
        <div class="timeline-content">
          <p>Đang tải hoạt động...</p>
        </div>
        <div class="timeline-time">-</div>
      </div>
    `;
    
    // Trong phiên bản này, chúng ta sẽ hiển thị một số hoạt động mẫu
    // do API chưa được triển khai
    setTimeout(() => {
      const activities = [
        {
          type: 'login',
          message: 'Đăng nhập vào hệ thống',
          timestamp: new Date()
        },
        {
          type: 'profile',
          message: 'Cập nhật thông tin cá nhân',
          timestamp: new Date(Date.now() - 86400000) // 1 ngày trước
        },
        {
          type: 'password',
          message: 'Thay đổi mật khẩu',
          timestamp: new Date(Date.now() - 3 * 86400000) // 3 ngày trước
        }
      ];
      
      displayActivities(activities);
    }, 1000);
  }

  /**
   * Hiển thị hoạt động
   */
  function displayActivities(activities) {
    const activityList = document.getElementById('activity-list');
    activityList.innerHTML = '';
    
    if (activities.length === 0) {
      activityList.innerHTML = `
        <div class="timeline-item">
          <div class="timeline-icon"><i class="fas fa-info-circle"></i></div>
          <div class="timeline-content">
            <p>Không có hoạt động nào gần đây.</p>
          </div>
          <div class="timeline-time">-</div>
        </div>
      `;
      return;
    }
    
    activities.forEach(activity => {
      const icon = getActivityIcon(activity.type);
      const timeAgo = formatTimeAgo(activity.timestamp);
      
      const activityItem = document.createElement('div');
      activityItem.className = 'timeline-item';
      activityItem.innerHTML = `
        <div class="timeline-icon"><i class="${icon}"></i></div>
        <div class="timeline-content">
          <p>${activity.message}</p>
        </div>
        <div class="timeline-time">${timeAgo}</div>
      `;
      
      activityList.appendChild(activityItem);
    });
  }

  /**
   * Khởi tạo kết nối socket
   */
  function initializeSocket() {
    if (!socket) {
      socket = io();
      
      // Xử lý sự kiện kết nối
      socket.on('connect', function() {
        console.log('Đã kết nối đến server qua Socket.IO');
        
        // Xác thực với server
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        if (token) {
          socket.emit('authenticate', { token });
        }
      });
      
      // Xử lý sự kiện ngắt kết nối
      socket.on('disconnect', function() {
        console.log('Đã ngắt kết nối khỏi server');
      });
      
      // Xử lý thông báo từ server
      socket.on('notification', function(data) {
        console.log('Nhận thông báo mới:', data);
        // Hiển thị thông báo nếu cần
      });
    }
  }

  /**
   * Hàm tiện ích
   */
  function translateRole(role) {
    switch (role) {
      case 'admin': return 'Quản trị viên';
      case 'staff': return 'Nhân viên';
      case 'user': return 'Người dùng';
      default: return 'Người dùng';
    }
  }

  function formatDate(date) {
    if (!date) return 'N/A';
    
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatTimeAgo(date) {
    if (!date) return 'N/A';
    
    const now = new Date();
    const diff = now - new Date(date);
    
    // Đổi thành số giây
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return 'Vừa xong';
    }
    
    // Đổi thành số phút
    const minutes = Math.floor(seconds / 60);
    
    if (minutes < 60) {
      return `${minutes} phút trước`;
    }
    
    // Đổi thành số giờ
    const hours = Math.floor(minutes / 60);
    
    if (hours < 24) {
      return `${hours} giờ trước`;
    }
    
    // Đổi thành số ngày
    const days = Math.floor(hours / 24);
    
    if (days < 30) {
      return `${days} ngày trước`;
    }
    
    // Nếu quá lâu thì hiển thị ngày tháng
    return formatDate(date);
  }

  function getActivityIcon(type) {
    switch (type) {
      case 'login': return 'fas fa-sign-in-alt';
      case 'logout': return 'fas fa-sign-out-alt';
      case 'profile': return 'fas fa-user-edit';
      case 'password': return 'fas fa-key';
      default: return 'fas fa-info-circle';
    }
  }
}); 