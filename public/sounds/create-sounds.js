// Script để tạo các file âm thanh thông báo

// Hàm tạo âm thanh tin nhắn
function createMessageSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Tạo oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    
    // Tạo gain node để điều chỉnh âm lượng
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    
    // Kết nối và bắt đầu
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
    
    // Xuất ra file audio
    const length = 0.3;
    const offlineCtx = new OfflineAudioContext(1, length * audioCtx.sampleRate, audioCtx.sampleRate);
    
    const offlineOscillator = offlineCtx.createOscillator();
    offlineOscillator.type = 'sine';
    offlineOscillator.frequency.setValueAtTime(880, offlineCtx.currentTime);
    
    const offlineGain = offlineCtx.createGain();
    offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime);
    offlineGain.gain.linearRampToValueAtTime(0.3, offlineCtx.currentTime + 0.01);
    offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.3);
    
    offlineOscillator.connect(offlineGain);
    offlineGain.connect(offlineCtx.destination);
    
    offlineOscillator.start();
    offlineOscillator.stop(offlineCtx.currentTime + 0.3);
    
    offlineCtx.startRendering().then(buffer => {
      const blob = bufferToWave(buffer, length * audioCtx.sampleRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'message.mp3';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    });
    
  } catch (error) {
    console.error('Audio Context not supported or error generating sound', error);
  }
}

// Hàm tạo âm thanh phiên mới
function createNewSessionSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Tạo oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    
    // Tạo gain node để điều chỉnh âm lượng
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    
    // Kết nối và bắt đầu
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Tạo âm thanh 2 nốt
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    oscillator.start();
    oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.25); // G5
    oscillator.stop(audioCtx.currentTime + 0.5);
    
    // Xuất ra file audio
    const length = 0.5;
    const offlineCtx = new OfflineAudioContext(1, length * audioCtx.sampleRate, audioCtx.sampleRate);
    
    const offlineOscillator = offlineCtx.createOscillator();
    offlineOscillator.type = 'sine';
    
    const offlineGain = offlineCtx.createGain();
    offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime);
    offlineGain.gain.linearRampToValueAtTime(0.3, offlineCtx.currentTime + 0.01);
    offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.5);
    
    offlineOscillator.connect(offlineGain);
    offlineGain.connect(offlineCtx.destination);
    
    offlineOscillator.frequency.setValueAtTime(523.25, offlineCtx.currentTime); // C5
    offlineOscillator.start();
    offlineOscillator.frequency.setValueAtTime(783.99, offlineCtx.currentTime + 0.25); // G5
    offlineOscillator.stop(offlineCtx.currentTime + 0.5);
    
    offlineCtx.startRendering().then(buffer => {
      const blob = bufferToWave(buffer, length * audioCtx.sampleRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'new-session.mp3';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    });
    
  } catch (error) {
    console.error('Audio Context not supported or error generating sound', error);
  }
}

// Hàm tạo âm thanh thông báo chung
function createNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Tạo oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    
    // Tạo gain node để điều chỉnh âm lượng
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
    
    // Kết nối và bắt đầu
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Tạo âm thanh với tần số thay đổi
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    oscillator.start();
    oscillator.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.2); // A5
    oscillator.stop(audioCtx.currentTime + 0.4);
    
    // Xuất ra file audio
    const length = 0.4;
    const offlineCtx = new OfflineAudioContext(1, length * audioCtx.sampleRate, audioCtx.sampleRate);
    
    const offlineOscillator = offlineCtx.createOscillator();
    offlineOscillator.type = 'sine';
    
    const offlineGain = offlineCtx.createGain();
    offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime);
    offlineGain.gain.linearRampToValueAtTime(0.3, offlineCtx.currentTime + 0.01);
    offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.4);
    
    offlineOscillator.connect(offlineGain);
    offlineGain.connect(offlineCtx.destination);
    
    offlineOscillator.frequency.setValueAtTime(440, offlineCtx.currentTime); // A4
    offlineOscillator.start();
    offlineOscillator.frequency.linearRampToValueAtTime(880, offlineCtx.currentTime + 0.2); // A5
    offlineOscillator.stop(offlineCtx.currentTime + 0.4);
    
    offlineCtx.startRendering().then(buffer => {
      const blob = bufferToWave(buffer, length * audioCtx.sampleRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'notification.mp3';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    });
    
  } catch (error) {
    console.error('Audio Context not supported or error generating sound', error);
  }
}

