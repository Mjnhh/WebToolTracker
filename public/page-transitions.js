document.addEventListener('DOMContentLoaded', function() {
    // Thêm class page-transition vào body để kích hoạt hiệu ứng
    document.body.classList.add('page-transition');
    
    // Lấy tất cả các liên kết nội bộ (không bao gồm những liên kết có target="_blank" hoặc tải tài liệu)
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    
    // Xử lý sự kiện click cho tất cả các liên kết nội bộ
    internalLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (!targetElement) return;
        
        // Thêm hiệu ứng mờ dần cho phần tử đích
        document.querySelectorAll('section').forEach(section => {
          section.style.transition = 'opacity 0.3s ease';
          if (section.id === targetId.substring(1)) {
            section.style.opacity = '0';
            
            // Sau khi mờ dần, cuộn đến phần tử đích và hiện dần lên
            setTimeout(() => {
              targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              });
              
              // Hiển thị lại phần tử sau khi cuộn
              setTimeout(() => {
                section.style.opacity = '1';
              }, 300);
            }, 150);
          }
        });
      });
    });
    
    // Thêm hiệu ứng hover cho các nút
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
      button.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-3px)';
        this.style.boxShadow = '0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08)';
      });
      
      button.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08)';
      });
    });
    
    // Thêm animation cho việc di chuyển giữa các tab (nếu có)
    const tabButtons = document.querySelectorAll('[data-tab]');
    const tabContents = document.querySelectorAll('[data-tab-content]');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        
        // Xóa active class từ tất cả buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));
        
        // Ẩn tất cả tab contents với hiệu ứng fade out
        tabContents.forEach(content => {
          content.style.opacity = '0';
          setTimeout(() => {
            content.style.display = 'none';
          }, 300);
        });
        
        // Thêm active class vào button được click
        button.classList.add('active');
        
        // Hiển thị tab content tương ứng với hiệu ứng fade in
        const activeContent = document.querySelector(`[data-tab-content="${tabId}"]`);
        if (activeContent) {
          setTimeout(() => {
            activeContent.style.display = 'block';
            setTimeout(() => {
              activeContent.style.opacity = '1';
            }, 50);
          }, 300);
        }
      });
    });
    
    // Animation cho các phần tử khi cuộn
    const animateOnScroll = () => {
      const elements = document.querySelectorAll('.animate-on-scroll');
      
      elements.forEach(element => {
        const elementPosition = element.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        
        if (elementPosition < windowHeight * 0.8) {
          element.classList.add('animated');
        }
      });
    };
    
    // Thêm class cho các phần tử cần animation khi cuộn
    document.querySelectorAll('h2, .service-card, .team-card, .faq-item').forEach(el => {
      if (!el.classList.contains('animate-on-scroll')) {
        el.classList.add('animate-on-scroll');
      }
    });
    
    // Thêm CSS cho animation
    const style = document.createElement('style');
    style.textContent = `
      .animate-on-scroll {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease, transform 0.6s ease;
      }
      
      .animate-on-scroll.animated {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
    
    // Thêm event listener cho cuộn trang
    window.addEventListener('scroll', animateOnScroll);
    
    // Kích hoạt animation ban đầu
    animateOnScroll();
  });