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
    // Hiển thị thông báo đang xử lý
    document.getElementById('change-password-btn').textContent = 'Đang xử lý...';
    document.getElementById('change-password-btn').disabled = true;
    
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
    const userId = currentUser.id;
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Kiểm tra mật khẩu mới 
    if (!newPassword || newPassword.length < 6) {
      alert('Mật khẩu mới phải có ít nhất 6 ký tự.');
      resetChangePasswordButton();
      return;
    }
    
    // Kiểm tra mật khẩu mới và xác nhận mật khẩu
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      resetChangePasswordButton();
      return;
    }
    
    const passwordData = {
      currentPassword: currentPassword,
      newPassword: newPassword
    };

    console.log(`Đang gửi yêu cầu đổi mật khẩu đến: /api/users/${userId}/change-password`);
    
    fetch(`/api/users/${userId}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(passwordData)
    })
    .then(response => {
      console.log('Nhận phản hồi:', response.status);
      if (response.status === 401) {
        throw new Error('Mật khẩu hiện tại không đúng');
      } else if (response.status === 403) {
        throw new Error('Không có quyền đổi mật khẩu');
      } else if (response.status === 400) {
        return response.json().then(data => {
          throw new Error(data.message || 'Dữ liệu không hợp lệ');
        });
      } else if (!response.ok) {
        throw new Error('Có lỗi khi đổi mật khẩu (Mã: ' + response.status + ')');
      }
      return response.json();
    })
    .then(data => {
      // Reset form
      document.getElementById('password-form').reset();
      
      // Hiển thị thông báo
      alert('Đổi mật khẩu thành công!');
      resetChangePasswordButton();
    })
    .catch(error => {
      console.error('Lỗi khi đổi mật khẩu:', error);
      alert('Lỗi: ' + (error.message || 'Có lỗi không xác định khi đổi mật khẩu.'));
      resetChangePasswordButton();
    });
    
    function resetChangePasswordButton() {
      document.getElementById('change-password-btn').textContent = 'Cập nhật mật khẩu';
      document.getElementById('change-password-btn').disabled = false;
    }
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

  /**
   * Format ngày tháng (vd: 01/01/2023)
   */
  function formatDate(date) {
    if (!date) return 'N/A';
    
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  }
}); 