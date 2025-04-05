import { InsertUser, User, Inquiry, InsertInquiry, Endpoint, InsertEndpoint, ChatMessage, InsertChatMessage, ChatSession, InsertChatSession } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
const MemoryStore = createMemoryStore(session);
import bcrypt from "bcryptjs";
import crypto from 'crypto';
import { db } from './db';

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Inquiry operations
  getInquiry(id: number): Promise<Inquiry | undefined>;
  getAllInquiries(): Promise<Inquiry[]>;
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;
  updateInquiryStatus(id: number, status: string): Promise<Inquiry | undefined>;
  deleteInquiry(id: number): Promise<boolean>;
  
  // Service endpoints operations
  getEndpoint(id: number): Promise<Endpoint | undefined>;
  getAllEndpoints(): Promise<Endpoint[]>;
  createEndpoint(endpoint: InsertEndpoint): Promise<Endpoint>;
  updateEndpoint(id: number, endpoint: Partial<Endpoint>): Promise<Endpoint | undefined>;
  deleteEndpoint(id: number): Promise<boolean>;
  
  // Chat operations
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(sessionId: string): Promise<ChatSession | undefined>;
  updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  saveChatMessage(message: Omit<ChatMessage, 'id'>): Promise<ChatMessage>;
  updateChatMessage(id: number, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined>;
  
  // Learning operations
  saveLearningPattern(pattern: string, response: string): Promise<void>;
  findSimilarPattern(input: string): Promise<string | undefined>;
  updatePatternScore(pattern: string, score: number): Promise<void>;
  getAllPatterns(): Promise<Array<{ pattern: string; response: string; score: number }>>;
  getPattern(pattern: string): Promise<{ response: string; score: number } | undefined>;
  deletePattern(pattern: string): Promise<boolean>;
  
  // Session store
  sessionStore: session.Store;

  // New method
  getAllChatSessions(): Promise<ChatSession[]>;

  getUserById(id: number): Promise<User | undefined>;
}

