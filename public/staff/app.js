// Biến và cấu hình toàn cục
let currentUser = null;
let currentSessionId = null;
let socket = null;
let sessionList = [];
let activeSessions = [];
let receivedMessageIds = new Set(); // Set lưu trữ ID tin nhắn đã hiển thị
let tempMessageMap = new Map(); // Map lưu trữ tin nhắn tạm và ID thật của chúng
const API_BASE_URL = '/api';
let isSendingMessage = false; // Biến trạng thái để ngăn chặn gửi nhiều lần
let isLoadingMessages = false; // Biến trạng thái để ngăn chặn việc tải tin nhắn nhiều lần

// Khởi tạo Spotify Player
let spotifyToken = localStorage.getItem('spotifyToken');
let spotifyPlayer = null;
let spotifyDeviceId = null;
let isPlaying = false;
let currentTrack = null;

// Hàm khởi tạo Spotify Web Playback SDK
function initSpotify() {
  console.log('Bắt đầu khởi tạo Spotify SDK');
  showNotification('Đang khởi tạo trình phát Spotify...', 'info');
  
  // Đảm bảo đã có token
  if (!spotifyToken) {
    console.error('Không có token Spotify khi khởi tạo SDK');
    showNotification('Không thể khởi tạo Spotify - Thiếu token', 'error');
    return;
  }
  
  // Kiểm tra nếu script đã được tải
  if (document.getElementById('spotify-player-script')) {
    console.log('Script Spotify đã được tải trước đó, tiếp tục thiết lập');
    setupSpotifyPlayer();
    return;
  }
  
  // Thêm Spotify Web Playback SDK script
  console.log('Thêm script Spotify Web Playback SDK');
  const script = document.createElement('script');
  script.id = 'spotify-player-script';
  script.src = 'https://sdk.scdn.co/spotify-player.js';
  script.async = true;
  
  // Thêm sự kiện để debug lỗi tải script
  script.onload = () => {
    console.log('Script Spotify đã tải thành công');
  };
  
  script.onerror = (error) => {
    console.error('Lỗi khi tải script Spotify:', error);
    showNotification('Không thể tải Spotify Player SDK', 'error');
    
    // Thử tải lại sau 3 giây
    setTimeout(() => {
      console.log('Đang thử tải lại script Spotify...');
      document.getElementById('spotify-player-script')?.remove();
      initSpotify();
    }, 3000);
  };
  
  document.body.appendChild(script);
  
  // Hàm callback khi Spotify SDK đã sẵn sàng
  window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify Web Playback SDK đã sẵn sàng');
    setupSpotifyPlayer();
  };
  
  // Backup để đảm bảo SDK được khởi tạo - đôi khi sự kiện onSpotifyWebPlaybackSDKReady không được gọi
  setTimeout(() => {
    if (typeof Spotify !== 'undefined' && !document.querySelector('.spotify-player-container:not([style*="display: none"])')) {
      console.log('Không thấy SDK được khởi tạo sau timeout, thử thiết lập lại');
      setupSpotifyPlayer();
    }
  }, 5000);
}

// Hàm thiết lập Spotify Player
function setupSpotifyPlayer() {
  console.log('Đang thiết lập Spotify Player...');
  
  if (!spotifyToken) {
    console.error('Không có token Spotify khi thiết lập player');
    document.getElementById('spotify-not-connected').style.display = 'block';
    document.getElementById('spotify-player-container').style.display = 'none';
    showNotification('Không thể kết nối Spotify - thiếu token', 'error');
    return;
  }
  
  try {
    // Kiểm tra xem Spotify đã được định nghĩa chưa
    if (typeof Spotify === 'undefined') {
      console.error('SDK Spotify chưa được tải hoặc không khả dụng');
      showNotification('Không thể khởi tạo trình phát Spotify - SDK không khả dụng', 'error');
      return;
    }
    
    console.log('Khởi tạo đối tượng Spotify.Player');
    
    // Khởi tạo player
    spotifyPlayer = new Spotify.Player({
      name: 'Tool Tracker Staff App',
      getOAuthToken: cb => { cb(spotifyToken); },
      volume: 0.5
    });
    
    console.log('Đã tạo đối tượng Player, đang thiết lập các sự kiện...');
    
    // Lỗi kết nối
    spotifyPlayer.addListener('initialization_error', ({ message }) => {
      console.error('Failed to initialize Spotify player:', message);
      showNotification('Lỗi khởi tạo trình phát Spotify: ' + message, 'error');
    });
    
    // Lỗi xác thực
    spotifyPlayer.addListener('authentication_error', ({ message }) => {
      console.error('Authentication error:', message);
      localStorage.removeItem('spotifyToken');
      spotifyToken = null;
      showNotification('Token Spotify hết hạn hoặc không hợp lệ: ' + message, 'error');
      document.getElementById('spotify-not-connected').style.display = 'block';
      document.getElementById('spotify-player-container').style.display = 'none';
    });
    
    // Lỗi tài khoản
    spotifyPlayer.addListener('account_error', ({ message }) => {
      console.error('Account error:', message);
      showNotification('Lỗi tài khoản Spotify: ' + message, 'error');
    });
    
    // Trình phát đã sẵn sàng
    spotifyPlayer.addListener('ready', ({ device_id }) => {
      console.log('Spotify player ready with device ID', device_id);
      spotifyDeviceId = device_id;
      
      // Hiển thị player container và ẩn thông báo kết nối
      const notConnectedElement = document.getElementById('spotify-not-connected');
      const playerContainer = document.getElementById('spotify-player-container');
      
      if (notConnectedElement) notConnectedElement.style.display = 'none';
      if (playerContainer) playerContainer.style.display = 'block';
      
      showNotification('Trình phát Spotify đã sẵn sàng', 'success');
      
      // Kiểm tra rằng DOM đã sẵn sàng trước khi fetch playlists
      if (document.getElementById('playlist-selector')) {
        console.log('DOM đã sẵn sàng, lấy danh sách playlist');
        setTimeout(fetchUserPlaylists, 1000); // Thêm timeout để đảm bảo Web Player SDK đã khởi tạo hoàn toàn
      } else {
        console.log('Playlist selector chưa sẵn sàng, thử lại sau 1 giây');
        setTimeout(fetchUserPlaylists, 2000);
      }
    });
    
    // Theo dõi thay đổi trạng thái
    spotifyPlayer.addListener('player_state_changed', state => {
      console.log('Spotify player state changed:', state ? 'New state' : 'No state');
      if (!state) return;
      
      currentTrack = state.track_window.current_track;
      isPlaying = !state.paused;
      
      // Cập nhật giao diện
      updatePlayerUI(state);
    });
    
    console.log('Đang kết nối Spotify Web Playback SDK...');
    
    // Kết nối đến Spotify
    spotifyPlayer.connect().then(success => {
      if (success) {
        console.log('Spotify Web Playback SDK connected successfully');
        showNotification('Kết nối Spotify thành công', 'success');
      } else {
        console.error('Failed to connect to Spotify Web Playback SDK');
        showNotification('Không thể kết nối Spotify Playback SDK', 'error');
        document.getElementById('spotify-not-connected').style.display = 'block';
        document.getElementById('spotify-player-container').style.display = 'none';
      }
    }).catch(error => {
      console.error('Error connecting to Spotify:', error);
      showNotification('Lỗi khi kết nối với Spotify: ' + error.message, 'error');
      document.getElementById('spotify-not-connected').style.display = 'block';
      document.getElementById('spotify-player-container').style.display = 'none';
    });
    
    // Thiết lập các sự kiện điều khiển
    setupPlayerControls();
  } catch (error) {
    console.error('Lỗi không mong đợi khi thiết lập Spotify Player:', error);
    showNotification('Lỗi không mong đợi: ' + error.message, 'error');
    document.getElementById('spotify-not-connected').style.display = 'block';
    document.getElementById('spotify-player-container').style.display = 'none';
  }
}

// Hàm cập nhật giao diện trình phát
function updatePlayerUI(state) {
  if (!state || !state.track_window.current_track) return;
  
  const track = state.track_window.current_track;
  
  // Cập nhật thông tin bài hát
  document.getElementById('track-name').textContent = track.name;
  document.getElementById('track-artist').textContent = track.artists.map(artist => artist.name).join(', ');
  
  // Cập nhật hình ảnh
  if (track.album.images && track.album.images.length > 0) {
    document.getElementById('track-artwork').src = track.album.images[0].url;
  }
  
  // Cập nhật nút phát/tạm dừng
  const playButton = document.getElementById('spotify-play');
  if (isPlaying) {
    playButton.innerHTML = '<i class="fas fa-pause"></i>';
  } else {
    playButton.innerHTML = '<i class="fas fa-play"></i>';
  }
}

// Thiết lập các điều khiển trình phát
function setupPlayerControls() {
  try {
    console.log('Thiết lập các điều khiển trình phát Spotify');
    
    // Nút kết nối
    const connectButton = document.getElementById('spotify-connect');
    if (!connectButton) {
      console.error('Không tìm thấy nút kết nối Spotify');
      return;
    }
    
    console.log('Đã tìm thấy nút kết nối Spotify, đang thiết lập sự kiện click');
    connectButton.onclick = function(event) {
      event.preventDefault();
      console.log('Đã nhấp vào nút kết nối Spotify');
      connectToSpotify();
    };
    
    // Nút phát/tạm dừng
    const playButton = document.getElementById('spotify-play');
    if (playButton) {
      playButton.addEventListener('click', () => {
        if (!spotifyPlayer) return;
        
        if (isPlaying) {
          spotifyPlayer.pause();
        } else {
          spotifyPlayer.resume();
        }
      });
    }
    
    // Nút bài trước
    const prevButton = document.getElementById('spotify-prev');
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        if (!spotifyPlayer) return;
        spotifyPlayer.previousTrack();
      });
    }
    
    // Nút bài tiếp theo
    const nextButton = document.getElementById('spotify-next');
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        if (!spotifyPlayer) return;
        spotifyPlayer.nextTrack();
      });
    }
    
    // Điều chỉnh âm lượng
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        if (!spotifyPlayer) return;
        const volume = parseInt(e.target.value) / 100;
        spotifyPlayer.setVolume(volume);
      });
    }
    
    // Chọn playlist
    const playlistSelector = document.getElementById('playlist-selector');
    if (playlistSelector) {
      playlistSelector.addEventListener('change', (e) => {
        const playlistId = e.target.value;
        if (!playlistId || !spotifyDeviceId) return;
        
        // Phát playlist được chọn
        playPlaylist(playlistId);
      });
    }
    
    console.log('Đã thiết lập các sự kiện điều khiển Spotify thành công');
  } catch (error) {
    console.error('Lỗi khi thiết lập điều khiển Spotify:', error);
  }
}

// Hàm kết nối với Spotify
function connectToSpotify() {
  console.log('Bắt đầu quá trình kết nối với Spotify');
  
  // Client ID của ứng dụng Spotify - đăng ký tại Spotify Developer Dashboard
  const clientId = '3c2d2bc84d9747e6a8f83ae351a6eb0f'; // Client ID thực tế của bạn
  const redirectUri = window.location.origin + '/staff/index.html';
  
  // Quyền cần yêu cầu từ người dùng
  const scope = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private';
  
  // Tạo URL xác thực
  const authUrl = 'https://accounts.spotify.com/authorize' +
    '?response_type=token' +
    '&client_id=' + encodeURIComponent(clientId) +
    '&scope=' + encodeURIComponent(scope) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&show_dialog=true';
  
  console.log('URL xác thực Spotify:', authUrl);
  
  // Mở cửa sổ đăng nhập
  const width = 450;
  const height = 730;
  const left = (window.screen.width / 2) - (width / 2);
  const top = (window.screen.height / 2) - (height / 2);
  
  // Thông báo cho người dùng
  showNotification('Đang mở cửa sổ xác thực Spotify...', 'info');
  
  // Mở popup để xác thực
  const authWindow = window.open(
    authUrl,
    'Spotify Login',
    'menubar=no,location=no,resizable=no,scrollbars=yes,status=no,width=' + width + ',height=' + height + ',top=' + top + ',left=' + left
  );
  
  // Kiểm tra xem cửa sổ có bị chặn không
  if (authWindow === null || typeof authWindow === 'undefined') {
    console.error('Popup bị chặn bởi trình duyệt');
    showNotification('Popup bị chặn. Vui lòng cho phép popup từ trang web này.', 'error');
  } else {
    console.log('Cửa sổ xác thực Spotify đã mở');
  }
}

// Hàm lấy token từ URL sau khi xác thực
function extractSpotifyToken() {
  console.log('Kiểm tra token Spotify trong URL');
  const hash = window.location.hash;
  console.log('Hash URL:', hash);
  
  if (!hash || !hash.includes('access_token')) {
    console.log('Không tìm thấy access_token trong URL hash');
    return false;
  }
  
  // Phân tích hash để lấy các tham số
  const params = {};
  hash.substring(1).split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    params[key] = value;
  });
  
  const token = params['access_token'];
  const expiresIn = params['expires_in'];
  
  console.log('Đã tìm thấy token:', token ? 'Có' : 'Không');
  console.log('Thời gian hết hạn:', expiresIn);
  
  if (token) {
    // Lưu token vào localStorage
    localStorage.setItem('spotifyToken', token);
    spotifyToken = token;
    
    // Lưu thời gian hết hạn
    const expiryTime = Date.now() + parseInt(expiresIn) * 1000;
    localStorage.setItem('spotifyTokenExpiry', expiryTime);
    
    console.log('Đã lưu token Spotify, hết hạn sau:', new Date(expiryTime).toLocaleString());
    
    // Làm sạch URL hash
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Thông báo cửa sổ cha nếu đây là cửa sổ popup
    if (window.opener && !window.opener.closed) {
      console.log('Đang thông báo cho cửa sổ cha về token mới');
      try {
        // Gửi sự kiện thông báo token đã được lưu
        window.opener.postMessage({ 
          type: 'spotify-token-received', 
          success: true,
          token: token,
          expiryTime: expiryTime
        }, window.location.origin);
        
        console.log('Đã gửi thông báo thành công, đóng cửa sổ sau 1 giây');
        // Đóng cửa sổ xác thực sau khi lưu token
        setTimeout(() => window.close(), 1000);
        return true;
      } catch (error) {
        console.error('Lỗi khi thông báo cửa sổ cha:', error);
      }
    } else {
      // Nếu không phải popup (đang ở trang chính)
      console.log('Không phải popup hoặc không tìm thấy cửa sổ cha, khởi tạo trình phát Spotify trực tiếp');
      showNotification('Kết nối Spotify thành công!', 'success');
      initSpotify();
    }
    
    return true;
  }
  
  console.log('Không thể lấy token từ URL hash');
  return false;
}

