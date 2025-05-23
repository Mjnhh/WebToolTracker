let authCheckDone = false; // Biến để theo dõi việc kiểm tra xác thực

document.addEventListener('DOMContentLoaded', function() {
  console.log("auth.js loaded");

  // Log để kiểm tra các phần tử
  console.log("Login form:", document.getElementById('login-form'));
  console.log("Register form:", document.getElementById('register-form'));
  console.log("Auth buttons:", document.querySelector('.auth-buttons'));

  // Kiểm tra xác thực một lần duy nhất
  if (!authCheckDone) {
    authCheckDone = true;
    checkAuthStatus();
  }

  // Xử lý form đăng nhập
  setupLoginForm();
  
  // Xử lý form đăng ký  
  setupRegisterForm();
});

function checkAuthStatus() {
  const token = localStorage.getItem('token');
  console.log("Checking auth with token:", token ? "Token exists" : "No token");
  
  if (!token) {
    console.log('No token found, user not logged in');
    showLoginButtons();
    return;
  }

  fetch('/api/auth/verify', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Not authenticated');
    }
  })
  .then(data => {
    console.log('Auth successful, user data:', data);
    updateAuthButtons(data);
    // Nếu đang ở trang login/register, chuyển về trang chính
    if (window.location.pathname === '/login.html' || 
        window.location.pathname === '/register.html') {
      window.location.href = '/coding-team-website.html';
    }
  })
  .catch(error => {
    console.log('Auth error:', error.message);
    // Xóa token nếu không hợp lệ
    localStorage.removeItem('token');
    showLoginButtons();
    
    // Chỉ chuyển hướng nếu đang ở trang yêu cầu xác thực
    const protectedPages = ['/admin/', '/staff/'];
    const isProtectedPage = protectedPages.some(page => window.location.pathname.startsWith(page));
    
    if (isProtectedPage) {
      window.location.href = '/login.html';
    }
  });
}

function showLoginButtons() {
  const authButtons = document.querySelector('.auth-buttons');
  if (authButtons) {
    authButtons.innerHTML = `
      <a href="login.html" class="login-btn" id="login-button" data-i18n="login">Đăng nhập</a>
      <a href="register.html" class="register-btn" id="register-button" data-i18n="register">Đăng ký</a>
    `;
  }
}

function addAuthStyles() {
  if (!document.getElementById('auth-styles')) {
    const style = document.createElement('style');
    style.id = 'auth-styles';
    style.textContent = `
      .user-greeting {
        color: white;
        font-weight: 500;
        margin-right: 15px;
        margin-left: 20px;
      }
      .profile-btn {
        color: #fff;
        background-color: #3498db;
        padding: 8px 16px;
        border-radius: 4px;
        text-decoration: none;
        font-size: 14px;
        margin-right: 10px;
        transition: background-color 0.3s;
      }
      .profile-btn:hover {
        background-color: #357bcb;
      }
      .logout-btn {
        color: #fff;
        background-color: #f44336;
        padding: 8px 16px;
        border-radius: 4px;
        text-decoration: none;
        font-size: 14px;
        transition: background-color 0.3s;
      }
      .logout-btn:hover {
        background-color: #d32f2f;
      }
    `;
    document.head.appendChild(style);
  }
}

function updateAuthButtons(data) {
  addAuthStyles();
  const authButtons = document.querySelector('.auth-buttons');
  if (authButtons) {
    const username = data.username || (data.user && data.user.username);
    if (!username) {
      console.error('Username not found in data:', data);
      return;
    }
    
    console.log('Updating auth buttons for user:', username);
    authButtons.innerHTML = `
      <div style="display: flex; align-items: center; margin-left: 20px;">
        <span class="user-greeting">Xin chào, ${username}</span>
        <a href="/profile" class="profile-btn" id="profile-button"><i class="fas fa-user-circle"></i> Hồ sơ</a>
        <a href="#" class="logout-btn" id="logout-button">Đăng xuất</a>
      </div>
    `;
    setupLogoutButton();
  } else {
    console.error('Auth buttons element not found');
  }
}

function setupLogoutButton() {
  document.getElementById('logout-button')?.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Remove token from localStorage
    localStorage.removeItem('token');
    
    // Dispatch event for chatbot to clear session
    window.dispatchEvent(new Event('user-auth-change'));
    
    // Reload page to update UI
    window.location.href = '/login.html';
  });
}

function setupLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      return response.json().then(data => {
        throw new Error(data.message || 'Đăng nhập thất bại');
      });
    })
    .then(data => {
      // Lưu token vào localStorage
      localStorage.setItem('token', data.token);
      
      // Dispatch event for chatbot to clear session
      window.dispatchEvent(new Event('user-auth-change'));
      
      // Chuyển hướng về trang chính
      window.location.href = '/coding-team-website.html';
    })
    .catch(error => {
      const errorElement = document.getElementById('login-error');
      if (errorElement) {
        errorElement.style.display = 'block';
        errorElement.querySelector('span').textContent = error.message;
      } else {
        alert('Lỗi đăng nhập: ' + error.message);
      }
    });
  });
}

function setupRegisterForm() {
  const registerForm = document.getElementById('register-form');
  if (!registerForm) return;

  registerForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name')?.value || username;

    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, name }),
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      return response.json().then(data => {
        throw new Error(data.message || 'Đăng ký thất bại');
      });
    })
    .then(data => {
      // Lưu token vào localStorage
      localStorage.setItem('token', data.token);
      // Chuyển hướng về trang chính
      window.location.href = '/coding-team-website.html';
    })
    .catch(error => {
      const errorElement = document.getElementById('register-error');
      if (errorElement) {
        errorElement.style.display = 'block';
        errorElement.querySelector('span').textContent = error.message;
      } else {
        alert('Lỗi đăng ký: ' + error.message);
      }
    });
  });
}