// Hàm tạo âm thanh kiểm tra
function createTestSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Tạo oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    
    // Tạo gain node để điều chỉnh âm lượng
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
    
    // Kết nối và bắt đầu
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Tạo âm thanh 3 nốt
    oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
    oscillator.start();
    oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
    oscillator.frequency.setValueAtTime(987.77, audioCtx.currentTime + 0.4); // B5
    oscillator.stop(audioCtx.currentTime + 0.6);
    
    // Xuất ra file audio
    const length = 0.6;
    const offlineCtx = new OfflineAudioContext(1, length * audioCtx.sampleRate, audioCtx.sampleRate);
    
    const offlineOscillator = offlineCtx.createOscillator();
    offlineOscillator.type = 'sine';
    
    const offlineGain = offlineCtx.createGain();
    offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime);
    offlineGain.gain.linearRampToValueAtTime(0.3, offlineCtx.currentTime + 0.01);
    offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.6);
    
    offlineOscillator.connect(offlineGain);
    offlineGain.connect(offlineCtx.destination);
    
    offlineOscillator.frequency.setValueAtTime(659.25, offlineCtx.currentTime); // E5
    offlineOscillator.start();
    offlineOscillator.frequency.setValueAtTime(783.99, offlineCtx.currentTime + 0.2); // G5
    offlineOscillator.frequency.setValueAtTime(987.77, offlineCtx.currentTime + 0.4); // B5
    offlineOscillator.stop(offlineCtx.currentTime + 0.6);
    
    offlineCtx.startRendering().then(buffer => {
      const blob = bufferToWave(buffer, length * audioCtx.sampleRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'test-notification.mp3';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    });
    
  } catch (error) {
    console.error('Audio Context not supported or error generating sound', error);
  }
}

// Hàm tạo âm thanh tin nhắn kiểu beep
function createBeepMessageSound(play = false, download = false) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Tạo oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // Tần số cao hơn cho beep
    
    // Tạo gain node để điều chỉnh âm lượng
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
    
    // Kết nối và bắt đầu
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (play) {
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
      return;
    }
    
    if (download) {
      // Xuất ra file audio
      const length = 0.2;
      const offlineCtx = new OfflineAudioContext(1, length * audioCtx.sampleRate, audioCtx.sampleRate);
      
      const offlineOscillator = offlineCtx.createOscillator();
      offlineOscillator.type = 'square';
      offlineOscillator.frequency.setValueAtTime(1000, offlineCtx.currentTime);
      
      const offlineGain = offlineCtx.createGain();
      offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime);
      offlineGain.gain.linearRampToValueAtTime(0.2, offlineCtx.currentTime + 0.01);
      offlineGain.gain.setValueAtTime(0.2, offlineCtx.currentTime + 0.1);
      offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.2);
      
      offlineOscillator.connect(offlineGain);
      offlineGain.connect(offlineCtx.destination);
      
      offlineOscillator.start();
      offlineOscillator.stop(offlineCtx.currentTime + 0.2);
      
      offlineCtx.startRendering().then(buffer => {
        const blob = bufferToWave(buffer, length * audioCtx.sampleRate);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'beep-message.mp3';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      });
    }
    
  } catch (error) {
    console.error('Audio Context not supported or error generating sound', error);
  }
}

// Hàm tạo âm thanh phiên mới kiểu beep
function createBeepNewSessionSound(play = false, download = false) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Tạo oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'square';
    
    // Tạo gain node để điều chỉnh âm lượng
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    
    // Kết nối và bắt đầu
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (play) {
      // Beep ngắn 3 lần
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
      
      oscillator.start();
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.2);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.21);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.4);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.41);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      
      oscillator.stop(audioCtx.currentTime + 0.6);
      return;
    }
    
    if (download) {
      // Xuất ra file audio
      const length = 0.6;
      const offlineCtx = new OfflineAudioContext(1, length * audioCtx.sampleRate, audioCtx.sampleRate);
      
      const offlineOscillator = offlineCtx.createOscillator();
      offlineOscillator.type = 'square';
      offlineOscillator.frequency.setValueAtTime(800, offlineCtx.currentTime);
      
      const offlineGain = offlineCtx.createGain();
      
      // Beep ngắn 3 lần
      offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime);
      offlineGain.gain.linearRampToValueAtTime(0.2, offlineCtx.currentTime + 0.01);
      offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.1);
      
      offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime + 0.2);
      offlineGain.gain.linearRampToValueAtTime(0.2, offlineCtx.currentTime + 0.21);
      offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.3);
      
      offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime + 0.4);
      offlineGain.gain.linearRampToValueAtTime(0.2, offlineCtx.currentTime + 0.41);
      offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.5);
      
      offlineOscillator.connect(offlineGain);
      offlineGain.connect(offlineCtx.destination);
      
      offlineOscillator.start();
      offlineOscillator.stop(offlineCtx.currentTime + 0.6);
      
      offlineCtx.startRendering().then(buffer => {
        const blob = bufferToWave(buffer, length * audioCtx.sampleRate);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'beep-new-session.mp3';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      });
    }
    
  } catch (error) {
    console.error('Audio Context not supported or error generating sound', error);
  }
}