// Thêm lắng nghe sự kiện message từ cửa sổ xác thực
window.addEventListener('message', (event) => {
  // Kiểm tra nguồn gốc để đảm bảo an toàn
  if (event.origin !== window.location.origin) {
    console.log('Từ chối tin nhắn từ nguồn không tin cậy:', event.origin);
    return;
  }
  
  console.log('Nhận tin nhắn từ cửa sổ khác:', event.data?.type);
  
  // Xử lý tin nhắn từ cửa sổ xác thực Spotify
  if (event.data && event.data.type === 'spotify-token-received') {
    console.log('Nhận thông báo token Spotify từ cửa sổ xác thực');
    if (event.data.success) {
      console.log('Xác thực Spotify thành công, cập nhật token');
      
      // Cập nhật token từ cửa sổ popup
      if (event.data.token) {
        spotifyToken = event.data.token;
        localStorage.setItem('spotifyToken', spotifyToken);
        
        if (event.data.expiryTime) {
          localStorage.setItem('spotifyTokenExpiry', event.data.expiryTime);
          console.log('Token hết hạn sau:', new Date(event.data.expiryTime).toLocaleString());
        }
        
        showNotification('Kết nối Spotify thành công!', 'success');
        
        // Khởi tạo trình phát
        console.log('Khởi tạo trình phát Spotify với token mới');
        initSpotify();
      } else {
        console.log('Không nhận được token trong tin nhắn');
        // Thử lấy từ localStorage nếu đã được lưu bởi cửa sổ popup
        spotifyToken = localStorage.getItem('spotifyToken');
        
        if (spotifyToken) {
          console.log('Tìm thấy token trong localStorage, khởi tạo Spotify');
          initSpotify();
        }
      }
    } else {
      console.log('Xác thực Spotify không thành công');
      showNotification('Không thể kết nối Spotify. Vui lòng thử lại.', 'error');
    }
  }
});

// Hàm để lấy danh sách playlist của người dùng
function fetchUserPlaylists() {
  console.log('Đang lấy danh sách playlist người dùng...');
  if (!spotifyToken) {
    console.error('Không thể lấy playlist: Không có token');
    return;
  }
  
  // Kiểm tra xem phần tử playlist-selector đã tồn tại chưa
  const playlistSelector = document.getElementById('playlist-selector');
  if (!playlistSelector) {
    console.warn('Không tìm thấy phần tử playlist-selector, thử lại sau 1 giây');
    setTimeout(fetchUserPlaylists, 1000);
    return;
  }
  
  fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
    headers: {
      'Authorization': `Bearer ${spotifyToken}`
    }
  })
  .then(response => {
    if (!response.ok) {
      if (response.status === 401) {
        // Token hết hạn
        localStorage.removeItem('spotifyToken');
        spotifyToken = null;
        showNotification('Token Spotify hết hạn, vui lòng kết nối lại', 'error');
        
        const notConnectedElement = document.getElementById('spotify-not-connected');
        const playerContainer = document.getElementById('spotify-player-container');
        if (notConnectedElement) notConnectedElement.style.display = 'block';
        if (playerContainer) playerContainer.style.display = 'none';
      }
      throw new Error('Network response was not ok: ' + response.status);
    }
    return response.json();
  })
  .then(data => {
    console.log('Đã nhận danh sách playlist:', data.items ? data.items.length : 'Không có');
    
    // Kiểm tra lại phần tử playlist-selector (phòng trường hợp đã bị xóa)
    const playlistSelector = document.getElementById('playlist-selector');
    if (!playlistSelector) {
      console.error('Không tìm thấy phần tử playlist-selector sau khi fetch dữ liệu');
      return;
    }
    
    // Cập nhật danh sách playlist
    playlistSelector.innerHTML = '<option value="">Chọn playlist</option>';
    
    if (data.items && data.items.length > 0) {
      data.items.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist.id;
        option.textContent = playlist.name;
        playlistSelector.appendChild(option);
      });
      console.log('Đã cập nhật danh sách playlist trong giao diện');
    } else {
      console.log('Không có playlist nào được tìm thấy');
      playlistSelector.innerHTML += '<option value="" disabled>Không có playlist</option>';
    }
  })
  .catch(error => {
    console.error('Error fetching playlists:', error);
    showNotification('Không thể tải danh sách playlist: ' + error.message, 'error');
  });
}

// Hàm phát playlist
function playPlaylist(playlistId) {
  if (!spotifyToken || !spotifyDeviceId) return;
  
  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${spotifyToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      context_uri: `spotify:playlist:${playlistId}`,
      offset: { position: 0 },
      position_ms: 0
    })
  })
  .then(response => {
    if (!response.ok) {
      if (response.status === 401) {
        // Token hết hạn
        localStorage.removeItem('spotifyToken');
        spotifyToken = null;
        showNotification('Token Spotify hết hạn, vui lòng kết nối lại', 'error');
      } else {
        throw new Error('Network response was not ok');
      }
    }
    isPlaying = true;
    document.getElementById('spotify-play').innerHTML = '<i class="fas fa-pause"></i>';
  })
  .catch(error => {
    console.error('Error playing playlist:', error);
    showNotification('Không thể phát playlist', 'error');
  });
}

// Khởi tạo Spotify khi trang đã tải xong
function initializeSpotifyFeature() {
  console.log('Khởi tạo tính năng Spotify');
  
  // Kiểm tra token Spotify trong URL sau khi xác thực
  const tokenExtracted = extractSpotifyToken();
  console.log('Kết quả trích xuất token:', tokenExtracted);
  
  // Thay đổi trạng thái giao diện
  const notConnectedElement = document.getElementById('spotify-not-connected');
  const playerContainer = document.getElementById('spotify-player-container');
  
  // Kiểm tra token đã lưu
  if (spotifyToken) {
    console.log('Đã tìm thấy token trong localStorage');
    
    // Kiểm tra xem token đã hết hạn chưa
    const tokenExpiry = localStorage.getItem('spotifyTokenExpiry');
    console.log('Thời gian hết hạn token:', tokenExpiry ? new Date(parseInt(tokenExpiry)).toLocaleString() : 'Không có');
    
    if (tokenExpiry && parseInt(tokenExpiry) < Date.now()) {
      console.log('Token Spotify đã hết hạn');
      localStorage.removeItem('spotifyToken');
      localStorage.removeItem('spotifyTokenExpiry');
      spotifyToken = null;
      
      if (notConnectedElement) notConnectedElement.style.display = 'block';
      if (playerContainer) playerContainer.style.display = 'none';
      
      showNotification('Phiên Spotify đã hết hạn, vui lòng kết nối lại', 'warning');
    } else {
      console.log('Token hợp lệ, khởi tạo trình phát Spotify');
      initSpotify();
    }
  } else if (tokenExtracted) {
    // Nếu vừa lấy được token mới từ URL
    console.log('Vừa trích xuất token mới từ URL, khởi tạo trình phát');
    initSpotify();
  } else {
    // Không có token
    console.log('Không có token Spotify, hiển thị giao diện kết nối');
    if (notConnectedElement) notConnectedElement.style.display = 'block';
    if (playerContainer) playerContainer.style.display = 'none';
  }
}

// Khởi tạo kết nối socket
function initializeSocket() {
  try {
    console.log('Initializing socket connection');
    const token = getToken();
    
    // Khởi tạo kết nối socket với token và thông tin user
    socket = io({
      auth: {
        token: token
      },
      query: {
        type: 'staff'
      }
    });
    
    console.log('Socket connection initialized, waiting for connect event');
    
    // Xử lý sự kiện kết nối
    socket.on('connect', () => {
      console.log('Socket connected successfully');
      
      // Tham gia kênh support-staff để nhận thông báo về các phiên chat mới
      socket.emit('join-room', 'support-staff');
      console.log('Joined support-staff room');
      
      // Debug - kiểm tra xem đã tham gia room chưa
      setTimeout(() => {
        socket.emit('check-room-membership', { room: 'support-staff' });
      }, 2000);
      
      // Thông báo hệ thống đã sẵn sàng
      showNotification('Kết nối với máy chủ thành công', 'success');
    });
    
    // Xử lý phiên mới cần hỗ trợ
    socket.on('new-support-request', (data) => {
      console.log('Received new support request', data);
      
      // Thêm vào danh sách phiên nếu chưa có
      const sessionIndex = sessionList.findIndex(s => s.id === data.id);
      if (sessionIndex === -1) {
        // Thêm phiên mới vào đầu danh sách
        sessionList.unshift(data);
      } else {
        // Cập nhật phiên hiện có
        sessionList[sessionIndex] = { ...sessionList[sessionIndex], ...data };
      }
      
      // Cập nhật UI
      renderSessionList(sessionList);
      
      // Hiển thị thông báo
      showNotification(`Phiên chat mới cần hỗ trợ: ${data.id.substring(0, 8)}...`, 'info');
      showDesktopNotification('Yêu cầu hỗ trợ mới', `Có khách hàng đang cần hỗ trợ: ${data.id.substring(0, 8)}...`);
      playNotificationSound('new-session');
    });
    
    // Nhận danh sách phiên đang chờ hỗ trợ
    socket.on('pending-support-sessions', (sessions) => {
      console.log(`Received ${sessions.length} pending support sessions:`, sessions);
      
      // Thêm vào danh sách phiên
      let hasNewSessions = false;
      
      sessions.forEach(session => {
        // Chỉ thêm nếu chưa có trong danh sách
        const sessionIndex = sessionList.findIndex(s => s.id === session.id);
        if (sessionIndex === -1) {
          sessionList.push(session);
          hasNewSessions = true;
        }
      });
      
      // Cập nhật UI nếu có phiên mới
      if (hasNewSessions) {
        renderSessionList(sessionList);
        showNotification(`Có ${sessions.length} phiên chat đang chờ hỗ trợ`, 'info');
      }
    });
    
    // Nhận danh sách tin nhắn gần đây khi tham gia phòng chat
    socket.on('recent-messages', (messages) => {
      console.log(`Nhận ${messages.length} tin nhắn gần đây:`);
      
      if (!currentSessionId) {
        console.log('Không có phiên nào được chọn, bỏ qua tin nhắn');
        return;
      }
      
      // Xóa tin nhắn hiện tại để hiển thị lại từ đầu
      const messagesContainer = document.getElementById('chat-messages');
      if (messagesContainer) messagesContainer.innerHTML = '';
      
      // Xóa các ID tin nhắn đã lưu trước đó
      receivedMessageIds.clear();
      
      // Hiển thị lại tất cả tin nhắn
      messages.forEach(message => {
        receivedMessageIds.add(message.id);
        appendMessage(message);
      });
      
      // Cuộn xuống tin nhắn mới nhất
      scrollToBottom();
    });
    
    // Nhận tin nhắn mới
    socket.on('new-message', handleNewMessage);
    
    // Xử lý sự kiện phiên có cập nhật
    socket.on('session-updated', (data) => {
      console.log('Nhận thông báo phiên cập nhật:', data);
      if (data.hasNewMessages) {
        // Nếu đang xem phiên này thì tải lại tin nhắn
        if (data.sessionId === currentSessionId) {
          console.log(`Tải lại tin nhắn cho phiên hiện tại ${data.sessionId}`);
          fetchSessionMessages(data.sessionId);
        } else {
          // Cập nhật trạng thái phiên trong danh sách
          console.log(`Cập nhật danh sách phiên cho phiên ${data.sessionId}`);
          updateSessionWithNewMessage(data.lastMessage || {
            sessionId: data.sessionId,
            content: 'Tin nhắn mới',
            timestamp: new Date().toISOString()
          });
          
          // Phát thông báo âm thanh để nhân viên biết có tin nhắn mới
          playNotificationSound('message');
        }
      }
    });
    
    // Theo dõi khi tham gia phòng chat thành công
    socket.on('chat-joined', (data) => {
      console.log(`Đã tham gia phòng chat ${data.sessionId}: ${data.success ? 'thành công' : 'thất bại'}`);
      if (data.success && data.sessionId === currentSessionId) {
        // Tải lại tin nhắn khi đã tham gia phòng thành công
        fetchSessionMessages(data.sessionId);
      }
    });
    
    // Xử lý sự kiện broadcast-support-request (thêm mới)
    socket.on('broadcast-support-request', (data) => {
      console.log('Received broadcast support request', data);
      fetchSupportSessions(); // Tải lại danh sách phiên
      
      // Hiển thị thông báo
      showNotification(data.message, 'info');
      showDesktopNotification('Yêu cầu hỗ trợ mới', data.message);
      playNotificationSound('new-session');
    });
    
    // Debug - nhận kết quả kiểm tra tư cách thành viên phòng
    socket.on('room-membership-result', (data) => {
      console.log('Room membership check result:', data);
    });
    
    // Xử lý tin nhắn mới
    socket.on('new-message', (message) => {
      handleNewMessage(message);
    });
    
    // Xử lý đánh giá mới
    socket.on('new-rating', (data) => {
      console.log('New rating received:', data);
      updateSessionWithRating(data.sessionId, data);
    });
    
    // Xử lý lỗi kết nối
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      showNotification('Lỗi kết nối với máy chủ: ' + error.message, 'error');
    });
    
    // Xử lý mất kết nối
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Máy chủ chủ động ngắt kết nối
        showNotification('Mất kết nối với máy chủ: ' + reason, 'warning');
        setTimeout(() => {
          socket.connect(); // Thử kết nối lại
        }, 5000);
      } else if (reason === 'transport close') {
        // Mất kết nối mạng
        showNotification('Mất kết nối mạng, đang thử kết nối lại...', 'warning');
      }
    });
  } catch (error) {
    console.error('Error initializing socket:', error);
    showNotification('Lỗi khởi tạo kết nối socket: ' + error.message, 'error');
    
    // Thử khởi tạo lại sau 10 giây
    setTimeout(initializeSocket, 10000);
  }
}

// Hàm khởi tạo khi tải xong trang
document.addEventListener('DOMContentLoaded', () => {
  // Kiểm tra đăng nhập
  checkLoginStatus();

  // Thiết lập sự kiện
  setupEventListeners();
  
  // Kiểm tra và xử lý token Spotify trong URL (cho trường hợp redirect sau khi xác thực)
  setTimeout(() => {
    if (window.location.hash && window.location.hash.includes('access_token')) {
      console.log('Phát hiện token Spotify trong URL khi tải trang');
      extractSpotifyToken();
    }
  }, 500);
});

// Kiểm tra trạng thái đăng nhập
function checkLoginStatus() {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    showLoginForm();
    return;
  }

  // Xác thực token
  fetch('/api/auth/verify', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Token không hợp lệ');
    }
    return response.json();
  })
  .then(userData => {
    currentUser = userData;

    // Kiểm tra quyền truy cập
    if (userData.role !== 'staff' && userData.role !== 'admin') {
      localStorage.removeItem('auth_token'); // Xóa token
      alert('Bạn không có quyền truy cập trang này. Chỉ nhân viên hỗ trợ và quản trị viên mới được phép truy cập.');
      window.location.href = '/'; // Chuyển về trang chủ
      return;
    }

    hideLoginForm();
    initializeStaffInterface();
    
    // Hiển thị tên và vai trò
    const staffName = document.getElementById('staff-name');
    if (staffName) {
      staffName.textContent = `${userData.name || userData.username}`;
    }
  })
  .catch(error => {
    console.error('Authentication error:', error);
    localStorage.removeItem('auth_token');
    showLoginForm();
  });
}

