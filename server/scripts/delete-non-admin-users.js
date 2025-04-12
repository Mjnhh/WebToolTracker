import pool from '../config/database.js';

async function deleteNonAdminUsers() {
  try {
    console.log('Bắt đầu xóa tất cả tài khoản ngoại trừ admin...');
    
    // Thực hiện truy vấn để xóa tất cả người dùng không phải admin
    const result = await pool.query(
      "DELETE FROM users WHERE role != 'admin' RETURNING id, username, email, role"
    );
    
    console.log(`Đã xóa ${result.rowCount} tài khoản người dùng.`);
    
    if (result.rows.length > 0) {
      console.log('Danh sách tài khoản đã xóa:');
      result.rows.forEach(user => {
        console.log(`- ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
      });
    }
    
    console.log('Hoàn thành xóa tài khoản.');
  } catch (error) {
    console.error('Lỗi khi xóa tài khoản:', error);
  } finally {
    // Đóng kết nối pool
    await pool.end();
  }
}

// Chạy hàm
deleteNonAdminUsers(); 