// Hàm tạo âm thanh thông báo kiểu beep
function createBeepNotificationSound(play = false, download = false) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Tạo oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'square';
    
    // Tạo gain node để điều chỉnh âm lượng
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    
    // Kết nối và bắt đầu
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (play) {
      // Beep tăng dần tần số
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
      
      oscillator.start();
      oscillator.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
      
      oscillator.stop(audioCtx.currentTime + 0.4);
      return;
    }
    
    if (download) {
      // Xuất ra file audio
      const length = 0.4;
      const offlineCtx = new OfflineAudioContext(1, length * audioCtx.sampleRate, audioCtx.sampleRate);
      
      const offlineOscillator = offlineCtx.createOscillator();
      offlineOscillator.type = 'square';
      offlineOscillator.frequency.setValueAtTime(600, offlineCtx.currentTime);
      offlineOscillator.frequency.linearRampToValueAtTime(1200, offlineCtx.currentTime + 0.3);
      
      const offlineGain = offlineCtx.createGain();
      offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime);
      offlineGain.gain.linearRampToValueAtTime(0.2, offlineCtx.currentTime + 0.01);
      offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.3);
      
      offlineOscillator.connect(offlineGain);
      offlineGain.connect(offlineCtx.destination);
      
      offlineOscillator.start();
      offlineOscillator.stop(offlineCtx.currentTime + 0.4);
      
      offlineCtx.startRendering().then(buffer => {
        const blob = bufferToWave(buffer, length * audioCtx.sampleRate);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'beep-notification.mp3';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      });
    }
    
  } catch (error) {
    console.error('Audio Context not supported or error generating sound', error);
  }
}

// Hàm tạo âm thanh kiểm tra kiểu beep
function createBeepTestSound(play = false, download = false) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Tạo oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'square';
    
    // Tạo gain node để điều chỉnh âm lượng
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    
    // Kết nối và bắt đầu
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (play) {
      // Tạo âm thanh kiểu beep
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
      
      oscillator.start();
      
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.2);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.21);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
      
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.4);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.41);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      
      oscillator.stop(audioCtx.currentTime + 0.6);
      return;
    }
    
    if (download) {
      // Xuất ra file audio
      const length = 0.6;
      const offlineCtx = new OfflineAudioContext(1, length * audioCtx.sampleRate, audioCtx.sampleRate);
      
      const offlineOscillator = offlineCtx.createOscillator();
      offlineOscillator.type = 'square';
      
      const offlineGain = offlineCtx.createGain();
      
      // Tạo âm thanh kiểu beep
      offlineOscillator.frequency.setValueAtTime(800, offlineCtx.currentTime);
      offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime);
      offlineGain.gain.linearRampToValueAtTime(0.2, offlineCtx.currentTime + 0.01);
      offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.1);
      
      offlineOscillator.frequency.setValueAtTime(1000, offlineCtx.currentTime + 0.2);
      offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime + 0.2);
      offlineGain.gain.linearRampToValueAtTime(0.2, offlineCtx.currentTime + 0.21);
      offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.3);
      
      offlineOscillator.frequency.setValueAtTime(1200, offlineCtx.currentTime + 0.4);
      offlineGain.gain.setValueAtTime(0, offlineCtx.currentTime + 0.4);
      offlineGain.gain.linearRampToValueAtTime(0.2, offlineCtx.currentTime + 0.41);
      offlineGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + 0.5);
      
      offlineOscillator.connect(offlineGain);
      offlineGain.connect(offlineCtx.destination);
      
      offlineOscillator.start();
      offlineOscillator.stop(offlineCtx.currentTime + 0.6);
      
      offlineCtx.startRendering().then(buffer => {
        const blob = bufferToWave(buffer, length * audioCtx.sampleRate);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'beep-test.mp3';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      });
    }
    
  } catch (error) {
    console.error('Audio Context not supported or error generating sound', error);
  }
}

// Hàm chuyển đổi AudioBuffer thành WAV
function bufferToWave(abuffer, len) {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;
  
  // Viết WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"
  
  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit
  
  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length
  
  // Lưu trữ giá trị mẫu
  for (i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }
  
  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      // Interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // Clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // Scale to 16-bit signed int
      view.setInt16(pos, sample, true);  // Write 16-bit sample
      pos += 2;
    }
    offset++; // Next source sample
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
  
  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  
  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

// Hàm chạy tất cả các hàm tạo âm thanh
function createAllSounds() {
  createMessageSound();
  setTimeout(() => createNewSessionSound(), 1000);
  setTimeout(() => createNotificationSound(), 2000);
  setTimeout(() => createTestSound(), 3000);
}

// Tạo các file âm thanh khi chạy script
createAllSounds(); 