// Hiển thị form đăng nhập
function showLoginForm() {
  const loginOverlay = document.getElementById('login-overlay');
  if (loginOverlay) loginOverlay.style.display = 'flex';
}

// Ẩn form đăng nhập
function hideLoginForm() {
  const loginOverlay = document.getElementById('login-overlay');
  if (loginOverlay) loginOverlay.style.display = 'none';
}

// Thiết lập các sự kiện
function setupEventListeners() {
  // Sự kiện đăng nhập
  const loginSubmit = document.getElementById('login-submit');
  if (loginSubmit) {
    loginSubmit.addEventListener('click', handleLogin);
  }
  
  // Nhấn Enter để đăng nhập
  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        handleLogin(e);
      }
    });
  }
  
  // Sự kiện đăng xuất
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Lọc phiên chat
  const sessionFilter = document.getElementById('session-filter');
  if (sessionFilter) {
    sessionFilter.addEventListener('change', filterSessions);
  }

  // Cài đặt dark mode toggle
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    const savedDarkMode = localStorage.getItem('dark-mode') === 'true';
    darkModeToggle.checked = savedDarkMode;
    
    if (savedDarkMode) {
      document.body.classList.add('dark-mode');
    }
    
    darkModeToggle.addEventListener('change', function() {
      if (this.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('dark-mode', 'true');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('dark-mode', 'false');
      }
    });
  }
  
  // Kiểm tra sự kiện nút xóa phiên trong phần chat header
  const headerDeleteBtn = document.getElementById('delete-session-btn');
  if (headerDeleteBtn) {
    headerDeleteBtn.addEventListener('click', deleteSession);
  }
  
  // Thiết lập sự kiện cho các cài đặt khác
  setupSettings();
}

// Thiết lập điều hướng tab
function setupTabNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const contentSections = document.querySelectorAll('.content-section');
  
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Xóa trạng thái active từ tất cả các menu items
      menuItems.forEach(mi => mi.classList.remove('active'));
      
      // Thêm trạng thái active cho menu item được chọn
      item.classList.add('active');
      
      // Ẩn tất cả các phần nội dung
      contentSections.forEach(section => section.classList.remove('active'));
      
      // Hiển thị phần nội dung tương ứng
      const targetSection = item.dataset.section;
      const contentSection = document.getElementById(`${targetSection}-section`);
      if (contentSection) {
        contentSection.classList.add('active');
        
        
        // Nếu chuyển sang tab mẫu câu, khởi tạo các sự kiện mẫu câu
        if (targetSection === 'templates') {
          setupTemplates();
        }
      }
    });
  });
}

// Thiết lập cài đặt
function setupSettings() {
  // Dark mode toggle - Using the same implementation as above
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    // Kiểm tra cài đặt đã lưu
    const darkMode = localStorage.getItem('dark-mode') === 'true';
    darkModeToggle.checked = darkMode;
    
    if (darkMode) {
      document.body.classList.add('dark-mode');
    }
    
    darkModeToggle.addEventListener('change', function() {
      if (this.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('dark-mode', 'true');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('dark-mode', 'false');
      }
    });
  }
  
  // Font size setting
  const fontSizeSetting = document.getElementById('font-size-setting');
  if (fontSizeSetting) {
    // Kiểm tra cài đặt đã lưu
    const fontSize = localStorage.getItem('font-size') || 'medium';
    fontSizeSetting.value = fontSize;
    
    document.body.classList.add(`font-${fontSize}`);
    
    fontSizeSetting.addEventListener('change', () => {
      // Xóa tất cả các class font size
      document.body.classList.remove('font-small', 'font-medium', 'font-large');
      // Thêm class mới
      document.body.classList.add(`font-${fontSizeSetting.value}`);
      localStorage.setItem('font-size', fontSizeSetting.value);
    });
  }
  
  // Thiết lập âm thanh thông báo
  const notificationSoundToggle = document.getElementById('notification-sound');
  if (notificationSoundToggle) {
    // Kiểm tra cài đặt đã lưu
    const notificationSound = localStorage.getItem('notification-sound') !== 'false';
    notificationSoundToggle.checked = notificationSound;
    
    notificationSoundToggle.addEventListener('change', () => {
      localStorage.setItem('notification-sound', notificationSoundToggle.checked);
      // Kiểm tra thiết lập ngay lập tức
      if (notificationSoundToggle.checked) {
        playNotificationSound('test');
      }
    });
  }
  
  // Thiết lập loại âm thanh thông báo
  const notificationSoundType = document.getElementById('notification-sound-type');
  if (notificationSoundType) {
    // Kiểm tra cài đặt đã lưu
    const soundType = localStorage.getItem('notification-sound-type') || 'default';
    notificationSoundType.value = soundType;
    
    // Thêm debounce để tránh gọi nhiều lần khi người dùng thay đổi nhanh
    let soundTypeChangeTimeout;
    
    notificationSoundType.addEventListener('change', () => {
      const selectedSoundType = notificationSoundType.value;
      localStorage.setItem('notification-sound-type', selectedSoundType);
      
      // Sử dụng debounce để tránh phát nhiều âm thanh liên tiếp
      clearTimeout(soundTypeChangeTimeout);
      soundTypeChangeTimeout = setTimeout(() => {
        // Phát âm thanh để kiểm tra
        if (notificationSoundToggle && notificationSoundToggle.checked) {
          playNotificationSound('test');
        }
      }, 300);
    });
  }
  
  // Nút nghe thử âm thanh
  const testSoundBtn = document.getElementById('test-sound-btn');
  if (testSoundBtn) {
    testSoundBtn.addEventListener('click', () => {
      if (notificationSoundToggle && notificationSoundToggle.checked) {
        playNotificationSound('test');
      } else {
        showNotification('Bạn cần bật âm thanh thông báo trước', 'warning');
      }
    });
  }
  
  // Thiết lập thông báo desktop
  const desktopNotificationsToggle = document.getElementById('desktop-notifications');
  if (desktopNotificationsToggle) {
    // Kiểm tra cài đặt đã lưu và quyền thông báo
    const desktopNotificationsEnabled = localStorage.getItem('desktop-notifications') !== 'false';
    desktopNotificationsToggle.checked = desktopNotificationsEnabled;
    
    desktopNotificationsToggle.addEventListener('change', () => {
      if (desktopNotificationsToggle.checked) {
        // Yêu cầu quyền thông báo
        requestNotificationPermission();
      }
      localStorage.setItem('desktop-notifications', desktopNotificationsToggle.checked);
    });
    
    // Kiểm tra quyền thông báo khi tải trang
    checkNotificationPermission();
  }
  
  // Thiết lập tự động trả lời
  const autoReplyToggle = document.getElementById('auto-reply');
  if (autoReplyToggle) {
    // Kiểm tra cài đặt đã lưu
    const autoReplyEnabled = localStorage.getItem('auto-reply') === 'true';
    autoReplyToggle.checked = autoReplyEnabled;
    
    autoReplyToggle.addEventListener('change', () => {
      localStorage.setItem('auto-reply', autoReplyToggle.checked);
      
      // Hiện/ẩn textarea cài đặt nội dung tự động trả lời
      const autoReplyContentWrapper = document.getElementById('auto-reply-content-wrapper');
      if (autoReplyContentWrapper) {
        autoReplyContentWrapper.style.display = autoReplyToggle.checked ? 'block' : 'none';
      }
    });
    
    // Khởi tạo hiển thị textarea dựa trên trạng thái
    const autoReplyContentWrapper = document.getElementById('auto-reply-content-wrapper');
    if (autoReplyContentWrapper) {
      autoReplyContentWrapper.style.display = autoReplyEnabled ? 'block' : 'none';
    }
    
    // Lưu nội dung tự động trả lời
    const autoReplyContent = document.getElementById('auto-reply-content');
    if (autoReplyContent) {
      // Lấy nội dung đã lưu
      autoReplyContent.value = localStorage.getItem('auto-reply-content') || 'Cảm ơn bạn đã liên hệ. Nhân viên sẽ phản hồi trong thời gian sớm nhất.';
      
      // Lắng nghe sự kiện thay đổi
      autoReplyContent.addEventListener('input', () => {
        localStorage.setItem('auto-reply-content', autoReplyContent.value);
      });
    }
  }
  
  // Thiết lập theme màu
  const colorThemeSelect = document.getElementById('color-theme');
  if (colorThemeSelect) {
    // Kiểm tra cài đặt đã lưu
    const colorTheme = localStorage.getItem('color-theme') || 'default';
    colorThemeSelect.value = colorTheme;
    
    // Áp dụng theme màu
    applyColorTheme(colorTheme);
    
    colorThemeSelect.addEventListener('change', () => {
      const selectedTheme = colorThemeSelect.value;
      applyColorTheme(selectedTheme);
      localStorage.setItem('color-theme', selectedTheme);
    });
  }
  
  // Lưu tất cả cài đặt
  const saveSettingsBtn = document.getElementById('save-settings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // Hiển thị thông báo đã lưu
      showNotification('Đã lưu cài đặt của bạn!', 'success');
    });
  }
  
  // Cài đặt mẫu câu trả lời
  setupTemplates();
}

// Áp dụng theme màu
function applyColorTheme(theme) {
  // Xóa tất cả class theme cũ
  document.body.classList.remove('theme-default', 'theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
  
  // Thêm class theme mới
  document.body.classList.add(`theme-${theme}`);
  
  // Cập nhật biến CSS tương ứng với theme
  switch (theme) {
    case 'blue':
      document.documentElement.style.setProperty('--primary-color', '#3B82F6');
      document.documentElement.style.setProperty('--primary-light', '#60A5FA');
      document.documentElement.style.setProperty('--primary-dark', '#2563EB');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)');
      break;
    case 'green':
      document.documentElement.style.setProperty('--primary-color', '#10B981');
      document.documentElement.style.setProperty('--primary-light', '#34D399');
      document.documentElement.style.setProperty('--primary-dark', '#059669');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #10B981 0%, #059669 100%)');
      break;
    case 'purple':
      document.documentElement.style.setProperty('--primary-color', '#8B5CF6');
      document.documentElement.style.setProperty('--primary-light', '#A78BFA');
      document.documentElement.style.setProperty('--primary-dark', '#7C3AED');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)');
      break;
    case 'orange':
      document.documentElement.style.setProperty('--primary-color', '#F59E0B');
      document.documentElement.style.setProperty('--primary-light', '#FBBF24');
      document.documentElement.style.setProperty('--primary-dark', '#D97706');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)');
      break;
    default: // Default theme (indigo)
      document.documentElement.style.setProperty('--primary-color', '#6366F1');
      document.documentElement.style.setProperty('--primary-light', '#818CF8');
      document.documentElement.style.setProperty('--primary-dark', '#4F46E5');
      document.documentElement.style.setProperty('--background-gradient', 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)');
      break;
  }
}

// Xử lý thông báo desktop
function checkNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Trình duyệt này không hỗ trợ thông báo desktop');
    const desktopNotificationsToggle = document.getElementById('desktop-notifications');
    if (desktopNotificationsToggle) {
      desktopNotificationsToggle.checked = false;
      desktopNotificationsToggle.disabled = true;
    }
    return;
  }
  
  if (Notification.permission === 'denied') {
    console.log('Quyền thông báo đã bị từ chối');
    const desktopNotificationsToggle = document.getElementById('desktop-notifications');
    if (desktopNotificationsToggle) {
      desktopNotificationsToggle.checked = false;
    }
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return;
  }
  
  Notification.requestPermission().then(permission => {
    if (permission !== 'granted') {
      console.log('Quyền thông báo không được cấp');
      const desktopNotificationsToggle = document.getElementById('desktop-notifications');
      if (desktopNotificationsToggle) {
        desktopNotificationsToggle.checked = false;
      }
    }
  });
}

// Hiển thị thông báo desktop
function showDesktopNotification(title, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  
  // Kiểm tra xem người dùng có bật thông báo desktop không
  if (localStorage.getItem('desktop-notifications') === 'false') {
    return;
  }
  
  const notification = new Notification(title, {
    body: message,
    icon: '/logo.png'
  });
  
  notification.onclick = function() {
    window.focus();
    this.close();
  };
  
  // Tự đóng sau 5 giây
  setTimeout(() => notification.close(), 5000);
}

