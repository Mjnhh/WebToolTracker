import express from 'express';
import { 
  saveVoucher, 
  getVoucherByCode, 
  markVoucherAsUsed,
  getAllVouchers,
  Voucher 
} from '../storage';
import { isAuthenticated, isStaff } from '../middleware/auth';

const router = express.Router();

// API để tạo mới voucher từ quiz
router.post('/create', async (req, res) => {
  try {
    const { code, discount, isUsed, userId, userEmail, quizScore } = req.body;

    // Kiểm tra mã code đã tồn tại chưa
    const existingVoucher = await getVoucherByCode(code);
    if (existingVoucher) {
      return res.status(400).json({ error: 'Mã voucher đã tồn tại' });
    }

    // Tạo voucher mới
    const newVoucher = await saveVoucher({
      code,
      discount,
      isUsed,
      userId,
      userEmail,
      quizScore
    });

    res.status(201).json(newVoucher);
  } catch (error: any) {
    console.error('Lỗi khi tạo voucher:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo voucher' });
  }
});

// API để kiểm tra voucher (công khai)
router.get('/check/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const voucher = await getVoucherByCode(code);

    if (!voucher) {
      return res.status(404).json({ valid: false, error: 'Mã voucher không tồn tại' });
    }

    if (voucher.isUsed) {
      return res.status(400).json({ valid: false, error: 'Mã voucher đã được sử dụng' });
    }

    // Trả về toàn bộ thông tin voucher hợp lệ
    res.json({
      valid: true,
      code: voucher.code,
      discount: voucher.discount,
      isUsed: voucher.isUsed,
      createdAt: voucher.createdAt,
      quizScore: voucher.quizScore
    });
  } catch (error: any) {
    console.error('Lỗi khi kiểm tra voucher:', error);
    res.status(500).json({ valid: false, error: 'Lỗi server khi kiểm tra voucher' });
  }
});

// API để đánh dấu voucher đã sử dụng (yêu cầu đăng nhập + quyền staff)
router.put('/use/:code', isAuthenticated, isStaff, async (req, res) => {
  try {
    const { code } = req.params;
    const voucher = await getVoucherByCode(code);

    if (!voucher) {
      return res.status(404).json({ success: false, error: 'Mã voucher không tồn tại' });
    }

    if (voucher.isUsed) {
      return res.status(400).json({ success: false, error: 'Mã voucher đã được sử dụng' });
    }

    // Đánh dấu voucher đã sử dụng
    const updatedVoucher = await markVoucherAsUsed(code);
    res.json({ success: true, voucher: updatedVoucher });
  } catch (error: any) {
    console.error('Lỗi khi sử dụng voucher:', error);
    res.status(500).json({ success: false, error: 'Lỗi server khi sử dụng voucher' });
  }
});

// API để lấy danh sách tất cả voucher (đã bỏ yêu cầu đăng nhập tạm thời để test)
router.get('/list', async (req, res) => {
  try {
    const vouchers = await getAllVouchers();
    res.json(vouchers);
  } catch (error: any) {
    console.error('Lỗi khi lấy danh sách voucher:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách voucher' });
  }
});

export default router; 