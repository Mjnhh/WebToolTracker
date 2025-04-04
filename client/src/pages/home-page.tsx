import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import ContactForm from "@/components/ContactForm";

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to admin dashboard if user is admin
  useEffect(() => {
    if (user && user.role === 'admin') {
      setLocation('/admin');
    }
  }, [user, setLocation]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <header className="bg-dark text-white py-4 fixed w-full top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <a href="/" className="flex items-center">
            <div className="rounded-full bg-primary p-2 h-12 w-12 flex items-center justify-center mr-3">
              <i className="fas fa-code text-white text-lg"></i>
            </div>
            <span className="text-xl font-bold">Tectonic Devs</span>
          </a>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#home" className="text-white hover:text-primary-foreground transition-colors">Trang chủ</a>
            <a href="#services" className="text-white hover:text-primary-foreground transition-colors">Dịch vụ</a>
            <a href="#contact" className="text-white hover:text-primary-foreground transition-colors">Liên hệ</a>
            <a href="#faq" className="text-white hover:text-primary-foreground transition-colors">Trợ giúp</a>
          </nav>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm hidden md:inline-block">Xin chào, {user.name}</span>
                {user.role === 'admin' && (
                  <a 
                    href="/admin" 
                    className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 transition-colors"
                  >
                    Admin Panel
                  </a>
                )}
                <button 
                  onClick={() => setLocation('/auth')} 
                  className="border border-primary text-white px-4 py-2 rounded hover:bg-primary/20 transition-colors"
                >
                  Tài khoản
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a 
                  href="/auth" 
                  className="border border-primary text-white px-4 py-2 rounded hover:bg-primary/20 transition-colors"
                >
                  Đăng nhập
                </a>
                <a 
                  href="/auth" 
                  className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90 transition-colors"
                >
                  Đăng ký
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Using the existing HTML structure but with React components */}
      <main className="pt-20">
        {/* Hero Section */}
        <section className="min-h-screen bg-gradient-to-br from-dark to-secondary flex items-center" id="home">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Giải Pháp Tự Động Hóa <span className="text-primary">Thông Minh</span>
              </h1>
              <h2 className="text-2xl text-white/80 mb-4">Nâng Cao Hiệu Suất Kinh Doanh</h2>
              <div className="w-20 h-1 bg-primary mb-6"></div>
              <p className="text-white/70 mb-8">
                Chúng tôi phát triển các công cụ tự động, chatbot và phần mềm tiện ích giúp tối ưu hóa quy trình làm việc, tiết kiệm thời gian và đẩy mạnh kết quả kinh doanh của bạn.
              </p>
              <div className="flex flex-wrap gap-4 mb-12">
                <a href="#services" className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-full flex items-center gap-2 transition-transform hover:-translate-y-1">
                  <span>Khám phá dịch vụ</span>
                  <i className="fas fa-arrow-right"></i>
                </a>
                <a href="#contact" className="border border-white/20 text-white hover:bg-white/10 px-6 py-3 rounded-full flex items-center gap-2 transition-transform hover:-translate-y-1">
                  <i className="fas fa-headset"></i>
                  <span>Liên hệ ngay</span>
                </a>
              </div>
              <div className="flex flex-wrap gap-12">
                <div>
                  <span className="text-primary text-3xl font-bold">500+</span>
                  <p className="text-white/60 text-sm">Dự án</p>
                </div>
                <div>
                  <span className="text-primary text-3xl font-bold">50+</span>
                  <p className="text-white/60 text-sm">Chuyên gia</p>
                </div>
                <div>
                  <span className="text-primary text-3xl font-bold">98%</span>
                  <p className="text-white/60 text-sm">Hài lòng</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-dark" id="features">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-primary uppercase tracking-wider text-sm font-semibold">CÔNG NGHỆ HIỆN ĐẠI</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">Tính Năng <span className="text-primary">Nổi Bật</span></h2>
              <p className="text-white/70 mt-4">
                Khám phá những công nghệ hiện đại mà chúng tôi áp dụng để tạo nên các giải pháp tự động hóa hiệu quả cho doanh nghiệp của bạn.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature Cards */}
              <div className="bg-dark-lighter p-6 rounded-lg border border-white/10 relative overflow-hidden group hover:translate-y-[-5px] transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 relative">
                  <i className="fas fa-robot text-primary text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Chatbot Thông Minh</h3>
                <p className="text-white/70 mb-5">Phát triển chatbot tùy chỉnh với khả năng trí tuệ nhân tạo để tự động hóa hỗ trợ khách hàng và thúc đẩy chuyển đổi 24/7.</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">NLP</span>
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">AI</span>
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">Machine Learning</span>
                </div>
              </div>
              
              <div className="bg-dark-lighter p-6 rounded-lg border border-white/10 relative overflow-hidden group hover:translate-y-[-5px] transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 relative">
                  <i className="fas fa-code text-primary text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Tự Động Hóa Script</h3>
                <p className="text-white/70 mb-5">Phát triển script tùy chỉnh để tự động hóa các tác vụ lặp đi lặp lại, tối ưu hóa quy trình và nâng cao hiệu suất làm việc.</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">Python</span>
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">JavaScript</span>
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">PowerShell</span>
                </div>
              </div>
              
              <div className="bg-dark-lighter p-6 rounded-lg border border-white/10 relative overflow-hidden group hover:translate-y-[-5px] transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 relative">
                  <i className="fas fa-cogs text-primary text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Tích Hợp API</h3>
                <p className="text-white/70 mb-5">Tích hợp liền mạch các API bên thứ ba để mở rộng chức năng và kết nối các hệ thống kinh doanh khác nhau một cách hiệu quả.</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">RESTful</span>
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">GraphQL</span>
                  <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">Webhooks</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-20 bg-gradient-to-br from-secondary/90 to-dark" id="services">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-primary uppercase tracking-wider text-sm font-semibold">GIẢI PHÁP CHUYÊN NGHIỆP</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">Dịch Vụ <span className="text-primary">Của Chúng Tôi</span></h2>
              <p className="text-white/70 mt-4">
                Khám phá các dịch vụ chuyên nghiệp của chúng tôi được thiết kế để đáp ứng nhu cầu tự động hóa và phát triển phần mềm của doanh nghiệp bạn.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Service Cards */}
              <div className="bg-dark p-8 rounded-xl border border-white/10 hover:border-primary/30 transition-all duration-300 group hover:shadow-lg hover:shadow-primary/5">
                <div className="flex gap-4 items-start mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-robot text-primary text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">Chatbot Thông Minh</h3>
                </div>
                <p className="text-white/70 mb-6">Tạo chatbot tùy chỉnh được hỗ trợ bởi AI để tự động hóa tương tác với khách hàng, hỗ trợ và tăng tỷ lệ chuyển đổi.</p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-white/80">
                    <i className="fas fa-check text-primary"></i>
                    <span>Tích hợp với Facebook Messenger, Website</span>
                  </li>
                  <li className="flex items-center gap-3 text-white/80">
                    <i className="fas fa-check text-primary"></i>
                    <span>Xử lý ngôn ngữ tự nhiên (NLP)</span>
                  </li>
                  <li className="flex items-center gap-3 text-white/80">
                    <i className="fas fa-check text-primary"></i>
                    <span>Trả lời tự động 24/7</span>
                  </li>
                </ul>
                <a href="#contact" className="inline-flex items-center text-primary font-medium hover:text-primary/80 transition-colors">
                  <span>Tìm hiểu thêm</span>
                  <i className="fas fa-arrow-right ml-2"></i>
                </a>
              </div>
              
              <div className="bg-dark p-8 rounded-xl border border-white/10 hover:border-primary/30 transition-all duration-300 group hover:shadow-lg hover:shadow-primary/5">
                <div className="flex gap-4 items-start mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-window-maximize text-primary text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">Phát Triển Web</h3>
                </div>
                <p className="text-white/70 mb-6">Xây dựng các trang web hiện đại, tùy chỉnh với giao diện người dùng và trải nghiệm hấp dẫn, tối ưu hóa cho SEO.</p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-white/80">
                    <i className="fas fa-check text-primary"></i>
                    <span>Thiết kế responsive cho mọi thiết bị</span>
                  </li>
                  <li className="flex items-center gap-3 text-white/80">
                    <i className="fas fa-check text-primary"></i>
                    <span>Tối ưu tốc độ tải trang</span>
                  </li>
                  <li className="flex items-center gap-3 text-white/80">
                    <i className="fas fa-check text-primary"></i>
                    <span>Tích hợp CMS và tính năng tùy chỉnh</span>
                  </li>
                </ul>
                <a href="#contact" className="inline-flex items-center text-primary font-medium hover:text-primary/80 transition-colors">
                  <span>Tìm hiểu thêm</span>
                  <i className="fas fa-arrow-right ml-2"></i>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form Section */}
        <section className="py-20 bg-dark" id="contact">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-primary uppercase tracking-wider text-sm font-semibold">LIÊN HỆ</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">Kết Nối <span className="text-primary">Với Chúng Tôi</span></h2>
              <p className="text-white/70 mt-4">
                Để lại thông tin của bạn, chúng tôi sẽ liên hệ để tư vấn giải pháp phù hợp nhất với nhu cầu của bạn.
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <ContactForm />
              </div>
              
              <div className="bg-dark-lighter p-8 rounded-xl border border-white/10">
                <h3 className="text-2xl font-bold text-white mb-6">Thông Tin Liên Hệ</h3>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-map-marker-alt text-primary"></i>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Địa Chỉ</h4>
                      <p className="text-white/70">123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-envelope text-primary"></i>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Email</h4>
                      <p className="text-white/70">info@tectonicdevs.com</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-phone-alt text-primary"></i>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Điện Thoại</h4>
                      <p className="text-white/70">+84 123 456 789</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-10">
                  <h4 className="text-white font-medium mb-4">Theo Dõi Chúng Tôi</h4>
                  <div className="flex gap-3">
                    <a href="#" className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                      <i className="fab fa-facebook-f"></i>
                    </a>
                    <a href="#" className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                      <i className="fab fa-twitter"></i>
                    </a>
                    <a href="#" className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                      <i className="fab fa-linkedin-in"></i>
                    </a>
                    <a href="#" className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                      <i className="fab fa-instagram"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-dark-lighter text-white py-12 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="rounded-full bg-primary p-2 h-10 w-10 flex items-center justify-center mr-3">
                  <i className="fas fa-code text-white text-sm"></i>
                </div>
                <span className="text-lg font-bold">Tectonic Devs</span>
              </div>
              <p className="text-white/70 mb-4">
                Cung cấp giải pháp tự động hóa và phát triển phần mềm chuyên nghiệp cho doanh nghiệp.
              </p>
              <div className="flex gap-3">
                <a href="#" className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary transition-colors">
                  <i className="fab fa-facebook-f text-sm"></i>
                </a>
                <a href="#" className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary transition-colors">
                  <i className="fab fa-twitter text-sm"></i>
                </a>
                <a href="#" className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary transition-colors">
                  <i className="fab fa-linkedin-in text-sm"></i>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-medium mb-4">Liên Kết Nhanh</h4>
              <ul className="space-y-2">
                <li><a href="#home" className="text-white/70 hover:text-primary transition-colors">Trang Chủ</a></li>
                <li><a href="#features" className="text-white/70 hover:text-primary transition-colors">Tính Năng</a></li>
                <li><a href="#services" className="text-white/70 hover:text-primary transition-colors">Dịch Vụ</a></li>
                <li><a href="#contact" className="text-white/70 hover:text-primary transition-colors">Liên Hệ</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-medium mb-4">Dịch Vụ</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/70 hover:text-primary transition-colors">Chatbot Thông Minh</a></li>
                <li><a href="#" className="text-white/70 hover:text-primary transition-colors">Phát Triển Web</a></li>
                <li><a href="#" className="text-white/70 hover:text-primary transition-colors">Tự Động Hóa Script</a></li>
                <li><a href="#" className="text-white/70 hover:text-primary transition-colors">Tích Hợp API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-medium mb-4">Thông Tin Liên Hệ</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <i className="fas fa-map-marker-alt text-primary mt-1"></i>
                  <span className="text-white/70">123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-envelope text-primary mt-1"></i>
                  <span className="text-white/70">info@tectonicdevs.com</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-phone-alt text-primary mt-1"></i>
                  <span className="text-white/70">+84 123 456 789</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 text-center text-white/50 text-sm">
            <p>© {new Date().getFullYear()} Tectonic Devs. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