// Phát âm thanh thông báo
function playNotificationSound(type) {
  // Kiểm tra xem người dùng có bật âm thanh thông báo không
  if (localStorage.getItem('notification-sound') === 'false') {
    return;
  }
  
  // Lấy loại âm thanh từ cài đặt
  const selectedSoundType = localStorage.getItem('notification-sound-type') || 'default';
  
  let soundPath;
  
  // Tạo các dạng âm thanh khác nhau theo loại
  const getAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    return new AudioContext();
  };
  
  // Tạo âm thanh động nếu không tìm thấy file
  const createDynamicSound = (frequency, duration, type = 'sine') => {
    try {
      const audioCtx = getAudioContext();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
      
      return true;
    } catch (error) {
      console.error("Không thể tạo âm thanh động:", error);
      return false;
    }
  };
  
  // Xác định đường dẫn âm thanh dựa trên loại và cài đặt
  if (type === 'test') {
    // Sử dụng âm thanh test để kiểm tra
    switch (selectedSoundType) {
      case 'beep':
        // Tạo âm thanh beep (âm thanh vuông với tần số cao)
        if (createDynamicSound(1000, 0.2, 'square')) {
          return;
        }
        soundPath = '/sounds/beep/test-notification.mp3';
        break;
      case 'chime':
        // Tạo âm thanh chime (âm thanh sin với tần số trung bình)
        if (createDynamicSound(784, 0.5)) {
          return;
        }
        soundPath = '/sounds/chime/test-notification.mp3';
        break;
      case 'ding':
        // Tạo âm thanh ding (âm thanh sin với tần số cao)
        if (createDynamicSound(1200, 0.3)) {
          return;
        }
        soundPath = '/sounds/ding/test-notification.mp3';
        break;
      case 'custom':
        soundPath = '/sounds/custom/test-notification.mp3';
        break;
      default:
        // Âm thanh mặc định (âm thanh sin với tần số thay đổi)
        if (createDynamicSound(659.25, 0.3)) {
          return;
        }
        soundPath = '/sounds/test-notification.mp3';
        break;
    }
  } else {
    // Sử dụng âm thanh thông thường
    switch (type) {
      case 'message':
        switch (selectedSoundType) {
          case 'beep':
            // Tạo âm thanh beep cho tin nhắn
            if (createDynamicSound(900, 0.2, 'square')) {
              return;
            }
            soundPath = '/sounds/beep/message.mp3';
            break;
          case 'chime':
            // Tạo âm thanh chime cho tin nhắn
            if (createDynamicSound(700, 0.4)) {
              return;
            }
            soundPath = '/sounds/chime/message.mp3';
            break;
          case 'ding':
            // Tạo âm thanh ding cho tin nhắn
            if (createDynamicSound(1100, 0.2)) {
              return;
            }
            soundPath = '/sounds/ding/message.mp3';
            break;
          case 'custom':
            soundPath = '/sounds/custom/message.mp3';
            break;
          default:
            soundPath = '/sounds/message.mp3';
            break;
        }
        break;
        
      case 'new-session':
        switch (selectedSoundType) {
          case 'beep':
            // Tạo âm thanh beep cho phiên mới (2 beep liên tiếp)
            if (createDynamicSound(800, 0.4, 'square')) {
              setTimeout(() => createDynamicSound(1000, 0.4, 'square'), 500);
              return;
            }
            soundPath = '/sounds/beep/new-session.mp3';
            break;
          case 'chime':
            // Tạo âm thanh chime cho phiên mới (2 note)
            if (createDynamicSound(523.25, 0.3)) {
              setTimeout(() => createDynamicSound(783.99, 0.3), 350);
              return;
            }
            soundPath = '/sounds/chime/new-session.mp3';
            break;
          case 'ding':
            // Tạo âm thanh ding cho phiên mới (2 ding)
            if (createDynamicSound(1100, 0.2)) {
              setTimeout(() => createDynamicSound(1300, 0.3), 300);
              return;
            }
            soundPath = '/sounds/ding/new-session.mp3';
            break;
          case 'custom':
            soundPath = '/sounds/custom/new-session.mp3';
            break;
          default:
            soundPath = '/sounds/new-session.mp3';
            break;
        }
        break;
        
      default:
        switch (selectedSoundType) {
          case 'beep':
            // Tạo âm thanh beep cho thông báo
            if (createDynamicSound(600, 0.1, 'square')) {
              setTimeout(() => createDynamicSound(800, 0.1, 'square'), 200);
              setTimeout(() => createDynamicSound(1000, 0.1, 'square'), 400);
              return;
            }
            soundPath = '/sounds/beep/notification.mp3';
            break;
          case 'chime':
            // Tạo âm thanh chime cho thông báo
            if (createDynamicSound(440, 0.4)) {
              setTimeout(() => createDynamicSound(880, 0.4), 450);
              return;
            }
            soundPath = '/sounds/chime/notification.mp3';
            break;
          case 'ding':
            // Tạo âm thanh ding cho thông báo
            if (createDynamicSound(1000, 0.2)) {
              setTimeout(() => createDynamicSound(1200, 0.3), 250);
              return;
            }
            soundPath = '/sounds/ding/notification.mp3';
            break;
          case 'custom':
            soundPath = '/sounds/custom/notification.mp3';
            break;
          default:
            soundPath = '/sounds/notification.mp3';
            break;
        }
        break;
    }
  }
  
  console.log("Playing sound:", soundPath);
  
  // Phát âm thanh
  const sound = new Audio(soundPath);
  
  sound.onerror = function() {
    console.error('Không thể tải file âm thanh:', soundPath);
    // Sử dụng âm thanh mặc định nếu không tìm thấy
    const defaultSound = new Audio('/sounds/message.mp3');
    defaultSound.play().catch(error => {
      console.error('Không thể phát âm thanh mặc định:', error);
      // Nếu không thể phát âm thanh mặc định, tạo âm thanh động
      createDynamicSound(880, 0.3);
    });
  };
  
  sound.play().catch(error => {
    console.error('Không thể phát âm thanh thông báo:', error);
    // Sử dụng âm thanh động nếu không thể phát âm thanh từ file
    createDynamicSound(880, 0.3);
  });
}

