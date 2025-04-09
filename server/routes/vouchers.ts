import express from 'express';
import { Request, Response } from 'express';
import { storage } from '../storage';
import { isAuthenticated, isStaff } from '../middleware/auth';

const router = express.Router();

// Thêm cột metadata vào bảng vouchers nếu chưa có
(async () => {
  try {
    console.log('Checking if metadata column exists in vouchers table...');
    
    // Kiểm tra xem cột metadata đã tồn tại chưa
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vouchers' AND column_name = 'metadata'
    `;
    
    const checkResult = await storage.pool.query(checkColumnQuery);
    
    // Nếu cột chưa tồn tại, thêm vào
    if (checkResult.rows.length === 0) {
      console.log('Adding metadata column to vouchers table');
      await storage.pool.query(`
        ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS metadata JSONB
      `);
      console.log('Successfully added metadata column to vouchers table');
    } else {
      console.log('Metadata column already exists in vouchers table');
    }
  } catch (error) {
    console.error('Error initializing vouchers table:', error);
  }
})();

// Tạo voucher mới (yêu cầu quyền staff)
router.post('/', isAuthenticated, isStaff, async (req: Request, res: Response) => {
  try {
    const voucher = await storage.createVoucher(req.body);
    res.json(voucher);
  } catch (error) {
    console.error('Error creating voucher:', error);
    res.status(500).json({ error: 'Failed to create voucher' });
  }
});

// Tạo voucher mới từ quiz (không yêu cầu xác thực)
router.post('/create', async (req: Request, res: Response) => {
  try {
    console.log('Creating voucher from quiz:', req.body);
    const voucherData = {
      code: req.body.code,
      discountPercent: req.body.discountPercent || 25,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Hết hạn sau 30 ngày
      metadata: JSON.stringify({
        quizScore: req.body.quizScore,
        source: 'quiz'
      })
    };
    
    const voucher = await storage.createVoucher(voucherData);
    console.log('Voucher created successfully:', voucher);
    res.json(voucher);
  } catch (error) {
    console.error('Error creating voucher from quiz:', error);
    res.status(500).json({ error: 'Failed to create voucher from quiz' });
  }
});

// Lấy voucher theo mã
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const voucher = await storage.getVoucherByCode(req.params.code);
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    res.json(voucher);
  } catch (error) {
    console.error('Error getting voucher:', error);
    res.status(500).json({ error: 'Failed to get voucher' });
  }
});

// Đánh dấu voucher đã sử dụng
router.put('/:code/use', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const voucher = await storage.markVoucherAsUsed(req.params.code);
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    res.json(voucher);
  } catch (error) {
    console.error('Error marking voucher as used:', error);
    res.status(500).json({ error: 'Failed to mark voucher as used' });
  }
});

// Lấy tất cả voucher
router.get('/', isAuthenticated, isStaff, async (req: Request, res: Response) => {
  try {
    const vouchers = await storage.getAllVouchers();
    res.json(vouchers);
  } catch (error) {
    console.error('Error getting vouchers:', error);
    res.status(500).json({ error: 'Failed to get vouchers' });
  }
});

export default router; 