export interface Voucher {
  id: string;
  code: string;
  discount: number;
  isUsed: boolean;
  createdAt: Date;
  usedAt?: Date;
  userId?: string;
  userEmail?: string;
  quizScore?: number;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private inquiries: Map<number, Inquiry>;
  private endpoints: Map<number, Endpoint>;
  private chatSessions: Map<string, ChatSession>;
  private chatMessages: Map<string, ChatMessage[]>;
  private learningPatterns: Map<string, { response: string; score: number }>;
  private currentUserId: number;
  private currentInquiryId: number;
  private currentEndpointId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.inquiries = new Map();
    this.endpoints = new Map();
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.learningPatterns = new Map();
    this.currentUserId = 1;
    this.currentInquiryId = 1;
    this.currentEndpointId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    
    // Initialize admin user and default patterns
    this.initializeAdminUser();
    this.initializeDefaultPatterns();
    this.initializeSampleData();
    this.initializeDefaultEndpoints();
  }

  private async initializeAdminUser() {
    try {
      // Kiểm tra xem admin đã tồn tại chưa
      const existingAdmin = await this.getUserByUsername("admin");
      
      if (!existingAdmin) {
        // Hash mật khẩu admin123
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("admin123", salt);
        
        // Tạo tài khoản admin với mật khẩu đã hash
        const adminUser = await this.createUser({
          username: "admin",
          password: hashedPassword,
          email: "admin@tectonicdevs.com",
          name: "Administrator"
        });
        
        // Cập nhật quyền admin
        adminUser.role = "admin";
        this.users.set(adminUser.id, adminUser);
        
        console.log('Admin user initialized successfully with bcrypt password');
      } else {
        console.log('Admin user already exists, skipping creation');
        
        // Đảm bảo admin user có role
        if (!existingAdmin.role) {
          existingAdmin.role = "admin";
          this.users.set(existingAdmin.id, existingAdmin);
          console.log('Updated existing admin user with role');
        }
      }
      
      // Tạo tài khoản staff nếu chưa có
      const existingStaff = await this.getUserByUsername("staff");
      
      if (!existingStaff) {
        // Hash mật khẩu staff123
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("staff123", salt);
        
        // Tạo tài khoản staff
        const staffUser = await this.createUser({
          username: "staff",
          password: hashedPassword,
          email: "staff@tectonicdevs.com",
          name: "Support Staff"
        });
        
        // Cập nhật quyền staff
        staffUser.role = "staff";
        this.users.set(staffUser.id, staffUser);
        
        console.log('Staff user initialized successfully');
      } else {
        console.log('Staff user already exists, skipping creation');
        
        // Đảm bảo staff user có role
        if (!existingStaff.role) {
          existingStaff.role = "staff";
          this.users.set(existingStaff.id, existingStaff);
          console.log('Updated existing staff user with role');
        }
      }
    } catch (error) {
      console.error('Failed to initialize users:', error);
    }
  }

  private initializeDefaultPatterns() {
    const patterns = [
      // Mẫu câu chào hỏi và xã giao
      ["xin chào", "Xin chào! Tôi là trợ lý ảo của Coding Team. Tôi có thể giúp gì cho bạn?"],
      ["chào", "Chào bạn! Tôi có thể giúp gì cho bạn không?"],
      ["hi", "Chào bạn! Rất vui được gặp bạn. Tôi có thể giúp gì cho bạn?"],
      ["hello", "Xin chào! Rất vui được gặp bạn. Tôi có thể giúp gì cho bạn?"],
      ["hey", "Chào bạn! Tôi có thể giúp gì cho bạn không?"],
      ["tạm biệt", "Tạm biệt bạn! Hẹn gặp lại!"],
      ["bye", "Tạm biệt! Rất vui được trò chuyện với bạn. Hẹn gặp lại!"],
      ["goodbye", "Tạm biệt! Cảm ơn bạn đã trò chuyện. Hẹn gặp lại!"],
      ["cảm ơn", "Không có gì! Rất vui được giúp đỡ bạn."],
      ["thanks", "Không có gì! Rất vui được giúp đỡ bạn."],
      ["thank you", "Không có gì! Rất vui được giúp đỡ bạn."],

      // Câu hỏi về khả năng
      ["bạn có thể làm gì", "Tôi có thể giúp bạn với các vấn đề sau:\n- Tư vấn về dịch vụ thiết kế website\n- Tư vấn về công nghệ và giải pháp\n- Báo giá và thời gian thực hiện\n- Thông tin về quy trình làm việc\n- Hỗ trợ kỹ thuật và các vấn đề khác"],
      ["bạn giúp được gì", "Tôi có thể giúp bạn với các vấn đề sau:\n- Tư vấn về dịch vụ thiết kế website\n- Tư vấn về công nghệ và giải pháp\n- Báo giá và thời gian thực hiện\n- Thông tin về quy trình làm việc\n- Hỗ trợ kỹ thuật và các vấn đề khác"],
      ["khả năng", "Tôi có thể giúp bạn với các vấn đề sau:\n- Tư vấn về dịch vụ thiết kế website\n- Tư vấn về công nghệ và giải pháp\n- Báo giá và thời gian thực hiện\n- Thông tin về quy trình làm việc\n- Hỗ trợ kỹ thuật và các vấn đề khác"],

      // Mẫu câu về dịch vụ web cơ bản
      ["thiết kế website", "Chúng tôi cung cấp dịch vụ thiết kế website chuyên nghiệp, tối ưu SEO và tương thích mobile. Website được thiết kế theo yêu cầu riêng của từng khách hàng với giao diện hiện đại và thân thiện người dùng."],
      ["thiết kế web", "Chúng tôi cung cấp dịch vụ thiết kế website chuyên nghiệp, tối ưu SEO và tương thích mobile. Website được thiết kế theo yêu cầu riêng của từng khách hàng với giao diện hiện đại và thân thiện người dùng."],
      ["làm web", "Chúng tôi có thể giúp bạn xây dựng website từ A-Z, bao gồm: thiết kế giao diện, lập trình frontend/backend, tối ưu hiệu năng, bảo mật và triển khai lên hosting."],
      ["tạo web", "Chúng tôi có thể giúp bạn xây dựng website từ A-Z, bao gồm: thiết kế giao diện, lập trình frontend/backend, tối ưu hiệu năng, bảo mật và triển khai lên hosting."],
      ["xây dựng web", "Chúng tôi có thể giúp bạn xây dựng website từ A-Z, bao gồm: thiết kế giao diện, lập trình frontend/backend, tối ưu hiệu năng, bảo mật và triển khai lên hosting."],

      // Mẫu câu về công nghệ
      ["công nghệ", "Chúng tôi sử dụng các công nghệ web hiện đại như: React, Angular, Vue.js cho frontend; Node.js, PHP, Python cho backend; MySQL, MongoDB cho database. Công nghệ sẽ được lựa chọn phù hợp với yêu cầu của dự án."],
      ["tech stack", "Chúng tôi sử dụng các công nghệ web hiện đại như: React, Angular, Vue.js cho frontend; Node.js, PHP, Python cho backend; MySQL, MongoDB cho database. Công nghệ sẽ được lựa chọn phù hợp với yêu cầu của dự án."],
      ["framework", "Chúng tôi sử dụng các framework hiện đại như: React, Angular, Vue.js cho frontend; Express, Laravel, Django cho backend. Framework sẽ được lựa chọn phù hợp với yêu cầu và quy mô dự án của bạn."],
      ["ngôn ngữ", "Chúng tôi thành thạo nhiều ngôn ngữ lập trình như: JavaScript/TypeScript, PHP, Python, Java. Ngôn ngữ sẽ được lựa chọn phù hợp với yêu cầu của dự án và môi trường triển khai."],
      ["database", "Chúng tôi có kinh nghiệm với nhiều loại database như: MySQL, PostgreSQL, MongoDB, Redis. Database sẽ được lựa chọn phù hợp với yêu cầu về dữ liệu và hiệu năng của dự án."],

      // Mẫu câu về tối ưu và responsive
      ["responsive", "Tất cả website do chúng tôi thiết kế đều được tối ưu responsive, hiển thị tốt trên mọi thiết bị như máy tính, tablet và điện thoại di động."],
      ["mobile", "Tất cả website do chúng tôi thiết kế đều được tối ưu cho mobile, đảm bảo trải nghiệm người dùng tốt trên các thiết bị di động."],
      ["điện thoại", "Tất cả website do chúng tôi thiết kế đều được tối ưu cho điện thoại, đảm bảo trải nghiệm người dùng tốt trên các thiết bị di động."],
      ["tối ưu", "Chúng tôi áp dụng nhiều biện pháp tối ưu cho website như: tối ưu tốc độ tải trang, tối ưu hình ảnh, tối ưu mã nguồn, cache và CDN."],
      ["tốc độ", "Chúng tôi áp dụng nhiều biện pháp tối ưu tốc độ website như: nén file, lazy loading, cache browser, CDN để đảm bảo website luôn hoạt động nhanh chóng."],

      // Mẫu câu về SEO và marketing
      ["seo", "Website được tối ưu SEO ngay từ đầu với cấu trúc chuẩn, tốc độ tải trang nhanh, meta tags đầy đủ, URL thân thiện và tương thích mobile theo chuẩn của Google."],
      ["từ khóa", "Chúng tôi hỗ trợ nghiên cứu và tối ưu từ khóa cho website, giúp website của bạn xuất hiện tốt trên các công cụ tìm kiếm."],
      ["marketing", "Chúng tôi cung cấp các giải pháp marketing online tổng thể: SEO, Google Ads, Facebook Ads, Email Marketing để giúp website tiếp cận nhiều khách hàng hơn."],
      ["quảng cáo", "Chúng tôi cung cấp dịch vụ quảng cáo online: Google Ads, Facebook Ads với chiến lược tối ưu ngân sách và hiệu quả cao."],

      // Mẫu câu về bảo trì và hỗ trợ
      ["bảo trì", "Chúng tôi cung cấp dịch vụ bảo trì website định kỳ, bao gồm: cập nhật bảo mật, sao lưu dữ liệu, tối ưu hiệu năng, và hỗ trợ kỹ thuật 24/7."],
      ["maintain", "Chúng tôi cung cấp dịch vụ bảo trì website định kỳ, bao gồm: cập nhật bảo mật, sao lưu dữ liệu, tối ưu hiệu năng, và hỗ trợ kỹ thuật 24/7."],
      ["maintenance", "Chúng tôi cung cấp dịch vụ bảo trì website định kỳ, bao gồm: cập nhật bảo mật, sao lưu dữ liệu, tối ưu hiệu năng, và hỗ trợ kỹ thuật 24/7."],
      ["support", "Chúng tôi cung cấp dịch vụ hỗ trợ kỹ thuật 24/7, giải đáp mọi thắc mắc và xử lý sự cố nhanh chóng cho website của bạn."],
      ["hỗ trợ", "Chúng tôi cung cấp dịch vụ hỗ trợ kỹ thuật 24/7, giải đáp mọi thắc mắc và xử lý sự cố nhanh chóng cho website của bạn."],

      // Mẫu câu về domain và hosting
      ["domain", "Chúng tôi hỗ trợ tư vấn và đăng ký tên miền (domain) phù hợp cho website của bạn. Chúng tôi làm việc với nhiều nhà cung cấp domain uy tín để đảm bảo giá tốt nhất."],
      ["tên miền", "Chúng tôi hỗ trợ tư vấn và đăng ký tên miền (domain) phù hợp cho website của bạn. Chúng tôi làm việc với nhiều nhà cung cấp domain uy tín để đảm bảo giá tốt nhất."],
      ["hosting", "Chúng tôi cung cấp dịch vụ hosting với hiệu năng cao, bảo mật tốt và uptime 99.9%. Bạn có thể chọn các gói hosting phù hợp với quy mô website của mình."],
      ["máy chủ", "Chúng tôi cung cấp dịch vụ máy chủ với hiệu năng cao, bảo mật tốt và uptime 99.9%. Bạn có thể chọn các gói hosting/VPS phù hợp với quy mô website của mình."],
      ["server", "Chúng tôi cung cấp dịch vụ máy chủ với hiệu năng cao, bảo mật tốt và uptime 99.9%. Bạn có thể chọn các gói hosting/VPS phù hợp với quy mô website của mình."],

      // Mẫu câu về bảo mật
      ["ssl", "Chúng tôi hỗ trợ cài đặt SSL để mã hóa dữ liệu và bảo vệ thông tin người dùng. Website của bạn sẽ được đánh dấu 'Bảo mật' trên trình duyệt."],
      ["bảo mật", "Chúng tôi áp dụng nhiều biện pháp bảo mật cho website như: SSL, WAF, Anti-DDoS, Regular Security Audit để đảm bảo website của bạn luôn an toàn."],
      ["security", "Chúng tôi áp dụng nhiều biện pháp bảo mật cho website như: SSL, WAF, Anti-DDoS, Regular Security Audit để đảm bảo website của bạn luôn an toàn."],
      ["hack", "Chúng tôi áp dụng nhiều biện pháp bảo mật chống hack cho website như: WAF, Anti-DDoS, Regular Security Audit, và monitoring 24/7."],

      // Mẫu câu về thời gian và chi phí
      ["thời gian làm web", "Thời gian phát triển website thường từ 2-8 tuần tùy theo quy mô và độ phức tạp. Website landing page đơn giản có thể hoàn thành trong 1-2 tuần, website TMĐT phức tạp có thể mất 2-3 tháng."],
      ["mất bao lâu", "Thời gian phát triển website thường từ 2-8 tuần tùy theo quy mô và độ phức tạp. Website landing page đơn giản có thể hoàn thành trong 1-2 tuần, website TMĐT phức tạp có thể mất 2-3 tháng."],
      ["bao lâu xong", "Thời gian phát triển website thường từ 2-8 tuần tùy theo quy mô và độ phức tạp. Website landing page đơn giản có thể hoàn thành trong 1-2 tuần, website TMĐT phức tạp có thể mất 2-3 tháng."],
      ["chi phí", "Chi phí làm website phụ thuộc vào nhiều yếu tố như: tính năng, quy mô, công nghệ sử dụng. Website cơ bản từ 10-20 triệu, website TMĐT từ 20-50 triệu, website tùy chỉnh cao có thể trên 50 triệu."],
      ["giá", "Chi phí làm website phụ thuộc vào nhiều yếu tố như: tính năng, quy mô, công nghệ sử dụng. Website cơ bản từ 10-20 triệu, website TMĐT từ 20-50 triệu, website tùy chỉnh cao có thể trên 50 triệu."],
      ["báo giá", "Chi phí làm website phụ thuộc vào nhiều yếu tố như: tính năng, quy mô, công nghệ sử dụng. Website cơ bản từ 10-20 triệu, website TMĐT từ 20-50 triệu, website tùy chỉnh cao có thể trên 50 triệu."],

      // Mẫu câu về quy trình và thanh toán
      ["quy trình", "Quy trình làm website gồm các bước: 1. Khảo sát yêu cầu 2. Thiết kế giao diện 3. Phát triển frontend/backend 4. Kiểm thử 5. Triển khai 6. Bảo trì. Mỗi bước đều có sự tham gia góp ý của khách hàng."],
      ["các bước", "Quy trình làm website gồm các bước: 1. Khảo sát yêu cầu 2. Thiết kế giao diện 3. Phát triển frontend/backend 4. Kiểm thử 5. Triển khai 6. Bảo trì. Mỗi bước đều có sự tham gia góp ý của khách hàng."],
      ["thanh toán", "Chúng tôi áp dụng hình thức thanh toán theo giai đoạn: 40% khi ký hợp đồng, 30% khi hoàn thành giao diện, 30% khi bàn giao sản phẩm. Chúng tôi xuất hóa đơn VAT đầy đủ."],
      ["trả tiền", "Chúng tôi áp dụng hình thức thanh toán theo giai đoạn: 40% khi ký hợp đồng, 30% khi hoàn thành giao diện, 30% khi bàn giao sản phẩm. Chúng tôi xuất hóa đơn VAT đầy đủ."],
      ["hợp đồng", "Chúng tôi sẽ ký hợp đồng chi tiết, trong đó quy định rõ về: phạm vi công việc, thời gian thực hiện, chi phí, phương thức thanh toán, và các điều khoản bảo hành."],

      // Mẫu câu về bảo hành
      ["bảo hành", "Website được bảo hành miễn phí 6-12 tháng sau khi bàn giao, bao gồm: sửa lỗi, cập nhật bảo mật, sao lưu dữ liệu và hỗ trợ kỹ thuật. Sau thời gian bảo hành, bạn có thể ký hợp đồng bảo trì."],
      ["warranty", "Website được bảo hành miễn phí 6-12 tháng sau khi bàn giao, bao gồm: sửa lỗi, cập nhật bảo mật, sao lưu dữ liệu và hỗ trợ kỹ thuật. Sau thời gian bảo hành, bạn có thể ký hợp đồng bảo trì."],
      ["guarantee", "Website được bảo hành miễn phí 6-12 tháng sau khi bàn giao, bao gồm: sửa lỗi, cập nhật bảo mật, sao lưu dữ liệu và hỗ trợ kỹ thuật. Sau thời gian bảo hành, bạn có thể ký hợp đồng bảo trì."],

      // Mẫu câu về các loại website
      ["landing page", "Landing page là trang web đơn giản, tập trung vào một mục tiêu cụ thể như giới thiệu sản phẩm hoặc thu thập thông tin khách hàng. Chúng tôi thiết kế landing page chuyên nghiệp, tối ưu tỷ lệ chuyển đổi."],
      ["web thương mại điện tử", "Website thương mại điện tử (TMĐT) là nền tảng bán hàng online với đầy đủ tính năng: quản lý sản phẩm, giỏ hàng, thanh toán online, quản lý đơn hàng, tích hợp vận chuyển."],
      ["web bán hàng", "Website bán hàng được tích hợp đầy đủ tính năng: quản lý sản phẩm, giỏ hàng, thanh toán online, quản lý đơn hàng, tích hợp vận chuyển, hỗ trợ marketing và bán hàng đa kênh."],
      ["web tin tức", "Website tin tức được thiết kế với giao diện chuyên nghiệp, dễ đọc, tối ưu SEO, hệ thống phân loại và tìm kiếm tin tức hiệu quả, tích hợp các tính năng tương tác với độc giả."],
      ["web doanh nghiệp", "Website doanh nghiệp được thiết kế chuyên nghiệp, hiện đại, giới thiệu đầy đủ về công ty, sản phẩm dịch vụ, tin tức, tuyển dụng và các thông tin quan trọng khác."],

      // Mẫu câu về tính năng website
      ["tính năng", "Website có thể tích hợp nhiều tính năng như: Quản lý nội dung, Blog, Tin tức, Sản phẩm, Giỏ hàng, Thanh toán online, Chat trực tuyến, Form liên hệ, Tích hợp mạng xã hội, v.v."],
      ["chức năng", "Website có thể tích hợp nhiều chức năng như: Quản lý nội dung, Blog, Tin tức, Sản phẩm, Giỏ hàng, Thanh toán online, Chat trực tuyến, Form liên hệ, Tích hợp mạng xã hội, v.v."],
      ["thanh toán online", "Chúng tôi hỗ trợ tích hợp nhiều cổng thanh toán như: VNPay, Momo, ZaloPay, Paypal, Visa/Master, chuyển khoản ngân hàng để khách hàng có nhiều lựa chọn thanh toán."],
      ["đa ngôn ngữ", "Website có thể hỗ trợ đa ngôn ngữ, cho phép khách hàng xem nội dung bằng nhiều ngôn ngữ khác nhau, phù hợp với doanh nghiệp có khách hàng quốc tế."],

      // Mẫu câu về portfolio và kinh nghiệm
      ["portfolio", "Chúng tôi đã thực hiện nhiều dự án website cho các doanh nghiệp lớn nhỏ trong nhiều lĩnh vực. Bạn có thể xem portfolio của chúng tôi tại mục Dự án trên website."],
      ["dự án", "Chúng tôi đã thực hiện nhiều dự án website cho các doanh nghiệp lớn nhỏ trong nhiều lĩnh vực. Bạn có thể xem portfolio của chúng tôi tại mục Dự án trên website."],
      ["kinh nghiệm", "Đội ngũ của chúng tôi có hơn 5 năm kinh nghiệm trong lĩnh vực phát triển website, đã thực hiện hàng trăm dự án cho các doanh nghiệp trong nhiều lĩnh vực khác nhau."],
      ["khách hàng", "Chúng tôi đã có cơ hội được phục vụ nhiều khách hàng từ các doanh nghiệp lớn nhỏ trong nhiều lĩnh vực. Bạn có thể xem danh sách khách hàng tiêu biểu tại website của chúng tôi."]
    ];

    patterns.forEach(([pattern, response]) => {
      this.learningPatterns.set(pattern.toLowerCase(), {
        response,
        score: 1
      });
    });
  }

  private initializeSampleData() {
    // Thêm dữ liệu mẫu cho inquiries
    const sampleInquiries = [
      {
        id: this.currentInquiryId++,
        name: "Nguyễn Văn A",
        email: "nguyenvana@example.com",
        phone: "0123456789",
        subject: "Tư vấn thiết kế website",
        message: "Tôi cần thiết kế một website cho doanh nghiệp của mình, vui lòng liên hệ lại với tôi.",
        status: "unread",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        id: this.currentInquiryId++,
        name: "Trần Thị B",
        email: "tranthib@example.com",
        phone: "0987654321",
        subject: "Báo giá dịch vụ SEO",
        message: "Tôi muốn biết chi phí dịch vụ SEO của công ty, website của tôi là example.com",
        status: "in-progress",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: this.currentInquiryId++,
        name: "Lê Văn C",
        email: "levanc@example.com",
        phone: "0369852147",
        subject: "Hỗ trợ kỹ thuật",
        message: "Website của tôi đang gặp lỗi không hiển thị hình ảnh, cần được hỗ trợ khắc phục gấp.",
        status: "resolved",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      {
        id: this.currentInquiryId++,
        name: "Phạm Văn D",
        email: "phamvand@example.com",
        phone: "0912345678",
        subject: "Tư vấn marketing online",
        message: "Tôi cần tư vấn về chiến lược marketing online cho sản phẩm mới của công ty.",
        status: "unread",
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      },
      {
        id: this.currentInquiryId++,
        name: "Hoàng Thị E",
        email: "hoangthie@example.com",
        phone: "0888777666",
        subject: "Cần thiết kế app mobile",
        message: "Doanh nghiệp của tôi cần phát triển ứng dụng mobile cho khách hàng, vui lòng tư vấn giúp tôi.",
        status: "unread",
        createdAt: new Date()
      }
    ];

    sampleInquiries.forEach(inquiry => {
      this.inquiries.set(inquiry.id, inquiry);
    });

    // Thêm dữ liệu mẫu cho endpoints
    const sampleEndpoints = [
      {
        id: this.currentEndpointId++,
        name: "Get Users",
        method: "GET",
        path: "/api/users",
        description: "Get all users",
        authRequired: true,
        isActive: true
      },
      {
        id: this.currentEndpointId++,
        name: "Create User",
        method: "POST",
        path: "/api/users",
        description: "Create a new user",
        authRequired: true,
        isActive: true
      },
      {
        id: this.currentEndpointId++,
        name: "Get User",
        method: "GET",
        path: "/api/users/:id",
        description: "Get user by ID",
        authRequired: true,
        isActive: true
      },
      {
        id: this.currentEndpointId++,
        name: "Login",
        method: "POST",
        path: "/api/auth/login",
        description: "User login",
        authRequired: false,
        isActive: true
      }
    ];

    sampleEndpoints.forEach(endpoint => {
      this.endpoints.set(endpoint.id, endpoint);
    });
  }

  // Thêm các API endpoints mặc định vào cơ sở dữ liệu
  private async initializeDefaultEndpoints() {
    try {
      // Xóa tất cả endpoints hiện có
      const existingEndpoints = await this.getAllEndpoints();
      for (const endpoint of existingEndpoints) {
        await this.deleteEndpoint(endpoint.id);
      }
      console.log('Removed all existing endpoints for re-initialization');

      // Danh sách các endpoint để thêm
      const defaultEndpoints = [
        // Auth API Endpoints
        { name: "Auth - Login", method: "POST", path: "/api/auth/login", description: "Đăng nhập vào hệ thống", authRequired: false, isActive: true },
        { name: "Auth - Logout", method: "POST", path: "/api/auth/logout", description: "Đăng xuất khỏi hệ thống", authRequired: true, isActive: true },
        { name: "Auth - Verify Token", method: "GET", path: "/api/auth/verify", description: "Xác thực token JWT", authRequired: true, isActive: true },
        { name: "Auth - Register", method: "POST", path: "/api/auth/register", description: "Đăng ký tài khoản mới", authRequired: false, isActive: true },
        { name: "Auth - Refresh Token", method: "POST", path: "/api/auth/refresh", description: "Làm mới token JWT", authRequired: true, isActive: true },
        { name: "Auth - Session", method: "GET", path: "/api/auth/session", description: "Kiểm tra phiên đăng nhập", authRequired: false, isActive: true },

        // Chat API Endpoints
        { name: "Chat - Create Session", method: "POST", path: "/api/chat/session", description: "Khởi tạo phiên chat mới", authRequired: false, isActive: true },
        { name: "Chat - Get Session", method: "GET", path: "/api/chat/session/:sessionId", description: "Lấy thông tin phiên chat", authRequired: false, isActive: true },
        { name: "Chat - Send Message", method: "POST", path: "/api/chat/session/:sessionId/message", description: "Gửi tin nhắn mới", authRequired: false, isActive: true },
        { name: "Chat - Get Messages", method: "GET", path: "/api/chat/session/:sessionId/messages", description: "Lấy tin nhắn của phiên chat", authRequired: false, isActive: true },
        { name: "Chat - Rate Session", method: "POST", path: "/api/chat/session/:sessionId/rate", description: "Đánh giá phiên chat", authRequired: false, isActive: true },

        // Support API Endpoints
        { name: "Support - Assign Staff", method: "POST", path: "/api/support/assign", description: "Phân công nhân viên hỗ trợ", authRequired: true, isActive: true },
        { name: "Support - Send Message", method: "POST", path: "/api/support/message", description: "Gửi tin nhắn từ nhân viên", authRequired: true, isActive: true },
        { name: "Support - End Session", method: "POST", path: "/api/support/end", description: "Kết thúc phiên hỗ trợ", authRequired: true, isActive: true },
        { name: "Support - Get Sessions", method: "GET", path: "/api/support/sessions", description: "Lấy danh sách phiên hỗ trợ", authRequired: true, isActive: true },
        { name: "Support - Get Messages", method: "GET", path: "/api/support/messages/:sessionId", description: "Lấy tin nhắn của phiên hỗ trợ", authRequired: true, isActive: true },
        { name: "Support - Get Stats", method: "GET", path: "/api/support/stats", description: "Lấy thống kê hỗ trợ", authRequired: true, isActive: true },

        // Contact API Endpoints
        { name: "Contact - Submit", method: "POST", path: "/api/contact/submit", description: "Gửi form liên hệ", authRequired: false, isActive: true },

        // Admin API Endpoints
        { name: "Admin - Get Users", method: "GET", path: "/api/admin/users", description: "Lấy danh sách người dùng", authRequired: true, isActive: true },
        { name: "Admin - Get Inquiries", method: "GET", path: "/api/admin/inquiries", description: "Lấy danh sách liên hệ", authRequired: true, isActive: true },
        { name: "Admin - Get Inquiry", method: "GET", path: "/api/admin/inquiries/:id", description: "Lấy chi tiết một liên hệ", authRequired: true, isActive: true },
        { name: "Admin - Update Inquiry Status", method: "PATCH", path: "/api/admin/inquiries/:id/status", description: "Cập nhật trạng thái liên hệ", authRequired: true, isActive: true },
        { name: "Admin - Delete Inquiry", method: "DELETE", path: "/api/admin/inquiries/:id", description: "Xóa liên hệ", authRequired: true, isActive: true },
        { name: "Admin - Get Endpoints", method: "GET", path: "/api/admin/endpoints", description: "Liệt kê các API endpoints", authRequired: true, isActive: true },
        { name: "Admin - Create Endpoint", method: "POST", path: "/api/admin/endpoints", description: "Tạo endpoint mới", authRequired: true, isActive: true },
        { name: "Admin - Update Endpoint", method: "PATCH", path: "/api/admin/endpoints/:id", description: "Cập nhật endpoint", authRequired: true, isActive: true },
        { name: "Admin - Delete Endpoint", method: "DELETE", path: "/api/admin/endpoints/:id", description: "Xóa endpoint", authRequired: true, isActive: true },
        { name: "Admin - Add Chatbot Pattern", method: "POST", path: "/api/admin/chatbot/patterns", description: "Thêm mẫu câu mới cho chatbot", authRequired: true, isActive: true },
        { name: "Admin - Update Pattern Score", method: "PATCH", path: "/api/admin/chatbot/patterns/:pattern/score", description: "Cập nhật điểm số cho mẫu câu", authRequired: true, isActive: true },
        { name: "Admin - Get Patterns", method: "GET", path: "/api/admin/chatbot/patterns", description: "Lấy tất cả mẫu câu chatbot", authRequired: true, isActive: true },
        { name: "Admin - Get Pattern", method: "GET", path: "/api/admin/chatbot/patterns/:pattern", description: "Lấy chi tiết mẫu câu", authRequired: true, isActive: true },
        { name: "Admin - Delete Pattern", method: "DELETE", path: "/api/admin/chatbot/patterns/:pattern", description: "Xóa mẫu câu", authRequired: true, isActive: true },

        // Spotify API Endpoints
        { name: "Spotify - Proxy GET", method: "GET", path: "/api/spotify/proxy/*", description: "Proxy endpoint cho Spotify API (CORS)", authRequired: true, isActive: true },
        { name: "Spotify - Proxy POST", method: "POST", path: "/api/spotify/proxy/*", description: "Endpoint POST proxy cho Spotify API", authRequired: true, isActive: true },
      ];

      // Thêm từng endpoint vào cơ sở dữ liệu
      for (const endpoint of defaultEndpoints) {
        await this.createEndpoint(endpoint);
      }

      console.log(`Added ${defaultEndpoints.length} default API endpoints to the database`);
    } catch (error) {
      console.error('Failed to initialize default endpoints:', error);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    // Generate a unique ID for the new user
    const id = this.currentUserId++;
    
    // If password isn't already hashed (during testing/initialization)
    let password = user.password;
    if (!password.startsWith('$2')) {
      try {
        // Hash the password for security
        const salt = await bcrypt.genSalt(10);
        password = await bcrypt.hash(user.password, salt);
      } catch (error) {
        console.error('Error hashing password:', error);
        // Fallback to plaintext for demo if bcrypt fails
        password = user.password;
      }
    }
    
    // Create the new user with generated ID
    const newUser: User = {
      id,
      username: user.username,
      password: password,
      email: user.email,
      name: user.name || user.username,
      role: user.role || 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Store the user
    this.users.set(id, newUser);
    
    // Return the created user
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const existingUser = this.users.get(id);
    
    if (!existingUser) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    // Cập nhật thông tin người dùng
    const updatedUser = {
      ...existingUser,
      ...updates,
      updatedAt: new Date()
    };
    
    // Lưu lại vào bộ nhớ
    this.users.set(id, updatedUser);
    
    return updatedUser;
  }

  // Inquiry operations
  async getInquiry(id: number): Promise<Inquiry | undefined> {
    return this.inquiries.get(id);
  }

  async getAllInquiries(): Promise<Inquiry[]> {
    return Array.from(this.inquiries.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createInquiry(insertInquiry: InsertInquiry): Promise<Inquiry> {
    const id = this.currentInquiryId++;
    const now = new Date();
    const inquiry: Inquiry = { 
      ...insertInquiry, 
      id, 
      status: "unread",
      createdAt: now,
      phone: insertInquiry.phone || null // Đảm bảo phone là string hoặc null, không phải undefined
    };
    this.inquiries.set(id, inquiry);
    return inquiry;
  }

  async updateInquiryStatus(id: number, status: string): Promise<Inquiry | undefined> {
    const inquiry = this.inquiries.get(id);
    if (!inquiry) return undefined;
    
    const updatedInquiry = { ...inquiry, status };
    this.inquiries.set(id, updatedInquiry);
    return updatedInquiry;
  }

  async deleteInquiry(id: number): Promise<boolean> {
    return this.inquiries.delete(id);
  }

  // Service endpoint operations
  async getEndpoint(id: number): Promise<Endpoint | undefined> {
    return this.endpoints.get(id);
  }

  async getAllEndpoints(): Promise<Endpoint[]> {
    return Array.from(this.endpoints.values());
  }

  async createEndpoint(insertEndpoint: InsertEndpoint): Promise<Endpoint> {
    const id = this.currentEndpointId++;
    const endpoint: Endpoint = { 
      ...insertEndpoint, 
      id,
      description: insertEndpoint.description || null, // Đảm bảo là string hoặc null
      authRequired: insertEndpoint.authRequired ?? false, // Mặc định là false nếu undefined
      isActive: insertEndpoint.isActive ?? true // Mặc định là true nếu undefined
    };
    this.endpoints.set(id, endpoint);
    return endpoint;
  }

  async updateEndpoint(id: number, endpointUpdate: Partial<Endpoint>): Promise<Endpoint | undefined> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return undefined;
    
    const updatedEndpoint = { ...endpoint, ...endpointUpdate };
    this.endpoints.set(id, updatedEndpoint);
    return updatedEndpoint;
  }

  async deleteEndpoint(id: number): Promise<boolean> {
    return this.endpoints.delete(id);
  }

  // Chat operations
  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const now = new Date();
    const session: ChatSession = {
      id: insertSession.id,
      userId: insertSession.userId || null,
      metadata: insertSession.metadata || null,
      startedAt: now,
      lastActivity: now
    };
    this.chatSessions.set(session.id, session);
    this.chatMessages.set(session.id, []); // Initialize empty message array for session
    
    // Add welcome message
    await this.addWelcomeMessage(session.id);
    
    return session;
  }

  private async addWelcomeMessage(sessionId: string): Promise<void> {
    const welcomeMessage = {
      sessionId,
      content: `👋 Xin chào! Tôi là trợ lý ảo của Coding Team

Tôi có thể giúp bạn với các vấn đề:

🌐 Tư vấn về dịch vụ thiết kế website
💻 Tư vấn về công nghệ và giải pháp 
💰 Báo giá và thời gian thực hiện
📋 Thông tin về quy trình làm việc
🛠️ Hỗ trợ kỹ thuật

Bạn cần hỗ trợ vấn đề gì ạ? 😊`,
      sender: "bot",
      timestamp: new Date()
    };
    
    await this.createChatMessage(welcomeMessage);
  }

  async getChatSession(sessionId: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(sessionId);
  }

  async updateChatSession(sessionId: string, updates: Partial<ChatSession>): Promise<ChatSession> {
    const session = this.chatSessions.get(sessionId);
    if (!session) {
      throw new Error('Chat session not found');
    }

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date()
    };

    this.chatSessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async createChatMessage(message: {
    sessionId: string;
    content: string;
    sender: string;
    timestamp: Date;
  }): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: Date.now(),
      sessionId: message.sessionId,
      content: message.content,
      sender: message.sender,
      timestamp: message.timestamp,
      metadata: null
    };
    
    const sessionMessages = this.chatMessages.get(message.sessionId) || [];
    sessionMessages.push(newMessage);
    this.chatMessages.set(message.sessionId, sessionMessages);
    
    return newMessage;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(sessionId) || [];
  }

  async saveChatMessage(message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> {
    return this.createChatMessage(message as {
      sessionId: string;
      content: string;
      sender: string;
      timestamp: Date;
    });
  }

  async updateChatMessage(id: number, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
    // Duyệt qua từng phiên chat để tìm tin nhắn cần cập nhật
    for (const [sessionId, messages] of Array.from(this.chatMessages.entries())) {
      const index = messages.findIndex(m => m.id === id);
      if (index !== -1) {
        // Cập nhật tin nhắn với các thuộc tính mới
        const updatedMessage = { ...messages[index], ...updates };
        messages[index] = updatedMessage;
        this.chatMessages.set(sessionId, messages);
        return updatedMessage;
      }
    }
    return undefined;
  }

  // Learning operations
  async saveLearningPattern(pattern: string, response: string): Promise<void> {
    this.learningPatterns.set(pattern.toLowerCase(), { response, score: 1 });
  }

  async findSimilarPattern(input: string): Promise<string | undefined> {
    input = input.toLowerCase();
    let bestMatch: { pattern: string; similarity: number } | undefined;
    
    // Convert Map entries to array before iterating
    const patterns = Array.from(this.learningPatterns.entries());
    
    for (const [pattern, data] of patterns) {
      const similarity = this.calculateSimilarity(input, pattern);
      if (similarity > 0.7 && (!bestMatch || similarity * data.score > bestMatch.similarity)) {
        bestMatch = { pattern, similarity: similarity * data.score };
      }
    }
    
    return bestMatch ? this.learningPatterns.get(bestMatch.pattern)?.response : undefined;
  }

  async updatePatternScore(pattern: string, score: number): Promise<void> {
    const existingPattern = this.learningPatterns.get(pattern.toLowerCase());
    if (existingPattern) {
      existingPattern.score = Math.max(0.1, Math.min(2, existingPattern.score + score));
      this.learningPatterns.set(pattern.toLowerCase(), existingPattern);
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Sử dụng thuật toán Levenshtein Distance để tính độ tương đồng
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }

    const maxLength = Math.max(m, n);
    return 1 - dp[m][n] / maxLength;
  }

  // Thêm các phương thức mới
  async getAllPatterns(): Promise<Array<{ pattern: string; response: string; score: number }>> {
    return Array.from(this.learningPatterns.entries()).map(([pattern, data]) => ({
      pattern,
      response: data.response,
      score: data.score
    }));
  }

  async getPattern(pattern: string): Promise<{ response: string; score: number } | undefined> {
    return this.learningPatterns.get(pattern.toLowerCase());
  }

  async deletePattern(pattern: string): Promise<boolean> {
    return this.learningPatterns.delete(pattern.toLowerCase());
  }

  async getAllChatSessions(): Promise<ChatSession[]> {
    // Trả về danh sách tất cả các phiên chat
    return Array.from(this.chatSessions.values());
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
}

const storage = new MemStorage();
export { storage };

export async function saveVoucher(voucherData: Omit<Voucher, 'id' | 'createdAt'>): Promise<Voucher> {
  const id = crypto.randomUUID();
  const createdAt = new Date();
  
  const voucher: Voucher = {
    id,
    createdAt,
    ...voucherData
  };
  
  // Lưu voucher vào cơ sở dữ liệu
  await db.write(async (data: any) => {
    if (!data.vouchers) {
      data.vouchers = [];
    }
    data.vouchers.push(voucher);
  });
  
  return voucher;
}

export async function getVoucherByCode(code: string): Promise<Voucher | null> {
  const data = await db.read();
  if (!data.vouchers) return null;
  
  const voucher = data.vouchers.find((v: any) => v.code === code);
  return voucher || null;
}

export async function markVoucherAsUsed(code: string): Promise<Voucher | null> {
  let updatedVoucher: Voucher | null = null;
  
  await db.write(async (data: any) => {
    if (!data.vouchers) return;
    
    const voucherIndex = data.vouchers.findIndex((v: any) => v.code === code);
    if (voucherIndex === -1) return;
    
    data.vouchers[voucherIndex].isUsed = true;
    data.vouchers[voucherIndex].usedAt = new Date();
    
    updatedVoucher = data.vouchers[voucherIndex];
  });
  
  return updatedVoucher;
}

export async function getAllVouchers(): Promise<Voucher[]> {
  const data = await db.read();
  return data.vouchers || [];
}