// Hiển thị thông báo trong ứng dụng
function showNotification(message, type = 'info') {
  // Kiểm tra xem container thông báo đã tồn tại chưa
  let notificationContainer = document.getElementById('notification-container');
  
  if (!notificationContainer) {
    // Tạo container nếu chưa tồn tại
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    document.body.appendChild(notificationContainer);
  }
  
  // Tạo thông báo mới
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  // Thêm icon dựa vào loại thông báo
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<i class="fas fa-check-circle"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-exclamation-circle"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
    default:
      icon = '<i class="fas fa-info-circle"></i>';
      break;
  }
  
  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-content">${message}</div>
    <button class="notification-close"><i class="fas fa-times"></i></button>
  `;
  
  // Thêm vào container
  notificationContainer.appendChild(notification);
  
  // Thêm nút đóng thông báo
  const closeButton = notification.querySelector('.notification-close');
  closeButton.addEventListener('click', () => {
    notification.classList.add('notification-hide');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // Tự động đóng sau 5 giây
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('notification-hide');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }, 5000);
}

// Thiết lập mẫu câu trả lời
function setupTemplates() {
  console.log('Thiết lập các sự kiện cho mẫu câu...');
  
  // Sự kiện khi nhấp vào mẫu câu
  const templateItems = document.querySelectorAll('.template-item .template-content');
  
  if (templateItems.length > 0) {
    console.log(`Tìm thấy ${templateItems.length} mẫu câu`);
    
    templateItems.forEach(item => {
      // Xóa sự kiện cũ (nếu có) để tránh trùng lặp
      item.removeEventListener('click', templateClickHandler);
      
      // Thêm sự kiện mới
      item.addEventListener('click', templateClickHandler);
    });
  } else {
    console.log('Không tìm thấy mẫu câu nào');
  }
  
  // Nút thêm mẫu mới
  const addTemplateBtn = document.getElementById('add-template-btn');
  if (addTemplateBtn) {
    // Xóa sự kiện cũ
    addTemplateBtn.removeEventListener('click', addTemplateHandler);
    
    // Thêm sự kiện mới
    addTemplateBtn.addEventListener('click', addTemplateHandler);
  }
  
  // Nút sửa mẫu
  const editBtns = document.querySelectorAll('.template-edit-btn');
  if (editBtns.length > 0) {
    editBtns.forEach(btn => {
      // Xóa sự kiện cũ
      btn.removeEventListener('click', editTemplateHandler);
      
      // Thêm sự kiện mới
      btn.addEventListener('click', editTemplateHandler);
    });
  }
  
  // Nút xóa mẫu
  const deleteBtns = document.querySelectorAll('.template-delete-btn');
  if (deleteBtns.length > 0) {
    deleteBtns.forEach(btn => {
      // Xóa sự kiện cũ
      btn.removeEventListener('click', deleteTemplateHandler);
      
      // Thêm sự kiện mới
      btn.addEventListener('click', deleteTemplateHandler);
    });
  }
  
  // Đồng bộ mẫu câu với câu trả lời nhanh
  syncTemplates();
}

// Xử lý sự kiện click vào mẫu câu
function templateClickHandler(event) {
  console.log('Mẫu câu được click');
  const templateContent = event.currentTarget.querySelector('p')?.textContent || event.currentTarget.textContent;
  insertTemplate(templateContent.trim());
}

// Xử lý thêm mẫu mới
function addTemplateHandler() {
  console.log('Thêm mẫu mới được click');
  
  // Tạo mẫu câu mới với prompt đơn giản
  const newTemplateContent = prompt('Nhập nội dung mẫu câu mới:');
  
  if (newTemplateContent && newTemplateContent.trim()) {
    const templatesContainer = document.querySelector('.templates-list');
    if (templatesContainer) {
      // Tạo phần tử mới
      const newTemplate = document.createElement('div');
      newTemplate.className = 'template-item';
      newTemplate.innerHTML = `
        <div class="template-content">
          <p>${newTemplateContent.trim()}</p>
        </div>
        <div class="template-actions">
          <button class="template-edit-btn"><i class="fas fa-edit"></i></button>
          <button class="template-delete-btn"><i class="fas fa-trash"></i></button>
        </div>
      `;
      
      // Thêm vào danh sách
      templatesContainer.appendChild(newTemplate);
      
      // Thiết lập lại sự kiện
      setupTemplates();
      
      // Đồng bộ với câu trả lời nhanh
      syncTemplates();
      
      // Thông báo thành công
      showNotification('Đã thêm mẫu câu mới', 'success');
    }
  }
}

// Xử lý sửa mẫu
function editTemplateHandler(event) {
  event.stopPropagation();
  console.log('Sửa mẫu được click');
  
  const templateItem = event.currentTarget.closest('.template-item');
  const templateContentElement = templateItem.querySelector('.template-content p');
  const currentContent = templateContentElement?.textContent.trim() || '';
  
  // Lấy nội dung mới
  const newContent = prompt('Chỉnh sửa mẫu câu:', currentContent);
  
  if (newContent !== null && templateContentElement) {
    templateContentElement.textContent = newContent.trim();
    
    // Đồng bộ với câu trả lời nhanh
    syncTemplates();
    
    // Thông báo thành công
    showNotification('Cập nhật mẫu câu thành công', 'success');
  }
}

// Xử lý xóa mẫu
function deleteTemplateHandler(event) {
  event.stopPropagation();
  console.log('Xóa mẫu được click');
  
  if (confirm('Bạn có chắc muốn xóa mẫu này không?')) {
    const templateItem = event.currentTarget.closest('.template-item');
    
    if (templateItem) {
      templateItem.remove();
      
      // Đồng bộ với câu trả lời nhanh
      syncTemplates();
      
      // Thông báo thành công
      showNotification('Đã xóa mẫu câu', 'info');
    }
  }
}

// Chèn mẫu câu vào ô nhập tin nhắn
function insertTemplate(text) {
  console.log('Chèn mẫu câu:', text);
  
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    // Thay thế các biến trong mẫu
    let processedText = text;
    
    // Thay thế ${name} bằng tên nhân viên
    if (currentUser) {
      processedText = processedText.replace(/\${name}/g, currentUser.name || currentUser.username);
    }
    
    // Thay thế ${time} bằng thời gian hiện tại
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                   now.getMinutes().toString().padStart(2, '0');
    processedText = processedText.replace(/\${time}/g, timeStr);
    
    // Thay thế ${date} bằng ngày hiện tại
    const dateStr = now.getDate().toString().padStart(2, '0') + '/' + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + '/' + 
                   now.getFullYear();
    processedText = processedText.replace(/\${date}/g, dateStr);
    
    chatInput.value = processedText;
    chatInput.focus();
    
    // Hiệu ứng làm nổi bật ô nhập liệu
    chatInput.classList.add('highlight-input');
    setTimeout(() => {
      chatInput.classList.remove('highlight-input');
    }, 300);
  } else {
    showNotification('Vui lòng chọn một phiên chat trước', 'warning');
  }
}

// Xử lý đăng nhập
function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorElement = document.getElementById('login-error');

  if (!username || !password) {
    if (errorElement) errorElement.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu';
    return;
  }

  // Gọi API đăng nhập - sửa đường dẫn đúng
  fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Login failed');
  })
  .then(data => {
    // Kiểm tra quyền
    if (data.user && (data.user.role !== 'staff' && data.user.role !== 'admin')) {
      if (errorElement) errorElement.textContent = 'Tài khoản không có quyền truy cập';
      throw new Error('No permission');
    }

    // Lưu token
    localStorage.setItem('auth_token', data.token);
    
    // Cập nhật user hiện tại
    currentUser = data.user;
    
    // Ẩn form đăng nhập
    hideLoginForm();
    
    // Khởi tạo giao diện
    initializeStaffInterface();
    
    // Hiển thị tên và vai trò
    const staffName = document.getElementById('staff-name');
    if (staffName) {
      staffName.textContent = `${data.user.name || data.user.username}`;
    }
  })
  .catch(error => {
    console.error('Login error:', error);
    if (errorElement) {
      errorElement.textContent = 'Tên đăng nhập hoặc mật khẩu không đúng';
      errorElement.style.display = 'block';
    }
  });
}

// Khởi tạo giao diện nhân viên
function initializeStaffInterface() {
  // Khởi tạo socket
  initializeSocket();
  
  // Tải danh sách phiên hỗ trợ
  fetchSupportSessions();
}

// Xử lý logout
function handleLogout() {
  // Xóa token
  localStorage.removeItem('auth_token');
  
  // Ngắt kết nối socket
  if (socket) {
    socket.disconnect();
  }
  
  // Reset state
  currentUser = null;
  currentSessionId = null;
  sessionList = [];
  
  // Hiển thị form đăng nhập
  showLoginForm();
}

// Tải danh sách phiên hỗ trợ
function fetchSupportSessions() {
  const token = localStorage.getItem('auth_token');

  fetch(`${API_BASE_URL}/support/sessions`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to fetch sessions');
  })
  .then(data => {
    console.log('Received sessions:', data); // Log để debug
    
    // Lọc các phiên không hợp lệ
    const newSessions = data.filter(session => session && session.id);
    
    // Lưu thứ tự hiện tại và thêm vào các phiên mới
    if (sessionList.length === 0) {
      // Trường hợp danh sách trống, sắp xếp theo thời gian mới nhất
      sessionList = newSessions.sort((a, b) => {
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });
    } else {
      // Trường hợp danh sách có dữ liệu, giữ nguyên thứ tự hiện tại và thêm phiên mới vào đầu
      const existingIds = new Set(sessionList.map(s => s.id));
      const brandNewSessions = newSessions.filter(s => !existingIds.has(s.id));
      
      // Cập nhật thông tin cho các phiên đã có
      sessionList = sessionList.map(existingSession => {
        const updatedSession = newSessions.find(s => s.id === existingSession.id);
        return updatedSession || existingSession; // Ưu tiên phiên cập nhật, nếu không có thì giữ phiên cũ
      });
      
      // Thêm các phiên mới vào đầu danh sách
      if (brandNewSessions.length > 0) {
        const sortedNewSessions = brandNewSessions.sort((a, b) => {
          return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
        });
        sessionList = [...sortedNewSessions, ...sessionList];
      }
    }
    
    if (sessionList.length === 0) {
      const sessionsContainer = document.getElementById('sessions-list');
      if (sessionsContainer) {
        sessionsContainer.innerHTML = '<div class="empty-message">Chưa có phiên hỗ trợ nào</div>';
      }
    } else {
      renderSessionList(sessionList);
    }
  })
  .catch(error => {
    console.error('Error fetching sessions:', error);
    const sessionsContainer = document.getElementById('sessions-list');
    if (sessionsContainer) {
      sessionsContainer.innerHTML = '<div class="error-message">Không thể tải danh sách phiên</div>';
    }
  });

  // Tự động cập nhật sau mỗi 30 giây
  setTimeout(fetchSupportSessions, 30000);
}

// Hiển thị danh sách phiên
function renderSessionList(sessions) {
  const sessionContainer = document.getElementById('sessions-list');
  if (sessionContainer) sessionContainer.innerHTML = '';

  if (sessions.length === 0) {
    if (sessionContainer) sessionContainer.innerHTML = '<div class="empty-message">Không có phiên hỗ trợ nào</div>';
    return;
  }

  sessions.forEach(session => {
    // Tạo phần tử hiển thị phiên
    const sessionItem = document.createElement('div');
    sessionItem.className = 'session-item';
    sessionItem.dataset.sessionId = session.id;

    // Thêm class active nếu là phiên hiện tại
    if (session.id === currentSessionId) {
      sessionItem.classList.add('active');
    }

    // Xác định trạng thái phiên
    let statusBadge = '';
    if (session.isHumanAssigned && session.assignedTo === currentUser.id) {
      statusBadge = '<span class="status-badge mine">Của tôi</span>';
    } else if (session.isHumanAssigned) {
      statusBadge = '<span class="status-badge active">Đang xử lý</span>';
    } else if (session.needsHumanSupport) {
      statusBadge = '<span class="status-badge waiting">Chờ hỗ trợ</span>';
    }

    // Định dạng thời gian
    const sessionTime = formatTime(new Date(session.updatedAt || session.createdAt));

    // Lấy tin nhắn cuối cùng nếu có
    let lastMessage = 'Chưa có tin nhắn';
    if (session.lastMessage) {
      lastMessage = session.lastMessage.content;
    }

    // Hiển thị thông tin phiên
    sessionItem.innerHTML = `
      <div class="user-name">
        Phiên ${session.id.substr(0, 8)}... ${statusBadge}
      </div>
      <div class="last-message">${lastMessage}</div>
      <div class="session-time">${sessionTime}</div>
    `;

    // Sự kiện khi click vào phiên - chỉ chọn phiên, không sắp xếp lại
    sessionItem.addEventListener('click', (e) => {
      e.preventDefault();
      selectSession(session.id);
      return false;
    });

    if (sessionContainer) sessionContainer.appendChild(sessionItem);
  });
}

// Lọc danh sách phiên
function filterSessions() {
  const filterValue = document.getElementById('session-filter').value;
  let filteredSessions = sessionList;

  // Lọc theo trạng thái
  switch (filterValue) {
    case 'waiting':
      filteredSessions = sessionList.filter(session => 
        session.needsHumanSupport && !session.isHumanAssigned
      );
      break;
    case 'active':
      filteredSessions = sessionList.filter(session => 
        session.isHumanAssigned
      );
      break;
    case 'my':
      filteredSessions = sessionList.filter(session => 
        session.assignedTo === currentUser.id
      );
      break;
  }

  renderSessionList(filteredSessions);
}

// Chọn phiên hỗ trợ
function selectSession(sessionId) {
  currentSessionId = sessionId;

  // Đánh dấu phiên đang chọn nhưng không reorder
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.sessionId === sessionId) {
      item.classList.add('active');
    }
  });
  
  // Giữ nguyên thứ tự hiển thị, không sắp xếp lại danh sách

  // Ẩn thông báo chưa chọn phiên
  const noSessionSelected = document.querySelector('.no-chat-selected');
  if (noSessionSelected) {
    noSessionSelected.style.display = 'none';
  }

  // Hiển thị giao diện chat
  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    chatContainer.innerHTML = `
      <div class="chat-support-container">
        <div class="chat-header">
          <div class="chat-header-info">
            <span class="session-badge">Phiên ${sessionId.substr(0, 8)}...</span>
          </div>
          <div class="chat-header-actions">
            <button id="end-session-btn" class="chat-header-button end-session-btn" title="Kết thúc phiên">
              <i class="fas fa-times-circle"></i>
              <span>Kết thúc phiên</span>
            </button>
            <button id="delete-chat-session-btn" class="chat-header-button delete-session-btn" title="Xóa phiên">
              <i class="fas fa-trash"></i>
              <span>Xóa phiên</span>
            </button>
          </div>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <div class="chat-input-form">
          <input type="text" id="chat-input" placeholder="Nhập tin nhắn của bạn...">
          <button id="send-message-btn">
            <i class="fas fa-paper-plane"></i> Gửi
          </button>
        </div>
        <div class="quick-responses">
          <div class="quick-response-item">Xin chào! Tôi là ${name} từ bộ phận hỗ trợ khách hàng. Tôi có thể giúp gì cho bạn?</div>
          <div class="quick-response-item">Cảm ơn bạn đã liên hệ với chúng tôi. Chúng tôi sẽ xem xét vấn đề này và phản hồi sớm nhất có thể.</div>
          <div class="quick-response-item">Bạn có thể cung cấp thêm thông tin chi tiết về vấn đề bạn đang gặp phải không?</div>
          <div class="quick-response-item">Vui lòng đợi trong giây lát, tôi đang kiểm tra thông tin.</div>
        </div>
      </div>
    `;

    // Thêm lại các event handler cho các nút mới
    const sendButton = document.getElementById('send-message-btn');
    if (sendButton) {
      sendButton.addEventListener('click', sendMessage);
    }

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });
    }

    const endSessionBtn = document.getElementById('end-session-btn');
    if (endSessionBtn) {
      endSessionBtn.addEventListener('click', endSession);
    }
    
    // Thêm event handler cho nút xóa phiên
    const deleteSessionBtn = document.getElementById('delete-chat-session-btn');
    if (deleteSessionBtn) {
      deleteSessionBtn.addEventListener('click', deleteSession);
    }

    // Thiết lập câu trả lời nhanh
    setupQuickResponses();
  }

  // Kết nối socket với phiên hiện tại
  joinChatSession(sessionId);

  // Kiểm tra và tiếp nhận phiên nếu cần
  const selectedSession = sessionList.find(session => session.id === sessionId);

  if (selectedSession && selectedSession.needsHumanSupport && !selectedSession.isHumanAssigned) {
    // Phiên cần hỗ trợ và chưa được tiếp nhận, tiếp nhận trước rồi mới tải tin nhắn
    assignSession(sessionId)
      .then(() => {
        // Sau khi tiếp nhận thành công, tải tin nhắn
        fetchSessionMessages(sessionId);
      })
      .catch(error => {
        console.error('Failed to assign session:', error);
        // Vẫn thử tải tin nhắn ngay cả khi không tiếp nhận được
        fetchSessionMessages(sessionId);
      });
  } else {
    // Phiên đã được tiếp nhận, tải tin nhắn ngay
    fetchSessionMessages(sessionId);
  }
}

// Thiết lập câu trả lời nhanh
function setupQuickResponses() {
  const quickResponseItems = document.querySelectorAll('.quick-response-item');
  if (quickResponseItems) {
    quickResponseItems.forEach(item => {
      // Xóa sự kiện cũ nếu có
      item.removeEventListener('click', quickResponseClickHandler);
      
      // Thêm sự kiện mới
      item.addEventListener('click', quickResponseClickHandler);
    });
  }
  
  // Thêm nút để mở tab mẫu câu
  const quickResponsesContainer = document.querySelector('.quick-responses');
  if (quickResponsesContainer && !document.getElementById('show-templates-btn')) {
    const showTemplatesBtn = document.createElement('button');
    showTemplatesBtn.id = 'show-templates-btn';
    showTemplatesBtn.className = 'quick-response-more';
    showTemplatesBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i> Xem thêm mẫu câu';
    showTemplatesBtn.addEventListener('click', () => {
      // Chuyển sang tab mẫu câu
      const templatesMenuItem = document.querySelector('.menu-item[data-section="templates"]');
      if (templatesMenuItem) {
        templatesMenuItem.click();
      }
    });
    quickResponsesContainer.appendChild(showTemplatesBtn);
  }
}

// Xử lý sự kiện khi click vào câu trả lời nhanh
function quickResponseClickHandler(event) {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    // Lấy nội dung và xử lý các biến
    let content = event.currentTarget.textContent;
    
    // Thay thế ${name} bằng tên nhân viên
    if (currentUser) {
      content = content.replace(/\${name}/g, currentUser.name || currentUser.username);
    }
    
    // Thay thế ${time} bằng thời gian hiện tại
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                   now.getMinutes().toString().padStart(2, '0');
    content = content.replace(/\${time}/g, timeStr);
    
    // Thay thế ${date} bằng ngày hiện tại
    const dateStr = now.getDate().toString().padStart(2, '0') + '/' + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + '/' + 
                   now.getFullYear();
    content = content.replace(/\${date}/g, dateStr);
    
    chatInput.value = content;
    chatInput.focus();
    
    // Hiệu ứng làm nổi bật ô nhập liệu
    chatInput.classList.add('highlight-input');
    setTimeout(() => {
      chatInput.classList.remove('highlight-input');
    }, 300);
  }
}

// Tham gia vào phiên chat qua socket
function joinChatSession(sessionId) {
  if (!socket || !sessionId) {
    console.error('Không thể tham gia phiên: socket hoặc sessionId không hợp lệ');
    return;
  }
  
  console.log(`Đang cố gắng tham gia phiên chat: ${sessionId}`);
  
  // Rời khỏi phòng chat trước đó nếu có
  if (socket.previousSessionId) {
    console.log(`Rời khỏi phòng chat cũ: ${socket.previousSessionId}`);
    socket.emit('leave-room', socket.previousSessionId);
  }
  
  // Tham gia vào phòng mới
  console.log(`Tham gia vào phòng mới: ${sessionId}`);
  socket.emit('join-room', sessionId);
  
  // Đăng ký tham gia chat
  socket.emit('join-chat', { 
    sessionId: sessionId,
    staffId: currentUser ? currentUser.id : null 
  });
  
  // Lưu session ID hiện tại
  socket.previousSessionId = sessionId;
  
  // Debug - kiểm tra xem đã tham gia phòng chưa
  setTimeout(() => {
    socket.emit('check-room-membership', { room: sessionId });
  }, 1000);
}

// Tải tin nhắn của phiên
function fetchSessionMessages(sessionId) {
  // Kiểm tra nếu đang gọi API hoặc sessionId không hợp lệ
  if (isLoadingMessages || !sessionId) {
    console.log('Không thể tải tin nhắn: đang tải hoặc sessionId không hợp lệ');
    return;
  }

  isLoadingMessages = true;

  // Đặt lại biến theo dõi tin nhắn khi chuyển phiên
  receivedMessageIds.clear();
  tempMessageMap.clear();

  const messagesContainer = document.getElementById('chat-messages');
  if (messagesContainer) messagesContainer.innerHTML = '<div class="loading-messages">Đang tải tin nhắn...</div>';

  const token = localStorage.getItem('auth_token');

  fetch(`${API_BASE_URL}/support/messages/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to fetch messages');
  })
  .then(data => {
    console.log(`Received ${data.length} messages for session ${sessionId}`);

    // Xóa thông báo đang tải
    if (messagesContainer) messagesContainer.innerHTML = '';

    // Hiển thị tin nhắn
    if (data.length === 0) {
      if (messagesContainer) messagesContainer.innerHTML = '<div class="empty-message">Chưa có tin nhắn trong phiên này</div>';
    } else {
      // Sắp xếp tin nhắn theo thời gian (đảm bảo hiển thị đúng thứ tự)
      data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Xóa tin nhắn hiện tại trước khi hiển thị tin nhắn mới
      messagesContainer.innerHTML = '';
      
      // Hiển thị tin nhắn mới
      data.forEach(message => {
        if (message && message.id) {
          receivedMessageIds.add(message.id);
          appendMessage(message);
        }
      });

      // Cuộn xuống tin nhắn mới nhất
      scrollToBottom();
    }

    // Cập nhật trạng thái phiên
    markSessionAsRead(sessionId);
  })
  .catch(error => {
    console.error('Error fetching messages:', error);
    if (messagesContainer) messagesContainer.innerHTML = '<div class="error-message">Lỗi khi tải tin nhắn</div>';
  })
  .finally(() => {
    isLoadingMessages = false;
  });
}

// Đánh dấu phiên đã đọc - API chưa hỗ trợ nhưng chuẩn bị cho tương lai
function markSessionAsRead(sessionId) {
  console.log(`Marking session ${sessionId} as read`);
  // Đây là hàm chuẩn bị cho tương lai
  // Sẽ được triển khai khi API hỗ trợ
}

// Tiếp nhận phiên hỗ trợ
function assignSession(sessionId) {
  if (!sessionId) return Promise.reject(new Error('Session ID is required'));

  const token = localStorage.getItem('auth_token');

  // Trả về Promise để có thể xử lý tiếp theo
  return fetch(`${API_BASE_URL}/support/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to assign session');
  })
  .then(data => {
    console.log('Phiên đã được tiếp nhận thành công:', data);
    // Cập nhật UI
    fetchSupportSessions();

    // Hiển thị thông báo đã tiếp nhận
    const successMessage = {
      id: 'system-' + Date.now(),
      sessionId: sessionId,
      sender: 'system',
      content: 'Bạn đã tiếp nhận phiên hỗ trợ này.',
      timestamp: new Date().toISOString()
    };
    appendMessage(successMessage);

    return data;
  })
  .catch(error => {
    console.error('Error assigning session:', error);
    throw error; // Chuyển tiếp lỗi để xử lý ở nơi gọi hàm
  });
}

// Thêm tin nhắn vào khung chat
function appendMessage(message) {
  if (!message || !message.content) {
    console.error('Invalid message object:', message);
    return;
  }
  
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  
  // Kiểm tra lần cuối xem tin nhắn đã tồn tại trong DOM chưa
  const existingMessage = document.querySelector(`.message-item[data-message-id="${message.id}"]`);
  if (existingMessage) {
    console.log(`Tin nhắn ID ${message.id} đã tồn tại trong DOM, bỏ qua`);
    return;
  }
  
  // Kiểm tra xem có tin nhắn tạm với temp-ref trỏ đến tin nhắn này không
  const tempMessageElement = document.querySelector(`.message-item[data-temp-ref="${message.id}"]`);
  if (tempMessageElement) {
    console.log(`Tin nhắn ID ${message.id} đã có bản tạm thời hiển thị, bỏ qua`);
    return;
  }

  // Tạo phần tử tin nhắn mới
  const messageElement = document.createElement('div');
  messageElement.className = `message ${message.sender} message-item`;
  messageElement.dataset.messageId = message.id;

  // Định dạng thời gian
  const messageTime = formatTime(new Date(message.timestamp));

  // Hiển thị người gửi
  let senderName = '';
  if (message.sender === 'user') {
    senderName = '<div class="sender">Khách hàng</div>';
  } else if (message.sender === 'bot') {
    senderName = '<div class="sender">Chatbot</div>';
  } else if (message.sender === 'staff') {
    senderName = '<div class="sender">Nhân viên</div>';
  } else if (message.sender === 'system') {
    senderName = '<div class="sender">Hệ thống</div>';
  }

  messageElement.innerHTML = `
    ${senderName}
    <div class="content">${message.content}</div>
    <div class="time">${messageTime}</div>
  `;

  messagesContainer.appendChild(messageElement);
  console.log(`Đã thêm tin nhắn ${message.id} với nội dung "${message.content}"`);
}

// Gửi tin nhắn
function sendMessage() {
  if (isSendingMessage) return; // Ngăn chặn gửi nhiều lần
  isSendingMessage = true;

  const input = document.getElementById('chat-input');
  const content = input.value.trim();

  if (!content || !currentSessionId) {
    isSendingMessage = false; // Đặt lại trạng thái
    return;
  }

  const token = localStorage.getItem('auth_token');

  // Tạo ID duy nhất cho tin nhắn tạm
  const tempId = 'temp-' + Date.now();

  // Tạo một bản sao tạm thời của tin nhắn để hiển thị ngay lập tức
  const tempMessage = {
    id: tempId,
    sessionId: currentSessionId,
    sender: 'staff',
    content: content,
    timestamp: new Date().toISOString()
  };

  // Xóa nội dung input ngay lập tức để cải thiện UX 
  input.value = '';

  // Hiển thị tin nhắn tạm thời ngay lập tức
  appendMessage(tempMessage);
  scrollToBottom();

  fetch(`${API_BASE_URL}/support/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId: currentSessionId,
      content
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to send message');
  })
  .then(sentMessage => {
    if (sentMessage && sentMessage.id) {
      console.log(`Tin nhắn đã được gửi thành công với ID: ${sentMessage.id}`);
      
      // Lưu mối quan hệ giữa ID thật và ID tạm
      tempMessageMap.set(sentMessage.id, tempId);
      
      // Đánh dấu ID thật đã được xử lý
      receivedMessageIds.add(sentMessage.id);
      
      // Cập nhật thuộc tính data-temp-ref của tin nhắn tạm trong DOM
      const tempElement = document.querySelector(`.message-item[data-message-id="${tempId}"]`);
      if (tempElement) {
        tempElement.dataset.tempRef = sentMessage.id;
      }
    }
  })
  .catch(error => {
    console.error('Error sending message:', error);
    // Hiển thị thông báo lỗi nếu gửi thất bại
    const errorMessage = {
      id: 'error-' + Date.now(),
      sessionId: currentSessionId,
      sender: 'system',
      content: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
      timestamp: new Date().toISOString()
    };
    appendMessage(errorMessage);
  })
  .finally(() => {
    isSendingMessage = false; // Đặt lại trạng thái sau khi hoàn thành
  });
}

