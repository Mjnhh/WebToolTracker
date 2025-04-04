document.addEventListener('DOMContentLoaded', function() {
  // Kiểm tra quyền admin trước khi hiển thị trang
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Xác thực với token
  fetch('/api/auth/verify', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      window.location.href = '/login.html';
      throw new Error('Not authenticated');
    }
  })
  .then(data => {
    // Sửa lại cách kiểm tra dữ liệu user trong phản hồi
    // Lấy user data trực tiếp từ phản hồi vì API trả về data
    const user = data;
    
    if (user.role !== 'admin') {
      alert('Bạn không có quyền truy cập trang quản trị');
      window.location.href = '/coding-team-website.html';
      throw new Error('Not authorized');
    }
    
    // Hiển thị tên admin
    document.getElementById('admin-name').textContent = user.name || user.username;
    
    // Tải dữ liệu cho dashboard
    loadDashboardData();
    
    // Tab handling
    setupTabNavigation();
    
    // Logout handler
    setupLogout();
    
    // Modal handlers
    setupModals();

    // Initialize pattern management
    setupPatternModal();
    
    // Load patterns when tab is selected
    document.querySelector('[data-tab="chatbot-tab"]').addEventListener('click', function() {
      loadPatterns();
    });

    // Close modal when clicking outside
    const patternModal = document.getElementById('pattern-modal');
    window.addEventListener('click', function(event) {
      if (event.target === patternModal) {
        patternModal.style.display = 'none';
      }
    });

    // Close modal when clicking close button
    document.querySelector('#pattern-modal .close').addEventListener('click', function() {
      document.getElementById('pattern-modal').style.display = 'none';
    });
  })
  .catch(error => {
    console.error('Authentication error:', error);
  });

  // Chức năng chuyển đổi tab
  function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-menu li[data-tab]');
    
    navItems.forEach(item => {
      item.addEventListener('click', function() {
        // Xóa class active từ tất cả tab và navItems
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        navItems.forEach(navItem => navItem.classList.remove('active'));
        
        // Thêm class active cho tab được chọn
        const tabId = this.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        this.classList.add('active');
        
        // Tải dữ liệu cho tab được chọn
        if (tabId === 'users-tab') {
          loadUsers();
        } else if (tabId === 'inquiries-tab') {
          loadInquiries();
        } else if (tabId === 'endpoints-tab') {
          loadEndpoints();
        }
      });
    });
  }

  // Chức năng đăng xuất
  function setupLogout() {
    document.getElementById('logout-btn').addEventListener('click', function(e) {
      e.preventDefault();
      
      // Xóa token khỏi localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      
      // Chuyển hướng về trang đăng nhập
      window.location.href = '/login.html';
    });
  }

  // Thiết lập các modal
  function setupModals() {
    // Đóng modal khi bấm nút X hoặc bên ngoài modal
    const closeButtons = document.querySelectorAll('.modal .close');
    closeButtons.forEach(button => {
      button.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
      });
    });
    
    // Đóng modal khi click bên ngoài
    window.addEventListener('click', function(event) {
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
    
    // Modal xử lý inquiry
    setupInquiryModal();
    
    // Modal xử lý endpoint
    setupEndpointModal();
  }

  // Tải dữ liệu dashboard
  function loadDashboardData() {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    // Tải số lượng người dùng
    fetch('/api/admin/users', {
      headers: authHeader
    })
    .then(response => response.json())
    .then(users => {
      document.getElementById('user-count').textContent = users.length;
    })
    .catch(error => {
      console.error('Error loading users:', error);
    });
    
    // Tải số lượng liên hệ (inquiries)
    fetch('/api/admin/inquiries', {
      headers: authHeader
    })
    .then(response => response.json())
    .then(inquiries => {
      document.getElementById('inquiry-count').textContent = inquiries.length;
      
      // Hiển thị 5 liên hệ gần nhất
      const recentInquiriesTable = document.getElementById('recent-inquiries-table');
      recentInquiriesTable.innerHTML = '';
      
      const recentInquiries = inquiries.slice(0, 5);
      
      if (recentInquiries.length === 0) {
        recentInquiriesTable.innerHTML = '<tr><td colspan="5" class="no-data">Không có dữ liệu liên hệ</td></tr>';
      } else {
        recentInquiries.forEach(inquiry => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${inquiry.id}</td>
            <td>${inquiry.name}</td>
            <td>${inquiry.email}</td>
            <td class="truncate">${inquiry.subject}</td>
            <td>
              <span class="status-badge status-${inquiry.status}">
                ${getStatusText(inquiry.status)}
              </span>
            </td>
          `;
          recentInquiriesTable.appendChild(row);
        });
      }
    })
    .catch(error => {
      console.error('Error loading inquiries:', error);
    });
    
    // Tải số lượng endpoints
    fetch('/api/admin/endpoints', {
      headers: authHeader
    })
    .then(response => response.json())
    .then(endpoints => {
      document.getElementById('endpoint-count').textContent = endpoints.length;
    })
    .catch(error => {
      console.error('Error loading endpoints:', error);
    });
  }

  // Tải danh sách người dùng
  function loadUsers() {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    const usersTable = document.getElementById('users-table');
    usersTable.innerHTML = '<tr><td colspan="6" class="no-data">Đang tải dữ liệu...</td></tr>';
    
    fetch('/api/admin/users', {
      headers: authHeader
    })
    .then(response => response.json())
    .then(users => {
      usersTable.innerHTML = '';
      
      if (users.length === 0) {
        usersTable.innerHTML = '<tr><td colspan="6" class="no-data">Không có dữ liệu người dùng</td></tr>';
      } else {
        users.forEach(user => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.name || ''}</td>
            <td>${user.role || 'user'}</td>
            <td class="action-buttons">
              <button class="edit-btn btn-primary" data-id="${user.id}"><i class="fas fa-edit"></i> Sửa</button>
              <button class="delete-btn btn-danger" data-id="${user.id}"><i class="fas fa-trash-alt"></i> Xóa</button>
            </td>
          `;
          usersTable.appendChild(row);
        });
      }
    })
    .catch(error => {
      console.error('Error loading users:', error);
      usersTable.innerHTML = '<tr><td colspan="6" class="no-data">Lỗi khi tải dữ liệu</td></tr>';
    });
  }

  // Tải danh sách liên hệ
  function loadInquiries(filter = 'all') {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    const inquiriesTable = document.getElementById('inquiries-table');
    inquiriesTable.innerHTML = '<tr><td colspan="9" class="no-data">Đang tải dữ liệu...</td></tr>';
    
    fetch('/api/admin/inquiries', {
      headers: authHeader
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(inquiries => {
      inquiriesTable.innerHTML = '';
      
      // Lọc các inquiries theo filter
      let filteredInquiries = inquiries;
      if (filter !== 'all') {
        filteredInquiries = inquiries.filter(inquiry => inquiry.status === filter);
      }
      
      if (filteredInquiries.length === 0) {
        inquiriesTable.innerHTML = '<tr><td colspan="9" class="no-data">Không có dữ liệu liên hệ</td></tr>';
      } else {
        filteredInquiries.forEach(inquiry => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${inquiry.id}</td>
            <td>${inquiry.name}</td>
            <td>${inquiry.email}</td>
            <td>${inquiry.phone || 'N/A'}</td>
            <td class="truncate">${inquiry.subject}</td>
            <td class="truncate">${inquiry.message}</td>
            <td>
              <span class="status-badge status-${inquiry.status}">
                ${getStatusText(inquiry.status)}
              </span>
            </td>
            <td>${formatDate(inquiry.createdAt)}</td>
            <td class="action-buttons">
              <button class="view-btn btn-primary" data-id="${inquiry.id}"><i class="fas fa-eye"></i> Xem</button>
              <button class="delete-btn btn-danger" data-id="${inquiry.id}"><i class="fas fa-trash-alt"></i> Xóa</button>
            </td>
          `;
          inquiriesTable.appendChild(row);
        });
        
        // Xử lý sự kiện cho các nút
        setupInquiryButtons();
      }
    })
    .catch(error => {
      console.error('Error loading inquiries:', error);
      inquiriesTable.innerHTML = '<tr><td colspan="9" class="no-data">Lỗi khi tải dữ liệu: Không thể kết nối đến máy chủ hoặc token hết hạn</td></tr>';
    });
    
    // Thiết lập bộ lọc trạng thái
    const filterSelect = document.getElementById('inquiry-status-filter');
    if (!filterSelect.hasEventListener) {
      filterSelect.addEventListener('change', function() {
        loadInquiries(this.value);
      });
      filterSelect.hasEventListener = true;
    }
  }

  // Tải danh sách endpoints
  function loadEndpoints() {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    const endpointsTable = document.getElementById('endpoints-table');
    endpointsTable.innerHTML = '<tr><td colspan="8" class="no-data">Đang tải dữ liệu...</td></tr>';
    
    fetch('/api/admin/endpoints', {
      headers: authHeader
    })
    .then(response => response.json())
    .then(endpoints => {
      endpointsTable.innerHTML = '';
      
      if (endpoints.length === 0) {
        endpointsTable.innerHTML = '<tr><td colspan="8" class="no-data">Không có dữ liệu endpoints</td></tr>';
      } else {
        endpoints.forEach(endpoint => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${endpoint.id}</td>
            <td>${endpoint.name}</td>
            <td>
              <span class="status-badge ${getMethodClass(endpoint.method)}">
                ${endpoint.method}
              </span>
            </td>
            <td class="truncate">${endpoint.path}</td>
            <td class="truncate">${endpoint.description || 'N/A'}</td>
            <td>${endpoint.authRequired ? 'Có' : 'Không'}</td>
            <td>
              <span class="status-badge ${endpoint.isActive ? 'status-active' : 'status-inactive'}">
                ${endpoint.isActive ? 'Hoạt động' : 'Không hoạt động'}
              </span>
            </td>
            <td>
              <button class="action-btn edit-btn" data-id="${endpoint.id}">Sửa</button>
              <button class="action-btn delete-btn" data-id="${endpoint.id}">Xóa</button>
            </td>
          `;
          endpointsTable.appendChild(row);
        });
        
        // Add event listeners to buttons
        const editButtons = document.querySelectorAll('#endpoints-table .edit-btn');
        editButtons.forEach(button => {
          button.addEventListener('click', function() {
            const endpointId = this.getAttribute('data-id');
            openEndpointModal('edit', endpointId);
          });
        });
        
        const deleteButtons = document.querySelectorAll('#endpoints-table .delete-btn');
        deleteButtons.forEach(button => {
          button.addEventListener('click', function() {
            const endpointId = this.getAttribute('data-id');
            deleteEndpoint(endpointId);
          });
        });
      }
    })
    .catch(error => {
      console.error('Error loading endpoints:', error);
      endpointsTable.innerHTML = '<tr><td colspan="8" class="no-data">Lỗi khi tải dữ liệu</td></tr>';
    });
    
    // Setup add button handler
    document.getElementById('add-endpoint-btn').addEventListener('click', function() {
      openEndpointModal('add');
    });
  }

  // Thiết lập modal xử lý inquiry
  function setupInquiryModal() {
    // Update inquiry status
    document.getElementById('update-inquiry-btn').addEventListener('click', function() {
      const inquiryId = this.getAttribute('data-id');
      const newStatus = document.getElementById('modal-status').value;
      
      const token = localStorage.getItem('token');
      const authHeader = { 'Authorization': `Bearer ${token}` };
      
      fetch(`/api/admin/inquiries/${inquiryId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ status: newStatus }),
      })
      .then(response => {
        if (response.ok) {
          alert('Cập nhật trạng thái thành công!');
          document.getElementById('inquiry-modal').style.display = 'none';
          loadInquiries();
          loadDashboardData(); // Reload dashboard data
        } else {
          throw new Error('Update failed');
        }
      })
      .catch(error => {
        console.error('Error updating inquiry:', error);
        alert('Có lỗi xảy ra khi cập nhật trạng thái.');
      });
    });
    
    // Delete inquiry
    document.getElementById('delete-inquiry-btn').addEventListener('click', function() {
      if (confirm('Bạn có chắc chắn muốn xóa liên hệ này không?')) {
        const inquiryId = this.getAttribute('data-id');
        
        const token = localStorage.getItem('token');
        const authHeader = { 'Authorization': `Bearer ${token}` };
        
        fetch(`/api/admin/inquiries/${inquiryId}`, {
          method: 'DELETE',
          headers: {
            ...authHeader
          }
        })
        .then(response => {
          if (response.ok) {
            alert('Xóa liên hệ thành công!');
            document.getElementById('inquiry-modal').style.display = 'none';
            loadInquiries();
            loadDashboardData(); // Reload dashboard data
          } else {
            throw new Error('Delete failed');
          }
        })
        .catch(error => {
          console.error('Error deleting inquiry:', error);
          alert('Có lỗi xảy ra khi xóa liên hệ.');
        });
      }
    });
  }

  // Thêm hàm xử lý các nút trong bảng liên hệ
  function setupInquiryButtons() {
    // Xử lý nút xem chi tiết
    const viewButtons = document.querySelectorAll('#inquiries-table .view-btn');
    viewButtons.forEach(button => {
      button.addEventListener('click', function() {
        const inquiryId = this.getAttribute('data-id');
        const token = localStorage.getItem('token');
        const authHeader = { 'Authorization': `Bearer ${token}` };
        
        // Mở modal chi tiết liên hệ
        fetch(`/api/admin/inquiries/${inquiryId}`, {
          headers: authHeader
        })
        .then(response => response.json())
        .then(inquiry => {
          // Populate modal with inquiry data
          document.getElementById('modal-name').textContent = inquiry.name;
          document.getElementById('modal-email').textContent = inquiry.email;
          document.getElementById('modal-phone').textContent = inquiry.phone || 'N/A';
          document.getElementById('modal-subject').textContent = inquiry.subject;
          document.getElementById('modal-message').textContent = inquiry.message;
          document.getElementById('modal-status').value = inquiry.status;
          
          // Show modal
          const modal = document.getElementById('inquiry-modal');
          modal.style.display = 'block';
          
          // Set up update button
          const updateButton = document.getElementById('update-inquiry-btn');
          updateButton.setAttribute('data-id', inquiryId);
          
          // Set up delete button
          const deleteButton = document.getElementById('delete-inquiry-btn');
          deleteButton.setAttribute('data-id', inquiryId);
        })
        .catch(error => {
          console.error('Error loading inquiry details:', error);
          alert('Có lỗi xảy ra khi tải thông tin chi tiết.');
        });
      });
    });
    
    // Xử lý nút xóa
    const deleteButtons = document.querySelectorAll('#inquiries-table .delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', function() {
        const inquiryId = this.getAttribute('data-id');
        if (confirm('Bạn có chắc chắn muốn xóa liên hệ này không?')) {
          const token = localStorage.getItem('token');
          const authHeader = { 'Authorization': `Bearer ${token}` };
          
          fetch(`/api/admin/inquiries/${inquiryId}`, {
            method: 'DELETE',
            headers: authHeader
          })
          .then(response => {
            if (response.ok) {
              alert('Xóa liên hệ thành công!');
              loadInquiries(); // Tải lại danh sách
              loadDashboardData(); // Cập nhật dashboard
            } else {
              throw new Error('Delete failed');
            }
          })
          .catch(error => {
            console.error('Error deleting inquiry:', error);
            alert('Có lỗi xảy ra khi xóa liên hệ.');
          });
        }
      });
    });
  }

  // Mở modal endpoint (thêm/sửa)
  function openEndpointModal(mode, endpointId) {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    const modal = document.getElementById('endpoint-modal');
    const modalTitle = document.getElementById('endpoint-modal-title');
    
    if (mode === 'add') {
      modalTitle.textContent = 'Thêm API Endpoint';
      
      // Reset form fields
      document.getElementById('endpoint-id').value = '';
      document.getElementById('endpoint-name').value = '';
      document.getElementById('endpoint-method').value = 'GET';
      document.getElementById('endpoint-path').value = '';
      document.getElementById('endpoint-description').value = '';
      document.getElementById('endpoint-auth-required').checked = false;
      document.getElementById('endpoint-active').checked = true;
      
      modal.style.display = 'block';
    } else if (mode === 'edit') {
      modalTitle.textContent = 'Sửa API Endpoint';
      
      fetch(`/api/admin/endpoints/${endpointId}`, {
        headers: authHeader
      })
      .then(response => response.json())
      .then(endpoint => {
        // Populate form fields
        document.getElementById('endpoint-id').value = endpoint.id;
        document.getElementById('endpoint-name').value = endpoint.name;
        document.getElementById('endpoint-method').value = endpoint.method;
        document.getElementById('endpoint-path').value = endpoint.path;
        document.getElementById('endpoint-description').value = endpoint.description || '';
        document.getElementById('endpoint-auth-required').checked = endpoint.authRequired;
        document.getElementById('endpoint-active').checked = endpoint.isActive;
        
        modal.style.display = 'block';
      })
      .catch(error => {
        console.error('Error loading endpoint details:', error);
        alert('Có lỗi xảy ra khi tải thông tin endpoint.');
      });
    }
  }

  // Thiết lập modal xử lý endpoint
  function setupEndpointModal() {
    document.getElementById('save-endpoint-btn').addEventListener('click', function() {
      const token = localStorage.getItem('token');
      const authHeader = { 'Authorization': `Bearer ${token}` };
      
      const endpointId = document.getElementById('endpoint-id').value;
      const isEdit = endpointId !== '';
      
      const endpointData = {
        name: document.getElementById('endpoint-name').value,
        method: document.getElementById('endpoint-method').value,
        path: document.getElementById('endpoint-path').value,
        description: document.getElementById('endpoint-description').value,
        authRequired: document.getElementById('endpoint-auth-required').checked,
        isActive: document.getElementById('endpoint-active').checked
      };
      
      // Validate form
      if (!endpointData.name || !endpointData.path) {
        alert('Vui lòng điền đầy đủ thông tin bắt buộc.');
        return;
      }
      
      const method = isEdit ? 'PATCH' : 'POST';
      const url = isEdit ? `/api/admin/endpoints/${endpointId}` : '/api/admin/endpoints';
      
      fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify(endpointData),
      })
      .then(response => {
        if (response.ok) {
          alert(isEdit ? 'Cập nhật endpoint thành công!' : 'Thêm endpoint thành công!');
          document.getElementById('endpoint-modal').style.display = 'none';
          loadEndpoints();
          loadDashboardData(); // Reload dashboard data
        } else {
          throw new Error(isEdit ? 'Update failed' : 'Create failed');
        }
      })
      .catch(error => {
        console.error('Error saving endpoint:', error);
        alert('Có lỗi xảy ra khi lưu endpoint.');
      });
    });
  }

  // Xóa endpoint
  function deleteEndpoint(endpointId) {
    if (confirm('Bạn có chắc chắn muốn xóa endpoint này không?')) {
      const token = localStorage.getItem('token');
      const authHeader = { 'Authorization': `Bearer ${token}` };
      
      fetch(`/api/admin/endpoints/${endpointId}`, {
        method: 'DELETE',
        headers: {
          ...authHeader
        }
      })
      .then(response => {
        if (response.ok) {
          alert('Xóa endpoint thành công!');
          loadEndpoints();
          loadDashboardData(); // Reload dashboard data
        } else {
          throw new Error('Delete failed');
        }
      })
      .catch(error => {
        console.error('Error deleting endpoint:', error);
        alert('Có lỗi xảy ra khi xóa endpoint.');
      });
    }
  }

  // Utils
  function getStatusText(status) {
    switch (status) {
      case 'unread': return 'Chưa đọc';
      case 'in-progress': return 'Đang xử lý';
      case 'resolved': return 'Đã giải quyết';
      default: return status;
    }
  }

  function getMethodClass(method) {
    switch (method) {
      case 'GET': return 'status-resolved';
      case 'POST': return 'status-in-progress';
      case 'PUT': 
      case 'PATCH': return 'status-in-progress';
      case 'DELETE': return 'status-unread';
      default: return '';
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Tải danh sách mẫu câu chatbot
  function loadPatterns() {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    const patternsTable = document.getElementById('patterns-table');
    patternsTable.innerHTML = '<tr><td colspan="4" class="no-data">Đang tải dữ liệu...</td></tr>';
    
    fetch('/api/admin/chatbot/patterns', {
      headers: authHeader
    })
    .then(response => response.json())
    .then(patterns => {
      patternsTable.innerHTML = '';
      
      if (patterns.length === 0) {
        patternsTable.innerHTML = '<tr><td colspan="4" class="no-data">Không có dữ liệu mẫu câu</td></tr>';
      } else {
        patterns.forEach(pattern => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${pattern.pattern}</td>
            <td class="truncate">${pattern.response}</td>
            <td>${pattern.score.toFixed(2)}</td>
            <td>
              <button class="action-btn edit-pattern" data-pattern="${pattern.pattern}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn delete-btn delete-pattern" data-pattern="${pattern.pattern}">
                <i class="fas fa-trash"></i>
              </button>
              <button class="action-btn score-up" data-pattern="${pattern.pattern}">
                <i class="fas fa-thumbs-up"></i>
              </button>
              <button class="action-btn score-down" data-pattern="${pattern.pattern}">
                <i class="fas fa-thumbs-down"></i>
              </button>
            </td>
          `;
          patternsTable.appendChild(row);
        });
        
        // Add event listeners
        const editButtons = document.querySelectorAll('.edit-pattern');
        editButtons.forEach(button => {
          button.addEventListener('click', function() {
            const pattern = this.getAttribute('data-pattern');
            openPatternModal('edit', pattern);
          });
        });
        
        const deleteButtons = document.querySelectorAll('.delete-pattern');
        deleteButtons.forEach(button => {
          button.addEventListener('click', function() {
            const pattern = this.getAttribute('data-pattern');
            deletePattern(pattern);
          });
        });
        
        const scoreUpButtons = document.querySelectorAll('.score-up');
        scoreUpButtons.forEach(button => {
          button.addEventListener('click', function() {
            const pattern = this.getAttribute('data-pattern');
            updatePatternScore(pattern, 0.1);
          });
        });
        
        const scoreDownButtons = document.querySelectorAll('.score-down');
        scoreDownButtons.forEach(button => {
          button.addEventListener('click', function() {
            const pattern = this.getAttribute('data-pattern');
            updatePatternScore(pattern, -0.1);
          });
        });
      }
    })
    .catch(error => {
      console.error('Error loading patterns:', error);
      patternsTable.innerHTML = '<tr><td colspan="4" class="error">Lỗi khi tải dữ liệu</td></tr>';
    });
    
    // Setup add button handler
    document.getElementById('add-pattern-btn').addEventListener('click', function() {
      openPatternModal('add');
    });
  }

  // Mở modal pattern (thêm/sửa)
  function openPatternModal(mode, pattern) {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    const modal = document.getElementById('pattern-modal');
    const modalTitle = modal.querySelector('h2');
    const patternInput = document.getElementById('pattern-input');
    const responseInput = document.getElementById('response-input');
    
    if (mode === 'add') {
      modalTitle.textContent = 'Thêm mẫu câu mới';
      patternInput.value = '';
      responseInput.value = '';
    } else if (mode === 'edit') {
      modalTitle.textContent = 'Sửa mẫu câu';
      
      fetch(`/api/admin/chatbot/patterns/${encodeURIComponent(pattern)}`, {
        headers: authHeader
      })
      .then(response => response.json())
      .then(data => {
        patternInput.value = data.pattern;
        responseInput.value = data.response;
      })
      .catch(error => {
        console.error('Error loading pattern details:', error);
        alert('Có lỗi xảy ra khi tải thông tin mẫu câu.');
      });
    }
    
    modal.style.display = 'block';
  }

  // Lưu mẫu câu
  function savePattern() {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    const pattern = document.getElementById('pattern-input').value;
    const response = document.getElementById('response-input').value;
    
    if (!pattern || !response) {
      alert('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    
    fetch('/api/admin/chatbot/patterns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader
      },
      body: JSON.stringify({ pattern, response }),
    })
    .then(response => {
      if (response.ok) {
        alert('Lưu mẫu câu thành công!');
        document.getElementById('pattern-modal').style.display = 'none';
        loadPatterns();
      } else {
        throw new Error('Save failed');
      }
    })
    .catch(error => {
      console.error('Error saving pattern:', error);
      alert('Có lỗi xảy ra khi lưu mẫu câu.');
    });
  }

  // Xóa mẫu câu
  function deletePattern(pattern) {
    if (confirm('Bạn có chắc chắn muốn xóa mẫu câu này không?')) {
      const token = localStorage.getItem('token');
      const authHeader = { 'Authorization': `Bearer ${token}` };
      
      fetch(`/api/admin/chatbot/patterns/${encodeURIComponent(pattern)}`, {
        method: 'DELETE',
        headers: {
          ...authHeader
        }
      })
      .then(response => {
        if (response.ok) {
          alert('Xóa mẫu câu thành công!');
          loadPatterns();
        } else {
          throw new Error('Delete failed');
        }
      })
      .catch(error => {
        console.error('Error deleting pattern:', error);
        alert('Có lỗi xảy ra khi xóa mẫu câu.');
      });
    }
  }

  // Cập nhật điểm số mẫu câu
  function updatePatternScore(pattern, score) {
    const token = localStorage.getItem('token');
    const authHeader = { 'Authorization': `Bearer ${token}` };
    
    fetch(`/api/admin/chatbot/patterns/${encodeURIComponent(pattern)}/score`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader
      },
      body: JSON.stringify({ score }),
    })
    .then(response => {
      if (response.ok) {
        loadPatterns();
      } else {
        throw new Error('Update failed');
      }
    })
    .catch(error => {
      console.error('Error updating pattern score:', error);
      alert('Có lỗi xảy ra khi cập nhật điểm số.');
    });
  }

  // Thiết lập modal pattern
  function setupPatternModal() {
    document.getElementById('save-pattern-btn').addEventListener('click', savePattern);
  }

  function handleSessionClick(session) {
    const sessionId = session.id;
    
    // Lưu session ID hiện tại để tiện theo dõi
    currentSessionId = sessionId;
    
    // Hiển thị vùng chat và ẩn nội dung khác
    document.getElementById('chat-container').style.display = 'flex';
    document.getElementById('no-chat-selected').style.display = 'none';
    
    // Cập nhật thông tin khách hàng
    const customerName = `Khách hàng`;
    document.getElementById('chat-customer-name').textContent = customerName;
    document.getElementById('chat-start-time').textContent = `Bắt đầu: ${formatDateTime(session.startedAt)}`;
    
    // Xóa tin nhắn cũ
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';
    
    // Hiển thị loading
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'system-message';
    loadingMessage.textContent = 'Đang tải tin nhắn...';
    messagesContainer.appendChild(loadingMessage);
    
    // Gửi yêu cầu tiếp nhận hỗ trợ
    fetch(`/api/support/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ sessionId })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Không thể tiếp nhận hỗ trợ');
      }
      return response.json();
    })
    .then(() => {
      // Sau khi tiếp nhận thành công, lấy lịch sử tin nhắn
      return fetch(`/api/support/messages/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Không thể tải tin nhắn');
      }
      return response.json();
    })
    .then(messages => {
      // Xóa thông báo đang tải
      messagesContainer.innerHTML = '';
      
      // Hiển thị tin nhắn
      messages.forEach(message => {
        const messageEl = createMessageElement(message);
        messagesContainer.appendChild(messageEl);
      });
      
      // Cuộn xuống tin nhắn mới nhất
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Thiết lập kết nối Socket.IO cho phiên chat này
      setupChatSocket(sessionId);
      
      // Cập nhật UI sessionList để đánh dấu session đang được chọn
      const allSessionItems = document.querySelectorAll('.session-item');
      allSessionItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.sessionId === sessionId) {
          item.classList.add('active');
          // Xóa badge unread nếu có
          const badge = item.querySelector('.unread-badge');
          if (badge) {
            badge.remove();
          }
        }
      });
      
      // Kích hoạt các nút chức năng
      document.getElementById('end-support-btn').disabled = false;
    })
    .catch(error => {
      console.error('Error:', error);
      messagesContainer.innerHTML = '';
      const errorMessage = document.createElement('div');
      errorMessage.className = 'system-message error';
      errorMessage.textContent = error.message || 'Có lỗi xảy ra khi tải tin nhắn';
      messagesContainer.appendChild(errorMessage);
    });
  }

  function setupChatSocket(sessionId) {
    // Kiểm tra xem socket đã tồn tại chưa
    if (socket) {
      socket.disconnect();
    }
    
    // Khởi tạo kết nối socket.io
    socket = io({
      query: {
        sessionId: sessionId
      }
    });
    
    socket.on('connect', () => {
      console.log('Connected to socket.io server');
      // Tham gia vào room với sessionId
      socket.emit('join-room', sessionId);
      socket.emit('join-room', 'support-staff');
      socket.emit('join-chat', { sessionId: sessionId });
    });
    
    socket.on('new-message', (message) => {
      console.log('New message received:', message);
      const messagesContainer = document.getElementById('chat-messages');
      const messageEl = createMessageElement(message);
      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender}`;
    
    // Tạo div cho thông tin về tin nhắn
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    
    // Tạo avatar
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    
    // Thiết lập avatar dựa vào sender
    if (message.sender === 'user') {
      avatar.innerHTML = '<i class="fas fa-user"></i>';
      avatar.classList.add('user-avatar');
    } else if (message.sender === 'bot') {
      avatar.innerHTML = '<i class="fas fa-robot"></i>';
      avatar.classList.add('bot-avatar');
    } else if (message.sender === 'staff') {
      avatar.innerHTML = '<i class="fas fa-headset"></i>';
      avatar.classList.add('staff-avatar');
    } else {
      avatar.innerHTML = '<i class="fas fa-info-circle"></i>';
      avatar.classList.add('system-avatar');
    }
    
    // Tạo phần nội dung tin nhắn
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Tạo tên người gửi
    const sender = document.createElement('div');
    sender.className = 'sender-name';
    if (message.sender === 'user') {
      sender.textContent = 'Khách hàng';
    } else if (message.sender === 'bot') {
      sender.textContent = 'Bot';
    } else if (message.sender === 'staff') {
      sender.textContent = 'Nhân viên hỗ trợ';
    } else {
      sender.textContent = 'Hệ thống';
    }
    
    // Tạo nội dung
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = message.content;
    
    // Tạo thời gian
    const time = document.createElement('div');
    time.className = 'time';
    time.textContent = formatTime(message.timestamp);
    
    // Ghép các thành phần
    messageContent.appendChild(sender);
    messageContent.appendChild(content);
    messageContent.appendChild(time);
    
    messageInfo.appendChild(avatar);
    messageInfo.appendChild(messageContent);
    
    messageDiv.appendChild(messageInfo);
    
    return messageDiv;
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes}`;
  }
});