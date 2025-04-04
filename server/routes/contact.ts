import express from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { insertInquirySchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const router = express.Router();

// Bộ nhớ tạm để theo dõi các yêu cầu gần đây để tránh trùng lặp
const recentRequests = new Map<string, number>();
const DUPLICATE_THRESHOLD_MS = 2000; // 2 giây

// API xử lý liên hệ
router.post("/submit", async (req: Request, res: Response, next: any) => {
  try {
    console.log("Nhận yêu cầu liên hệ mới:", req.body.email);
    
    // Tạo id duy nhất cho yêu cầu dựa trên email và nội dung
    const requestId = `${req.body.email}-${req.body.message}`;
    
    // Kiểm tra xem yêu cầu này có bị trùng lặp gần đây không
    const lastRequestTime = recentRequests.get(requestId);
    const now = Date.now();
    
    if (lastRequestTime && (now - lastRequestTime) < DUPLICATE_THRESHOLD_MS) {
      console.log(`Phát hiện yêu cầu trùng lặp từ ${req.body.email}, bỏ qua`);
      return res.status(429).json({ 
        message: "Yêu cầu của bạn đang được xử lý, vui lòng không gửi lại quá nhanh."
      });
    }
    
    // Kiểm tra và xác thực dữ liệu
    const parsedInquiry = insertInquirySchema.safeParse(req.body);
    
    if (!parsedInquiry.success) {
      const error = fromZodError(parsedInquiry.error);
      console.log("Dữ liệu không hợp lệ:", error.message);
      return res.status(400).json({ message: error.message });
    }
    
    // Lưu thời điểm yêu cầu hiện tại
    recentRequests.set(requestId, now);
    
    // Sau 10 phút, xóa yêu cầu khỏi bộ nhớ tạm
    setTimeout(() => {
      recentRequests.delete(requestId);
    }, 10 * 60 * 1000);
    
    // Lưu yêu cầu liên hệ vào storage
    const inquiry = await storage.createInquiry(parsedInquiry.data);
    console.log("Đã lưu yêu cầu liên hệ:", inquiry.id);
    
    res.status(201).json({ 
      message: "Yêu cầu liên hệ đã được gửi thành công!",
      inquiry
    });
  } catch (error) {
    console.error("Lỗi xử lý yêu cầu liên hệ:", error);
    next(error);
  }
});

export default router; 