// Kết thúc phiên hỗ trợ
function endSession() {
  if (!currentSessionId) return;

  if (!confirm('Bạn có chắc chắn muốn kết thúc phiên hỗ trợ này?')) {
    return;
  }

  const token = localStorage.getItem('auth_token');

  fetch(`${API_BASE_URL}/support/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId: currentSessionId
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to end session');
  })
  .then(() => {
    // Đóng phiên hiện tại
    closeChatSession();

    // Cập nhật danh sách phiên
    fetchSupportSessions();
  })
  .catch(error => {
    console.error('Error ending session:', error);
  });
}

// Thêm câu trả lời nhanh vào khung chat
function insertQuickResponse(text) {
  const inputElement = document.getElementById('chat-input');
  if (inputElement) {
    inputElement.value = text;
    inputElement.focus();
  }
}

// Cập nhật thông tin phiên hiện tại
function updateSessionInfo(sessionId) {
  const session = sessionList.find(s => s.id === sessionId);
  if (!session) return;

  // Cập nhật tiêu đề
  const clientNameElement = document.getElementById('client-name');
  if (clientNameElement) clientNameElement.textContent = `Phiên ${session.id.substr(0, 8)}...`;

  // Cập nhật thời gian
  const sessionTime = formatTime(new Date(session.createdAt));
  const sessionTimeElement = document.getElementById('session-time');
  if (sessionTimeElement) sessionTimeElement.textContent = `Bắt đầu: ${sessionTime}`;
  
  // Hiển thị đánh giá nếu có
  const ratingElement = document.getElementById('session-rating');
  if (ratingElement) {
    if (session.rating) {
      // Hiển thị đánh giá bằng sao
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (i <= session.rating) {
          starsHtml += '<i class="fas fa-star"></i>';
        } else {
          starsHtml += '<i class="far fa-star"></i>';
        }
      }
      ratingElement.innerHTML = `<div class="rating-stars">${starsHtml}</div>`;
      ratingElement.style.display = 'block';
    } else {
      ratingElement.style.display = 'none';
    }
  }
  
  // Hiển thị phản hồi đánh giá nếu có
  const feedbackElement = document.getElementById('session-feedback');
  if (feedbackElement) {
    if (session.feedback) {
      feedbackElement.textContent = `Phản hồi: "${session.feedback}"`;
      feedbackElement.style.display = 'block';
    } else {
      feedbackElement.style.display = 'none';
    }
  }
}

// Cập nhật danh sách phiên khi có tin nhắn mới
function updateSessionWithNewMessage(message) {
  // Tìm phiên trong danh sách
  const sessionIndex = sessionList.findIndex(s => s.id === message.sessionId);
  
  // Nếu không tìm thấy phiên, có thể đây là phiên mới
  if (sessionIndex === -1) {
    // Gọi API để cập nhật lại toàn bộ danh sách
    fetchSupportSessions();
    return;
  }

  // Cập nhật tin nhắn cuối cùng
  sessionList[sessionIndex].lastMessage = message;
  sessionList[sessionIndex].updatedAt = new Date();

  // Không sắp xếp lại mà chỉ cập nhật thông tin hiển thị
  renderSessionList(sessionList);
}

// Cuộn xuống cuối khung chat
function scrollToBottom() {
  const messagesContainer = document.getElementById('chat-messages');
  if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Hiển thị thông báo
function showNotification(message) {
  // Sử dụng API Notification nếu được hỗ trợ
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Tectonic Devs Support', {
        body: message,
        icon: '/logo.png'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Tectonic Devs Support', {
            body: message,
            icon: '/logo.png'
          });
        }
      });
    }
  }
}

// Hàm định dạng thời gian
function formatTime(date) {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  });
}

function closeChatSession() {
  currentSessionId = null;
  
  // Đặt lại các biến theo dõi tin nhắn
  receivedMessageIds.clear();
  tempMessageMap.clear();
  
  // Hiển thị màn hình không có phiên được chọn
  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    chatContainer.innerHTML = `
      <div class="no-chat-selected">
        <i class="fas fa-comments"></i>
        <h3>Chưa có phiên chat nào được chọn</h3>
        <p>Vui lòng chọn một phiên từ danh sách bên trái để bắt đầu cuộc hội thoại với khách hàng.</p>
      </div>
    `;
  }
  
  // Bỏ chọn tất cả các phiên trong danh sách
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Rời khỏi phòng chat socket nếu đang kết nối
  if (socket && socket.previousSessionId) {
    socket.emit('leave-room', socket.previousSessionId);
    socket.previousSessionId = null;
  }
}

// updateSessionsList function was missing from original code, adding a placeholder
function updateSessionsList(){
    //Add your implementation here
}

// Gửi tin nhắn tự động
function sendAutoReply(sessionId) {
  const token = localStorage.getItem('auth_token');
  if (!token) return;
  
  // Lấy nội dung tin nhắn tự động từ cài đặt
  const autoReplyContent = localStorage.getItem('auto-reply-content') || 
                          'Cảm ơn bạn đã liên hệ. Nhân viên sẽ phản hồi trong thời gian sớm nhất.';
  
  fetch(`${API_BASE_URL}/support/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId: sessionId,
      content: autoReplyContent
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to send auto-reply message');
  })
  .then(sentMessage => {
    console.log('Đã gửi tin nhắn tự động:', sentMessage);
  })
  .catch(error => {
    console.error('Error sending auto-reply message:', error);
  });
}


// Hàm khởi tạo
function init() {
  console.log('Khởi tạo ứng dụng staff...');
  
  // Kiểm tra trạng thái đăng nhập
  checkLoginStatus();
  
  // Thiết lập kết nối socket sau khi đăng nhập
  initializeSocket();
  
  // Khởi tạo giao diện và sự kiện
  setupEventListeners();
  setupTabNavigation();
  setupSettings();
  setupTemplates();
  setupStats();
  
  // Khởi tạo Spotify
  initializeSpotifyFeature();
  
  // Khởi tạo các tính năng voucher
  initVoucherFunctions();
}

// Hàm lấy token xác thực
function getToken() {
  return localStorage.getItem('auth_token');
}

// Kết nối socket.io
function connectSocket() {
  if (socket) {
    socket.disconnect();
  }
  
  const token = getToken();
  if (!token) return;
  
  socket = io({
    query: { token }
  });
  
  socket.on('connect', () => {
    console.log('Staff socket connected successfully');
    socket.emit('join-room', 'support-staff');
  });
  
  socket.on('new-support-request', (session) => {
    console.log('Received new support request:', session);
    
    // Phát âm thanh thông báo
    playNotificationSound('new-session');
    
    // Hiển thị thông báo desktop
    showDesktopNotification('Phiên chat mới', 'Có khách hàng mới cần hỗ trợ');
    
    // Thêm session mới vào danh sách
    if (!sessionList.some(s => s.id === session.id)) {
      sessionList.push(session);
      updateSessionsList();
      
      // Kiểm tra và gửi tin nhắn tự động nếu đã bật
      if (localStorage.getItem('auto-reply') === 'true') {
        sendAutoReply(session.id);
      }
    }
  });
  
  // Lắng nghe tin nhắn mới
  socket.on('new-message', (message) => {
    handleNewMessage(message);
  });
  
  // Lắng nghe đánh giá mới
  socket.on('new-rating', (data) => {
    console.log('Nhận đánh giá mới:', data);
    
    // Phát âm thanh thông báo
    playNotificationSound('notification');
    
    // Hiển thị thông báo desktop
    showDesktopNotification(
      'Đánh giá mới', 
      `Phiên ${data.sessionId.substring(0, 8)} đã được đánh giá ${data.rating}/5 sao`
    );
    
    // Hiển thị thông báo trong phiên chat hiện tại nếu đang mở
    if (data.sessionId === currentSessionId) {
      const ratingMessage = {
        id: 'rating-' + Date.now(),
        sessionId: data.sessionId,
        sender: 'system',
        content: `Khách hàng đã đánh giá phiên hỗ trợ: ${data.rating}/5 sao${data.feedback ? `. Góp ý: "${data.feedback}"` : ''}`,
        timestamp: new Date().toISOString()
      };
      
      appendMessage(ratingMessage);
      scrollToBottom();
    }
    
    // Cập nhật thẻ đánh giá trong danh sách phiên nếu có
    updateSessionWithRating(data.sessionId, data.rating);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
}

// Xử lý tin nhắn mới
function handleNewMessage(message) {
  console.log('Tin nhắn mới nhận được:', message);

  // Bỏ qua nếu tin nhắn này đã được xử lý
  if (receivedMessageIds.has(message.id)) {
    console.log(`Tin nhắn ID ${message.id} đã được xử lý, bỏ qua.`);
    return;
  }

  // Đánh dấu tin nhắn này đã được xử lý
  receivedMessageIds.add(message.id);

  // Kiểm tra xem tin nhắn này thuộc phiên đang hiển thị không
  if (message.sessionId === currentSessionId) {
    console.log(`Hiển thị tin nhắn mới thuộc phiên hiện tại ${currentSessionId}`);
    
    // Hiển thị tin nhắn trong giao diện chat
    appendMessage(message);
    
    // Cuộn xuống để hiển thị tin nhắn mới
    scrollToBottom();
    
    // Đánh dấu phiên đã đọc
    markSessionAsRead(message.sessionId);
  } else {
    // Cập nhật danh sách phiên để thông báo có tin nhắn mới
    console.log(`Cập nhật danh sách phiên với tin nhắn mới cho phiên ${message.sessionId}`);
    updateSessionWithNewMessage(message);
    
    // Phát âm thanh thông báo
    playNotificationSound('message');
    
    // Hiển thị thông báo desktop nếu được phép
    showDesktopNotification('Tin nhắn mới', `Có tin nhắn mới từ phiên ${message.sessionId.substring(0, 8)}...`);
  }
}

// Cập nhật phiên với đánh giá
function updateSessionWithRating(sessionId, rating) {
}

// Cập nhật phiên với đánh giá
function updateSessionWithRating(sessionId, rating) {
  // Tìm phiên trong danh sách
  const sessionIndex = sessionList.findIndex(s => s.id === sessionId);
  if (sessionIndex === -1) return;
  
  // Cập nhật đánh giá
  sessionList[sessionIndex].rating = rating;
  
  // Cập nhật danh sách phiên
  renderSessionList(sessionList);
  
  // Cập nhật chi tiết phiên nếu đang mở
  if (currentSessionId === sessionId) {
    updateSessionInfo(sessionId);
  }
}

// Hiển thị góp ý đánh giá gần đây
function displayRecentRatings(ratings) {
  const recentRatingsContainer = document.getElementById('recent-ratings');
  if (!recentRatingsContainer) return;
  
  if (!ratings || ratings.length === 0) {
    recentRatingsContainer.innerHTML = '<div class="empty-ratings">Chưa có đánh giá nào trong khoảng thời gian này</div>';
    return;
  }
  
  // Tạo bảng đánh giá
  const table = document.createElement('table');
  table.className = 'recent-ratings-table';
  
  // Tạo header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Thời gian</th>
      <th>Mã phiên</th>
      <th>Nhân viên</th>
      <th>Đánh giá</th>
      <th>Góp ý</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Tạo body
  const tbody = document.createElement('tbody');
  
  ratings.forEach(rating => {
    const row = document.createElement('tr');
    
    // Hiển thị thời gian định dạng đẹp
    const date = new Date(rating.timestamp);
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes() < 10 ? '0' : ''}${date.getMinutes()}`;
    
    // Tạo HTML cho stars
    let starsHtml = '<div class="rating-stars-small">';
    for (let i = 1; i <= 5; i++) {
      if (i <= rating.rating) {
        starsHtml += '<i class="fas fa-star"></i>';
      } else {
        starsHtml += '<i class="far fa-star"></i>';
      }
    }
    starsHtml += '</div>';
    
    // Tạo nội dung hàng
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${rating.sessionId}</td>
      <td>${rating.staffName || 'N/A'}</td>
      <td><div class="rating-cell">${starsHtml} (${rating.rating}/5)</div></td>
      <td class="rating-feedback">${rating.feedback || '-'}</td>
    `;
    
    // Thêm sự kiện click để hiển thị phiên
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      selectSession(rating.sessionId);
      
      // Chuyển đến tab chat
      const chatMenuItem = document.querySelector('.menu-item[data-section="chat"]');
      if (chatMenuItem) {
        chatMenuItem.click();
      }
    });
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  recentRatingsContainer.innerHTML = '';
  recentRatingsContainer.appendChild(table);
}

// Thêm hàm để kiểm tra DOM và thiết lập sự kiện Spotify
function setupSpotifyConnectButton() {
  console.log('Đang kiểm tra và thiết lập nút kết nối Spotify...');
  
  // Tìm nút kết nối
  const connectButton = document.getElementById('spotify-connect');
  if (!connectButton) {
    console.error('Không tìm thấy nút kết nối Spotify');
    
    // Thử lại sau 1 giây (phòng trường hợp DOM chưa tải xong)
    setTimeout(setupSpotifyConnectButton, 1000);
    return;
  }
  
  console.log('Đã tìm thấy nút kết nối Spotify, đang gắn sự kiện');
  
  // Gắn trực tiếp sự kiện onclick
  connectButton.onclick = function() {
    console.log('Nút kết nối Spotify được nhấp!');
    showNotification('Đang kết nối Spotify...', 'info');
    connectToSpotify();
    return false; // Ngăn chặn hành vi mặc định
  };
}

// Đăng ký hàm thiết lập Spotify khi trang đã tải xong
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM đã tải xong, thiết lập nút Spotify');
  setupSpotifyConnectButton();
});

