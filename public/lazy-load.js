document.addEventListener('DOMContentLoaded', function() {
    // Kiểm tra xem trình duyệt có hỗ trợ Intersection Observer không
    if ('IntersectionObserver' in window) {
      const lazyImages = [].slice.call(document.querySelectorAll('img.lazy'));
      
      let lazyImageObserver = new IntersectionObserver(function(entries, observer) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            let lazyImage = entry.target;
            if (lazyImage.dataset.src) {
              lazyImage.src = lazyImage.dataset.src;
              lazyImage.classList.remove('lazy');
              lazyImageObserver.unobserve(lazyImage);
              console.log('Lazy loaded image:', lazyImage.dataset.src);
            }
          }
        });
      });
  
      lazyImages.forEach(function(lazyImage) {
        lazyImageObserver.observe(lazyImage);
      });
    } else {
      // Fallback cho trình duyệt không hỗ trợ Intersection Observer
      let active = false;
  
      const lazyLoad = function() {
        if (active === false) {
          active = true;
  
          setTimeout(function() {
            let lazyImages = document.querySelectorAll('img.lazy');
            
            lazyImages.forEach(function(lazyImage) {
              if ((lazyImage.getBoundingClientRect().top <= window.innerHeight && lazyImage.getBoundingClientRect().bottom >= 0) && getComputedStyle(lazyImage).display !== 'none') {
                if (lazyImage.dataset.src) {
                  lazyImage.src = lazyImage.dataset.src;
                  lazyImage.classList.remove('lazy');
                }
  
                if (lazyImages.length === 0) {
                  document.removeEventListener('scroll', lazyLoad);
                  window.removeEventListener('resize', lazyLoad);
                  window.removeEventListener('orientationchange', lazyLoad);
                }
              }
            });
            
            active = false;
          }, 200);
        }
      };
  
      document.addEventListener('scroll', lazyLoad);
      window.addEventListener('resize', lazyLoad);
      window.addEventListener('orientationchange', lazyLoad);
      lazyLoad();
    }
  });