// Hàm khởi tạo tab cho giao diện
function setupTabs() {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.content-section');
  
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Xóa active class từ tất cả các link
      navLinks.forEach(l => l.classList.remove('active'));
      
      // Thêm active class cho link được chọn
      this.classList.add('active');
      
      // Ẩn tất cả các phần nội dung
      sections.forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
      });
      
      // Hiển thị phần được chọn
      const targetId = this.getAttribute('data-section') + '-section';
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
        
        // Thực hiện hành động đặc biệt dựa trên tab
        if (targetId === 'statistics-section') {
          fetchStats();
        } else if (targetId === 'vouchers-section') {
          loadVouchersList();
        }
      }
    });
  });
  
  // Mặc định hiển thị dashboard
  const dashboardLink = document.querySelector('.nav-link[data-section="dashboard"]');
  if (dashboardLink) {
    dashboardLink.click();
  }
}

// Tạo nội dung cho tab Voucher Verification
function createVouchersContent() {
  const vouchersContainer = document.createElement('div');
  vouchersContainer.className = 'vouchers-container';
  
  // Form kiểm tra mã voucher
  const verifyContainer = document.createElement('div');
  verifyContainer.className = 'verify-voucher-container';
  
  const verifyTitle = document.createElement('h3');
  verifyTitle.textContent = 'Kiểm tra mã voucher';
  verifyContainer.appendChild(verifyTitle);
  
  const verifyForm = document.createElement('form');
  verifyForm.id = 'verify-voucher-form';
  verifyForm.innerHTML = `
    <div class="form-group">
      <label for="voucher-code">Mã Voucher:</label>
      <div class="input-with-button">
        <input type="text" id="voucher-code" placeholder="Nhập mã voucher cần kiểm tra" required>
        <button type="submit" class="btn btn-primary">Kiểm tra</button>
      </div>
    </div>
  `;
  verifyContainer.appendChild(verifyForm);
  
  // Kết quả kiểm tra
  const resultContainer = document.createElement('div');
  resultContainer.className = 'voucher-result';
  resultContainer.id = 'voucher-result';
  resultContainer.style.display = 'none';
  
  // Kết quả chi tiết
  const voucherInfo = document.createElement('div');
  voucherInfo.className = 'voucher-info';
  voucherInfo.innerHTML = `
    <div class="voucher-status">
      <span class="status-indicator"></span>
      <span class="status-text"></span>
    </div>
    <div class="voucher-details">
      <p><strong>Mã giảm giá:</strong> <span id="result-discount">0</span>%</p>
      <p><strong>Ngày tạo:</strong> <span id="result-created"></span></p>
      <p><strong>Trạng thái:</strong> <span id="result-used"></span></p>
      <p><strong>Điểm Quiz:</strong> <span id="result-score"></span></p>
    </div>
    <div class="voucher-actions">
      <button id="use-voucher" class="btn btn-success">Sử dụng Voucher</button>
    </div>
  `;
  resultContainer.appendChild(voucherInfo);
}

// Load danh sách voucher
function loadVouchersList() {
  const vouchersList = document.getElementById('vouchers-list');
  if (!vouchersList) return;
  
  // Hiển thị loading
  vouchersList.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Đang tải danh sách voucher...</p>
    </div>
  `;
  
  // Gọi API lấy danh sách voucher - bỏ header xác thực
  fetch('/api/vouchers/list')
    .then(response => response.json())
    .then(vouchers => {
      if (vouchers.length === 0) {
        vouchersList.innerHTML = '<p class="no-data">Chưa có voucher nào.</p>';
        return;
      }
      
      // Sắp xếp voucher theo thời gian tạo, mới nhất lên đầu
      vouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Tạo bảng
      const table = document.createElement('table');
      table.className = 'vouchers-table';
      
      // Tạo header
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>Mã</th>
          <th>Giảm giá</th>
          <th>Đã sử dụng</th>
          <th>Ngày tạo</th>
          <th>Điểm Quiz</th>
          <th>Thao tác</th>
        </tr>
      `;
      table.appendChild(thead);
      
      // Tạo body
      const tbody = document.createElement('tbody');
      
      vouchers.forEach(voucher => {
        const tr = document.createElement('tr');
        
        // Màu nền dựa trên trạng thái
        if (voucher.isUsed) {
          tr.classList.add('used-voucher');
        }
        
        // Tạo các cột
        tr.innerHTML = `
          <td>${voucher.code}</td>
          <td>${voucher.discount}%</td>
          <td>${voucher.isUsed ? '<span class="status-badge status-used">Đã sử dụng</span>' : '<span class="status-badge status-active">Chưa sử dụng</span>'}</td>
          <td>${new Date(voucher.createdAt).toLocaleString()}</td>
          <td>${voucher.quizScore || 'N/A'}</td>
          <td>
            <button class="btn btn-sm ${voucher.isUsed ? 'btn-disabled' : 'btn-success'} verify-btn" 
                data-code="${voucher.code}" 
                ${voucher.isUsed ? 'disabled' : ''}>
                ${voucher.isUsed ? 'Đã sử dụng' : 'Kiểm tra'}
            </button>
          </td>
        `;
        
        tbody.appendChild(tr);
      });
      
      table.appendChild(tbody);
      
      // Xóa nội dung cũ và thêm bảng
      vouchersList.innerHTML = '';
      vouchersList.appendChild(table);
      
      // Thêm event listener cho các nút kiểm tra
      const verifyButtons = vouchersList.querySelectorAll('.verify-btn');
      verifyButtons.forEach(button => {
        button.addEventListener('click', function() {
          const code = this.dataset.code;
          document.getElementById('voucher-code').value = code;
          verifyVoucher(code);
          
          // Cuộn lên trên để xem kết quả
          document.getElementById('vouchers-section').scrollTop = 0;
        });
      });
    })
    .catch(error => {
      console.error('Error loading vouchers:', error);
      vouchersList.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Lỗi khi tải danh sách voucher: ${error.message}</p>
        </div>
      `;
    });
}

// Kiểm tra voucher
function verifyVoucher(code) {
  const resultContainer = document.getElementById('voucher-result');
  const statusIndicator = resultContainer.querySelector('.status-indicator');
  const statusText = resultContainer.querySelector('.status-text');
  
  // Hiển thị loading
  resultContainer.style.display = 'block';
  statusIndicator.className = 'status-indicator loading';
  statusText.textContent = 'Đang kiểm tra...';
  
  // Gọi API kiểm tra
  fetch(`/api/vouchers/check/${code}`)
    .then(response => response.json())
    .then(data => {
      if (data.valid) {
        // Voucher hợp lệ
        statusIndicator.className = 'status-indicator valid';
        statusText.textContent = 'Mã voucher hợp lệ';
        
        // Load thông tin chi tiết
        fetch(`/api/vouchers/list`)
          .then(response => response.json())
          .then(vouchers => {
            const voucher = vouchers.find(v => v.code === code);
            if (voucher) {
              document.getElementById('result-discount').textContent = voucher.discount;
              document.getElementById('result-created').textContent = new Date(voucher.createdAt).toLocaleString();
              document.getElementById('result-used').textContent = voucher.isUsed ? 'Đã sử dụng' : 'Chưa sử dụng';
              document.getElementById('result-score').textContent = voucher.quizScore || 'N/A';
            }
          })
          .catch(error => {
            console.error('Error fetching voucher details:', error);
          });
      } else {
        // Voucher không hợp lệ
        statusIndicator.className = 'status-indicator invalid';
        statusText.textContent = data.error || 'Mã voucher không hợp lệ';
      }
    })
    .catch(error => {
      console.error('Error verifying voucher:', error);
      statusIndicator.className = 'status-indicator error';
      statusText.textContent = 'Lỗi khi kiểm tra mã voucher';
    });
}

// Khởi tạo tính năng voucher
function initVoucherFunctions() {
  console.log("Initializing voucher functions");
  
  // Tải danh sách voucher ngay lập tức
  fetchVouchers();
  
  // Thiết lập cập nhật tự động mỗi 30 giây
  setInterval(fetchVouchers, 30000);
  
  // Lấy form verify voucher
  const verifyForm = document.getElementById('verify-voucher-form');
  if (verifyForm) {
    console.log("Found verify form, adding submit event");
    verifyForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const code = document.getElementById('voucher-code').value.trim();
      if (code) {
        checkVoucherCode(code);
      } else {
        showNotification('Vui lòng nhập mã voucher để kiểm tra', 'error');
      }
    });
  } else {
    console.error("Verify form not found");
  }
  
  // Thiết lập các event listener cho nút đánh dấu đã sử dụng
  const useVoucherBtn = document.getElementById('use-voucher');
  if (useVoucherBtn) {
    useVoucherBtn.addEventListener('click', function() {
      const code = this.getAttribute('data-code');
      if (code) {
        markVoucherAsUsed(code);
      }
    });
  }
  
  // Thiết lập nút làm mới danh sách voucher
  const refreshBtn = document.getElementById('refresh-vouchers');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchVouchers);
  }
}

// Tải danh sách vouchers từ server
function fetchVouchers() {
  console.log("Fetching vouchers list...");
  const vouchersListContainer = document.getElementById('vouchers-list');
  
  if (!vouchersListContainer) {
    console.error('Không tìm thấy container danh sách voucher');
    return;
  }
  
  // Hiển thị trạng thái đang tải
  vouchersListContainer.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Đang tải danh sách voucher...</p>
    </div>
  `;
  
  // Lấy token, nếu không có token thì thử gọi API không cần xác thực
  const token = getToken();
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  // Gọi API lấy danh sách voucher
  fetch('/api/vouchers', {
    method: 'GET',
    headers: headers
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(vouchers => {
    console.log('Received vouchers:', vouchers);
    
    if (!vouchers || vouchers.length === 0) {
      vouchersListContainer.innerHTML = `
        <div class="no-data">
          <p>Chưa có voucher nào được tạo hoặc bạn không có quyền xem</p>
          <button class="btn btn-primary" onclick="fetchVouchers()">Thử lại</button>
        </div>
      `;
      return;
    }
    
    // Sắp xếp vouchers theo thời gian tạo mới nhất lên đầu
    vouchers.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB.getTime() - dateA.getTime(); // Sắp xếp giảm dần (mới nhất lên đầu)
    });
    
    // Debug: Hiển thị voucher đầu tiên và metadata
    if (vouchers.length > 0) {
      const firstVoucher = vouchers[0];
      console.log('First voucher:', firstVoucher);
      console.log('Voucher metadata raw:', firstVoucher.metadata);
      
      try {
        if (firstVoucher.metadata) {
          const parsedMetadata = typeof firstVoucher.metadata === 'string' 
            ? JSON.parse(firstVoucher.metadata) 
            : firstVoucher.metadata;
          console.log('Parsed metadata:', parsedMetadata);
          console.log('Quiz score:', parsedMetadata.quizScore);
        } else {
          console.log('No metadata found in voucher');
        }
      } catch (e) {
        console.error('Error parsing metadata:', e);
      }
    }
    
    // Tạo bảng danh sách voucher
    let tableHTML = `
      <div class="vouchers-table-container">
        <table class="vouchers-table">
          <thead>
            <tr>
              <th>Mã voucher</th>
              <th>Giảm giá</th>
              <th>Ngày tạo</th>
              <th>Điểm Quiz</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    vouchers.forEach(voucher => {
      // Định dạng ngày tạo
      const createdDate = voucher.created_at ? new Date(voucher.created_at) : null;
      const formattedDate = createdDate ? 
        `${createdDate.getDate()}/${createdDate.getMonth() + 1}/${createdDate.getFullYear()} ${createdDate.getHours()}:${String(createdDate.getMinutes()).padStart(2, '0')}` : 
        'N/A';
      
      // Định dạng trạng thái
      const statusClass = voucher.is_used ? 'text-danger' : 'text-success';
      const statusText = voucher.is_used ? 'Đã sử dụng' : 'Khả dụng';
      
      // Định dạng điểm quiz
      let quizScore = 'N/A';
      try {
        // Trích xuất điểm quiz từ metadata nếu có
        if (voucher.metadata) {
          let metadata;
          // Nếu metadata là chuỗi, thử parse thành JSON
          if (typeof voucher.metadata === 'string') {
            try {
              metadata = JSON.parse(voucher.metadata);
            } catch (parseError) {
              console.error('Error parsing metadata as JSON string:', parseError);
            }
          } else {
            metadata = voucher.metadata;
          }
          
          // Nếu parse thành công và có quizScore, hiển thị
          if (metadata && metadata.quizScore !== undefined) {
            quizScore = metadata.quizScore;
          }
        }
      } catch (e) {
        console.error('Lỗi khi parse metadata:', e);
      }
      
      // Tạo button hành động
      const actionButton = voucher.is_used 
        ? '<span class="badge bg-secondary">Đã sử dụng</span>' 
        : `<button class="btn-mark-used" data-code="${voucher.code}">Đánh dấu đã dùng</button>`;
      
      tableHTML += `
        <tr class="${voucher.is_used ? 'used-voucher' : ''}">
          <td><code>${voucher.code}</code></td>
          <td>${voucher.discount_percent || 0}%</td>
          <td>${formattedDate}</td>
          <td>${quizScore}</td>
          <td class="${statusClass}">${statusText}</td>
          <td>${actionButton}</td>
        </tr>
      `;
    });
    
    tableHTML += `
          </tbody>
        </table>
      </div>
    `;
    
    vouchersListContainer.innerHTML = tableHTML;
    
    // Thêm event listener cho các button đánh dấu đã sử dụng
    document.querySelectorAll('.btn-mark-used').forEach(button => {
      button.addEventListener('click', () => {
        const code = button.getAttribute('data-code');
        if (code) {
          markVoucherAsUsed(code);
        }
      });
    });
  })
  .catch(error => {
    console.error('Lỗi khi tải danh sách voucher:', error);
    vouchersListContainer.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <p>Không thể tải danh sách voucher</p>
        <p class="error-detail">${error.message}</p>
        <button class="btn btn-primary" onclick="fetchVouchers()">Thử lại</button>
      </div>
    `;
  });
}

// Kiểm tra mã voucher
function checkVoucherCode(code) {
  console.log("Checking voucher code:", code);
  
  // Hiển thị trạng thái đang tải
  const resultElement = document.getElementById('voucher-result');
  if (resultElement) {
    resultElement.style.display = 'block';
    
    const statusIndicator = resultElement.querySelector('.status-indicator');
    const statusText = resultElement.querySelector('.status-text');
    
    if (statusIndicator && statusText) {
      statusIndicator.className = 'status-indicator loading';
      statusText.textContent = 'Đang kiểm tra...';
    }
    
    // Ẩn nút sử dụng voucher trong quá trình kiểm tra
    const useVoucherBtn = document.getElementById('use-voucher');
    if (useVoucherBtn) {
      useVoucherBtn.style.display = 'none';
    }
  }
  
  // Gọi API kiểm tra voucher
  fetch(`/api/vouchers/${code}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Mã voucher không hợp lệ');
    }
    return response.json();
  })
  .then(voucher => {
    console.log("Voucher details:", voucher);
    updateVoucherResult(voucher, true);
  })
  .catch(error => {
    console.error('Lỗi khi kiểm tra voucher:', error);
    updateVoucherResult(null, false);
    showNotification('Không tìm thấy mã voucher hoặc mã không hợp lệ', 'error');
  });
}

// Cập nhật kết quả kiểm tra voucher
function updateVoucherResult(voucher, isValid) {
  console.log('Updating voucher result:', voucher);
  const resultElement = document.getElementById('voucher-result');
  if (!resultElement) return;
  
  const statusIndicator = resultElement.querySelector('.status-indicator');
  const statusText = resultElement.querySelector('.status-text');
  const discountElement = document.getElementById('result-discount');
  const createdElement = document.getElementById('result-created');
  const usedElement = document.getElementById('result-used');
  const scoreElement = document.getElementById('result-score');
  const useVoucherBtn = document.getElementById('use-voucher');
  
  if (isValid && voucher) {
    // Voucher hợp lệ
    statusIndicator.className = 'status-indicator valid';
    statusText.textContent = 'Voucher hợp lệ';
    
    // Hiển thị thông tin voucher
    discountElement.textContent = voucher.discount_percent || 0;
    
    // Định dạng ngày tạo
    if (voucher.created_at) {
      const createdDate = new Date(voucher.created_at);
      createdElement.textContent = `${createdDate.getDate()}/${createdDate.getMonth() + 1}/${createdDate.getFullYear()} ${createdDate.getHours()}:${String(createdDate.getMinutes()).padStart(2, '0')}`;
    } else {
      createdElement.textContent = 'N/A';
    }
    
    // Hiển thị trạng thái sử dụng
    usedElement.textContent = voucher.is_used ? 'Đã sử dụng' : 'Chưa sử dụng';
    usedElement.className = voucher.is_used ? 'text-danger' : 'text-success';
    
    // Hiển thị điểm quiz từ metadata
    let quizScore = 'N/A';
    try {
      if (voucher.metadata) {
        let metadata;
        // Nếu metadata là chuỗi, thử parse thành JSON
        if (typeof voucher.metadata === 'string') {
          try {
            metadata = JSON.parse(voucher.metadata);
          } catch (parseError) {
            console.error('Error parsing metadata as JSON string:', parseError);
          }
        } else {
          metadata = voucher.metadata;
        }
        
        // Nếu parse thành công và có quizScore, hiển thị
        if (metadata && metadata.quizScore !== undefined) {
          quizScore = metadata.quizScore;
        }
      }
    } catch (e) {
      console.error('Error processing metadata:', e);
    }
    scoreElement.textContent = quizScore;
    
    // Hiển thị hoặc ẩn nút sử dụng voucher tùy theo trạng thái
    if (useVoucherBtn) {
      if (voucher.is_used) {
        useVoucherBtn.style.display = 'none';
      } else {
        useVoucherBtn.style.display = 'block';
        useVoucherBtn.setAttribute('data-code', voucher.code);
      }
    }
  } else {
    // Voucher không hợp lệ
    statusIndicator.className = 'status-indicator invalid';
    statusText.textContent = 'Voucher không hợp lệ';
    
    // Reset các thông tin
    discountElement.textContent = '0';
    createdElement.textContent = '-';
    usedElement.textContent = '-';
    scoreElement.textContent = '-';
    
    // Ẩn nút sử dụng voucher
    if (useVoucherBtn) {
      useVoucherBtn.style.display = 'none';
    }
  }
}

// Đánh dấu voucher đã sử dụng
function markVoucherAsUsed(code) {
  fetch(`/api/vouchers/${code}/use`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    showNotification('Đã đánh dấu voucher như đã sử dụng', 'success');
    
    // Cập nhật lại trạng thái trên giao diện
    const useVoucherBtn = document.getElementById('use-voucher');
    if (useVoucherBtn) {
      useVoucherBtn.style.display = 'none';
    }
    
    const usedElement = document.getElementById('result-used');
    if (usedElement) {
      usedElement.textContent = 'Đã sử dụng';
      usedElement.className = 'text-danger';
    }
    
    // Tải lại danh sách voucher
    fetchVouchers();
  })
  .catch(error => {
    console.error('Lỗi khi đánh dấu voucher:', error);
    showNotification('Không thể đánh dấu voucher đã sử dụng: ' + error.message, 'error');
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Truy cập nút làm mới voucher
  const refreshVouchersBtn = document.getElementById('refresh-vouchers');
  if (refreshVouchersBtn) {
    refreshVouchersBtn.addEventListener('click', function() {
      console.log('Refreshing vouchers list...');
      fetchVouchers();
    });
  }
  
  // ... other DOMContentLoaded handlers ...
});

// Tải giao diện chat và chuẩn bị cho phiên
function loadChat(sessionId) {
  console.log('Loading chat for session:', sessionId);

  if (!sessionId) {
    console.error('Session ID is required');
    return;
  }

  // Lưu sessionId hiện tại
  currentSessionId = sessionId;

  // Hiển thị container chat (ẩn thông báo chưa chọn phiên)
  const chatContainer = document.getElementById('chat-container');
  const chatMessages = document.createElement('div');
  chatMessages.className = 'chat-messages';
  chatMessages.id = 'chat-messages';
  
  const inputContainer = document.createElement('div');
  inputContainer.className = 'chat-input-container';
  inputContainer.innerHTML = `
    <div class="input-wrapper">
      <textarea id="chat-input" placeholder="Nhập tin nhắn..."></textarea>
      <button id="send-button"><i class="fas fa-paper-plane"></i></button>
    </div>
    <div class="quick-responses">
      <div class="quick-response-item">Xin chào, tôi có thể giúp gì cho bạn?</div>
      <div class="quick-response-item">Cảm ơn bạn đã liên hệ với chúng tôi.</div>
      <div class="quick-response-item">Vui lòng đợi một chút, tôi đang kiểm tra thông tin.</div>
    </div>
  `;
  
  // Xóa nội dung cũ và thêm các phần tử mới
  chatContainer.innerHTML = '';
  chatContainer.appendChild(chatMessages);
  chatContainer.appendChild(inputContainer);

  // Thiết lập sự kiện gửi tin nhắn
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  
  if (chatInput && sendButton) {
    // Gửi tin nhắn khi nhấn nút
    sendButton.addEventListener('click', () => {
      sendMessage();
    });
    
    // Gửi tin nhắn khi nhấn Enter (không phải Shift+Enter)
    chatInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  // Thiết lập câu trả lời nhanh
  setupQuickResponses();

  // Cập nhật thông tin phiên
  updateSessionInfo(sessionId);

  // Kết nối socket với phiên hiện tại
  joinChatSession(sessionId);

  // Kiểm tra và tiếp nhận phiên nếu cần
  const selectedSession = sessionList.find(session => session.id === sessionId);

  if (selectedSession && selectedSession.needsHumanSupport && !selectedSession.isHumanAssigned) {
    // Phiên cần hỗ trợ và chưa được tiếp nhận, tiếp nhận trước rồi mới tải tin nhắn
    assignSession(sessionId)
      .then(() => {
        // Sau khi tiếp nhận thành công, tải tin nhắn
        fetchSessionMessages(sessionId);
      })
      .catch(error => {
        console.error('Failed to assign session:', error);
        // Vẫn thử tải tin nhắn ngay cả khi không tiếp nhận được
        fetchSessionMessages(sessionId);
      });
  } else {
    // Phiên đã được tiếp nhận, tải tin nhắn ngay
    fetchSessionMessages(sessionId);
  }
}

// Cập nhật thông tin phiên
function updateSessionInfo(sessionId) {
  // Tìm phiên trong danh sách
  const session = sessionList.find(s => s.id === sessionId);
  if (!session) return;
  
  // Cập nhật tên khách hàng
  const clientNameElement = document.getElementById('client-name');
  if (clientNameElement) {
    clientNameElement.textContent = session.user ? session.user.name || 'Khách hàng' : 'Khách hàng';
  }
  
  // Cập nhật thời gian
  const sessionTimeElement = document.getElementById('session-time');
  if (sessionTimeElement && session.createdAt) {
    const createdAt = new Date(session.createdAt);
    const formattedDate = formatDate(createdAt);
    sessionTimeElement.textContent = `Bắt đầu: ${formattedDate}`;
  }
  
  // Cập nhật đánh giá nếu có
  const sessionRatingElement = document.getElementById('session-rating');
  if (sessionRatingElement) {
    if (session.rating) {
      sessionRatingElement.style.display = 'block';
      
      // Tạo HTML cho stars
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (i <= session.rating) {
          starsHtml += '<i class="fas fa-star"></i>';
        } else {
          starsHtml += '<i class="far fa-star"></i>';
        }
      }
      
      sessionRatingElement.innerHTML = `
        <div class="rating-stars">${starsHtml}</div>
        <span class="rating-text">${session.rating}/5</span>
      `;
    } else {
      sessionRatingElement.style.display = 'none';
    }
  }
  
  // Cập nhật phản hồi nếu có
  const sessionFeedbackElement = document.getElementById('session-feedback');
  if (sessionFeedbackElement) {
    if (session.feedback) {
      sessionFeedbackElement.style.display = 'block';
      sessionFeedbackElement.innerHTML = `
        <div class="feedback-icon"><i class="fas fa-comment-dots"></i></div>
        <div class="feedback-text">"${session.feedback}"</div>
      `;
    } else {
      sessionFeedbackElement.style.display = 'none';
    }
  }
  
  // Cập nhật nút kết thúc phiên
  const endSessionBtn = document.getElementById('end-session-btn');
  if (endSessionBtn) {
    // Chỉ bật nút khi phiên đang hoạt động và được tiếp nhận bởi người dùng hiện tại
    if (session.status === 'active' && session.isHumanAssigned) {
      endSessionBtn.disabled = false;
      endSessionBtn.style.opacity = '1';
    } else {
      endSessionBtn.disabled = true;
      endSessionBtn.style.opacity = '0.5';
    }
  }
}

// Hàm đồng bộ mẫu câu từ tab mẫu câu sang câu trả lời nhanh
function syncTemplates() {
  // Lấy tất cả mẫu câu từ tab mẫu câu
  const templateItems = document.querySelectorAll('.template-item .template-content p');
  const quickResponsesContainer = document.querySelector('.quick-responses');
  
  // Nếu không có phần tử container hoặc không có phiên đang chọn, return
  if (!quickResponsesContainer || !currentSessionId) return;
  
  // Xóa tất cả phần tử cũ trừ nút xem thêm
  const existingResponses = quickResponsesContainer.querySelectorAll('.quick-response-item');
  existingResponses.forEach(item => item.remove());
  
  // Nút "Xem thêm" có thể đã tồn tại
  const showTemplatesBtn = document.getElementById('show-templates-btn');
  if (showTemplatesBtn) {
    showTemplatesBtn.remove();
  }
  
  // Lấy tối đa 4 mẫu câu từ tab mẫu câu
  let count = 0;
  templateItems.forEach(item => {
    if (count < 4) {
      const responseItem = document.createElement('div');
      responseItem.className = 'quick-response-item';
      responseItem.textContent = item.textContent;
      
      // Thêm vào đầu container
      quickResponsesContainer.appendChild(responseItem);
      count++;
    }
  });
  
  // Thêm nút "Xem thêm"
  const newShowTemplatesBtn = document.createElement('button');
  newShowTemplatesBtn.id = 'show-templates-btn';
  newShowTemplatesBtn.className = 'quick-response-more';
  newShowTemplatesBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i> Xem thêm mẫu câu';
  newShowTemplatesBtn.addEventListener('click', () => {
    // Chuyển sang tab mẫu câu
    const templatesMenuItem = document.querySelector('.menu-item[data-section="templates"]');
    if (templatesMenuItem) {
      templatesMenuItem.click();
    }
  });
  quickResponsesContainer.appendChild(newShowTemplatesBtn);
  
  // Cài đặt lại sự kiện cho các câu trả lời nhanh
  setupQuickResponses();
  
  console.log("Đã đồng bộ mẫu câu sang câu trả lời nhanh");
}

// Xóa phiên chat
function deleteSession() {
  if (!currentSessionId) return;
  
  const sessionIdToDelete = currentSessionId; // Lưu ID hiện tại vào biến tạm

  if (!confirm('Bạn có chắc chắn muốn xóa phiên hỗ trợ này? Tất cả tin nhắn sẽ bị xóa và không thể khôi phục.')) {
    return;
  }

  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');

  // Hiển thị thông báo đang xóa
  showNotification('Đang xóa phiên chat...', 'info');

  // Đóng phiên hiện tại trước
  closeChatSession();
  
  // Xóa khỏi danh sách UI ngay lập tức để phản hồi nhanh với người dùng
  sessionList = sessionList.filter(session => session.id !== sessionIdToDelete);
  renderSessionList(sessionList);

  fetch(`${API_BASE_URL}/support/delete-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sessionId: sessionIdToDelete
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Session deleted successfully:', data);
    showNotification('Đã xóa phiên chat thành công', 'success');
    
    // Cập nhật lại danh sách từ server
    setTimeout(fetchSupportSessions, 300);
  })
  .catch(error => {
    console.error('Error deleting session:', error);
    showNotification('Không thể xóa phiên chat: ' + error.message, 'error');
    
    // Nếu lỗi, tải lại danh sách phiên từ server để đảm bảo dữ liệu đồng bộ
    fetchSupportSessions();
  });
}