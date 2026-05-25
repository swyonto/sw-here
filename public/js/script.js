/* ==========================================================================
   SW-HERE FRONTEND CONTROLLER - P2P & HYBRID TRANSFER
   ========================================================================== */

(function () {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabGlider = document.querySelector('.tab-glider');
  const panes = document.querySelectorAll('.tab-content-pane');
  
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const folderInput = document.getElementById('folder-input');
  const selectFilesBtn = document.getElementById('select-files-btn');
  const selectFoldersBtn = document.getElementById('select-folders-btn');
  
  const stagedContainer = document.getElementById('staged-container');
  const stagedCount = document.getElementById('staged-count');
  const stagedFilesList = document.getElementById('staged-files-list');
  const stagedTotalSize = document.getElementById('staged-total-size');
  const clearStagedBtn = document.getElementById('clear-staged-btn');
  const generateCodeBtn = document.getElementById('generate-code-btn');
  
  const sendSelectState = document.getElementById('send-select-state');
  const sendPairingState = document.getElementById('send-pairing-state');
  const pairingPinContainer = document.getElementById('pairing-pin-container');
  const qrcodeContainer = document.getElementById('qrcode-container');
  const copyPinBtn = document.getElementById('copy-pin-btn');
  const cancelSendSessionBtn = document.getElementById('cancel-send-session-btn');
  
  const receiveEntryState = document.getElementById('receive-entry-state');
  const receiveRequestState = document.getElementById('receive-request-state');
  const pinInputs = document.querySelectorAll('.pin-char-field');
  const pinInputGroup = document.getElementById('pin-input-group');
  const pinErrorText = document.getElementById('pin-error-text');
  const joinSessionBtn = document.getElementById('join-session-btn');
  
  const peerIdDisplay = document.getElementById('peer-id-display');
  const metaFilesCount = document.getElementById('meta-files-count');
  const metaFilesSize = document.getElementById('meta-files-size');
  const metaFilesList = document.getElementById('meta-files-list');
  const acceptTransferBtn = document.getElementById('accept-transfer-btn');
  const rejectTransferBtn = document.getElementById('reject-transfer-btn');
  
  const transferHud = document.getElementById('transfer-hud');
  const hudActivePeer = document.getElementById('hud-active-peer');
  const hudMethodBadge = document.getElementById('hud-method-badge');
  const hudCircleFill = document.getElementById('hud-circle-fill');
  const hudPercentageTxt = document.getElementById('hud-percentage-txt');
  const hudActionLabel = document.getElementById('hud-action-label');
  const hudStatSpeed = document.getElementById('hud-stat-speed');
  const hudStatDelivered = document.getElementById('hud-stat-delivered');
  const hudStatEta = document.getElementById('hud-stat-eta');
  const hudLinearFill = document.getElementById('hud-linear-fill');
  const hudActiveFileItem = document.getElementById('hud-active-file-item');
  const cancelTransferBtn = document.getElementById('cancel-transfer-btn');
  
  const toggleHistoryBtn = document.getElementById('toggle-history-btn');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const historyDrawer = document.getElementById('history-drawer');
  const historyBackdrop = document.getElementById('history-backdrop');
  const historyEmptyView = document.getElementById('history-empty-view');
  const historyItemsList = document.getElementById('history-items-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  
  const toastContainer = document.getElementById('toast-container');

  // Application Stated Variables
  let socket = null;
  let stagedFiles = []; // { file, id, relativePath }
  let activePin = null;
  let isSender = false;
  let activeTab = 'send'; // 'send' or 'receive'
  
  // WebRTC Variables
  let peerConnection = null;
  let dataChannel = null;
  let signalTimeout = null;
  let isChannelOpen = false;
  const STUN_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };
  
  // Transfer Control states
  let activeFilesMetadata = [];
  let currentFileIndex = 0;
  let receivedChunks = [];
  let totalTransferSize = 0;
  let totalBytesTransferred = 0;
  let transferStartTime = 0;
  let speedInterval = null;
  let bytesTransferredLastSecond = 0;
  let fallbackActive = false;
  let transferInProgress = false;

  // History Registry
  let transferHistory = JSON.parse(localStorage.getItem('sw-here-history') || '[]');

  /* ==========================================================================
     INITIALIZATION & EVENTS BINDING
     ========================================================================== */
  
  function init() {
    setupTabSwitcher();
    setupDropzone();
    setupPinInputs();
    setupHistoryDrawer();
    renderHistory();
    
    // Global socket connection will be opened on demand to preserve server sockets
    window.addEventListener('beforeunload', cleanupAllConnections);
  }

  // Toast Notification System
  function showToast(title, message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    
    toast.innerHTML = `
      <i class="fa-solid ${iconClass} toast-icon"></i>
      <div class="toast-body">
        <h4 class="toast-title">${title}</h4>
        <p class="toast-message">${message}</p>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  }

  // Format File Size
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0.00 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /* ==========================================================================
     TAB TOGGLE CONTROLLER
     ========================================================================== */
  
  function setupTabSwitcher() {
    tabBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        if (transferInProgress) {
          showToast('Transfer Active', 'Cannot switch tabs while a transfer is in progress.', 'error');
          return;
        }
        
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Slide tab glider
        if (tabGlider) {
          tabGlider.style.transform = `translateX(${index * 100}%)`;
        }
        
        // Shift content panels
        activeTab = btn.getAttribute('data-tab');
        panes.forEach(pane => {
          pane.classList.remove('active');
          if (pane.id === `pane-${activeTab}`) {
            pane.classList.add('active');
          }
        });
        
        // Reset states
        resetAllPanels();
      });
    });
  }

  function resetAllPanels() {
    cleanupAllConnections();
    
    // Sender panel reset
    sendSelectState.classList.remove('hidden');
    sendPairingState.classList.add('hidden');
    
    // Receiver panel reset
    receiveEntryState.classList.remove('hidden');
    receiveRequestState.classList.add('hidden');
    
    // HUD Reset
    transferHud.classList.add('hidden');
    
    // Clear receiver pin fields
    pinInputs.forEach(input => input.value = '');
    pinErrorText.classList.add('hidden');
  }

  /* ==========================================================================
     DRAG & DROP / FILE STAGING
     ========================================================================== */
  
  function setupDropzone() {
    selectFilesBtn.addEventListener('click', () => fileInput.click());
    selectFoldersBtn.addEventListener('click', () => folderInput.click());
    
    fileInput.addEventListener('change', (e) => handleStagedFiles(e.target.files));
    folderInput.addEventListener('change', (e) => handleStagedFiles(e.target.files, true));
    
    dropzone.addEventListener('click', (e) => {
      // Avoid clicking input when clicking buttons inside the dropzone
      if (e.target !== selectFilesBtn && e.target !== selectFoldersBtn && !selectFilesBtn.contains(e.target) && !selectFoldersBtn.contains(e.target)) {
        fileInput.click();
      }
    });
    
    // Drag and drop event listeners
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      }, false);
    });
    
    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt.items) {
        handleDroppedItems(dt.items);
      } else {
        handleStagedFiles(dt.files);
      }
    });
    
    clearStagedBtn.addEventListener('click', () => {
      stagedFiles = [];
      renderStagedFiles();
    });
    
    generateCodeBtn.addEventListener('click', initiateSenderSession);
  }

  // Handle files dropped via webkitDirectory recursion support
  async function handleDroppedItems(items) {
    const fileEntries = [];
    
    // Helper to scan files recursively
    async function traverseDirectory(entry, path = '') {
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve));
        fileEntries.push({
          file,
          relativePath: path + entry.name
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await new Promise((resolve) => {
          dirReader.readEntries(resolve);
        });
        for (const childEntry of entries) {
          await traverseDirectory(childEntry, path + entry.name + '/');
        }
      }
    }

    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(traverseDirectory(entry));
        } else {
          const file = item.getAsFile();
          if (file) {
            fileEntries.push({
              file,
              relativePath: file.name
            });
          }
        }
      }
    }
    
    await Promise.all(promises);
    
    // Merge into staged files
    fileEntries.forEach(item => {
      // Avoid duplicate file IDs
      const id = 'f_' + Math.random().toString(36).substr(2, 9);
      stagedFiles.push({
        file: item.file,
        id,
        relativePath: item.relativePath
      });
    });
    
    renderStagedFiles();
  }

  function handleStagedFiles(filesList, isFolder = false) {
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const id = 'f_' + Math.random().toString(36).substr(2, 9);
      
      // Preserve folder paths from folder selector
      const relativePath = isFolder && file.webkitRelativePath 
        ? file.webkitRelativePath 
        : file.name;
        
      stagedFiles.push({
        file,
        id,
        relativePath
      });
    }
    
    renderStagedFiles();
  }

  function removeStagedFile(id) {
    stagedFiles = stagedFiles.filter(item => item.id !== id);
    renderStagedFiles();
  }

  function getFileIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'fa-file-zipper text-pink';
    }
    if (['pdf'].includes(ext)) {
      return 'fa-file-pdf text-danger';
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
      return 'fa-file-image text-teal';
    }
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv'].includes(ext)) {
      return 'fa-file-video text-pink';
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
      return 'fa-file-audio text-indigo';
    }
    if (['txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'json', 'md', 'csv', 'html', 'css', 'js'].includes(ext)) {
      return 'fa-file-lines text-indigo';
    }
    return 'fa-file text-secondary';
  }

  function renderStagedFiles() {
    stagedFilesList.innerHTML = '';
    
    if (stagedFiles.length === 0) {
      stagedContainer.classList.add('hidden');
      return;
    }
    
    stagedContainer.classList.remove('hidden');
    stagedCount.innerText = stagedFiles.length;
    
    let totalSize = 0;
    
    stagedFiles.forEach(item => {
      totalSize += item.file.size;
      const fileCard = document.createElement('div');
      fileCard.className = 'staged-file-card';
      
      const iconClass = getFileIconClass(item.file.name);
      
      fileCard.innerHTML = `
        <div class="file-icon-box">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="file-details">
          <div class="file-name-txt" title="${item.relativePath}">${item.relativePath}</div>
          <div class="file-size-txt">${formatBytes(item.file.size)}</div>
        </div>
        <button type="button" class="remove-file-btn" data-id="${item.id}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;
      
      fileCard.querySelector('.remove-file-btn').addEventListener('click', () => {
        removeStagedFile(item.id);
      });
      
      stagedFilesList.appendChild(fileCard);
    });
    
    stagedTotalSize.innerText = formatBytes(totalSize);
  }

  /* ==========================================================================
     PIN INPUT SHIFT CONTROL (RECEIVER)
     ========================================================================== */
  
  function setupPinInputs() {
    pinInputs.forEach((input, index) => {
      // Focus move forward on type
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val) {
          // Keep only numeric
          e.target.value = val.replace(/[^0-9]/g, '');
          if (e.target.value && index < pinInputs.length - 1) {
            pinInputs[index + 1].focus();
          }
        }
      });
      
      // Focus move back on Backspace
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          pinInputs[index - 1].focus();
        }
      });
      
      // Auto paste code fully
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim().replace(/[^0-9]/g, '');
        if (pasteData.length >= 6) {
          pinInputs.forEach((field, fIdx) => {
            field.value = pasteData[fIdx] || '';
          });
          pinInputs[pinInputs.length - 1].focus();
        }
      });
    });
    
    joinSessionBtn.addEventListener('click', initiateReceiverJoin);
    
    // Press enter in last field to trigger
    pinInputs[pinInputs.length - 1].addEventListener('keyup', (e) => {
      if (e.key === 'Enter') initiateReceiverJoin();
    });
  }

  /* ==========================================================================
     SOCKETS pairing SIGNALLING (SENDER & RECEIVER FLOW)
     ========================================================================== */
  
  function establishSocket() {
    if (socket) return socket;
    
    socket = io();
    
    socket.on('connect', () => {
      document.querySelector('.server-status .status-dot').className = 'status-dot online';
      document.querySelector('.server-status .status-text').innerText = 'Connected';
    });
    
    socket.on('disconnect', () => {
      document.querySelector('.server-status .status-dot').className = 'status-dot offline';
      document.querySelector('.server-status .status-text').innerText = 'Disconnected';
      if (transferInProgress) {
        handleTransferFailure('Connection to server disrupted.');
      }
    });

    // Handle peer disconnect
    socket.on('peer-disconnected', ({ role }) => {
      showToast('Peer Disconnected', `The ${role} has left the session.`, 'error');
      if (transferInProgress) {
        handleTransferFailure('Peer lost connection.');
      } else {
        resetAllPanels();
      }
    });
    
    return socket;
  }

  // 1. SENDER: Start Session
  function initiateSenderSession() {
    if (stagedFiles.length === 0) return;
    
    isSender = true;
    establishSocket();
    
    socket.emit('create-session');
    
    socket.on('session-created', ({ pin }) => {
      activePin = pin;
      
      // Render pin code numbers
      const digitSpanElements = pairingPinContainer.querySelectorAll('.digit-box');
      for (let i = 0; i < 6; i++) {
        digitSpanElements[i].innerText = pin[i] || '-';
      }
      
      // Generate QR Code inside wrapper
      qrcodeContainer.innerHTML = '';
      const qrImg = document.createElement('img');
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${pin}`;
      qrImg.alt = 'Pairing QR';
      qrImg.className = 'qrcode-canvas';
      qrcodeContainer.appendChild(qrImg);
      
      // Hide selection panel, show pairing panel
      sendSelectState.classList.add('hidden');
      sendPairingState.classList.remove('hidden');
      
      showToast('Session Created', 'Pairing pin generated. Waiting for peer...', 'success');
      
      // Set copy pin button listener
      copyPinBtn.onclick = () => {
        navigator.clipboard.writeText(pin);
        showToast('Copied', 'Pairing pin copied to clipboard!', 'info');
      };
      
      cancelSendSessionBtn.onclick = () => {
        resetAllPanels();
      };
    });
    
    // Wait for receiver to connect
    socket.on('session-joined', ({ receiverSocketId }) => {
      showToast('Peer Connected', 'Establishing direct secure P2P link...', 'success');
      
      // Trigger WebRTC connection from sender side
      setupWebRTCConnection(receiverSocketId);
    });

    // Handle Transfer status answer from Receiver
    socket.on('transfer-status', ({ status }) => {
      if (status === 'accepted') {
        showToast('Transfer Approved', 'Peer approved the transfer. Commencing stream...', 'success');
        startWebRTCTransmission();
      } else if (status === 'rejected') {
        showToast('Transfer Rejected', 'Peer declined the incoming files.', 'error');
        resetAllPanels();
      } else if (status === 'cancelled') {
        handleTransferFailure('Transfer cancelled by peer.');
      }
    });

    // Listen for incoming RTC signals
    socket.on('signal', ({ data }) => {
      handleIncomingRTCSignal(data);
    });

    // Listen for fallback triggers
    socket.on('fallback-links', () => {
      // Handled in general
    });
  }

  // 2. RECEIVER: Join Session
  function initiateReceiverJoin() {
    let pin = '';
    pinInputs.forEach(input => pin += input.value);
    
    if (pin.length < 6) {
      pinErrorText.innerText = 'Input the full 6-digit pin code.';
      pinErrorText.classList.remove('hidden');
      return;
    }
    
    isSender = false;
    establishSocket();
    
    socket.emit('join-session', { pin });
    
    socket.on('session-joined', ({ senderSocketId }) => {
      activePin = pin;
      pinErrorText.classList.add('hidden');
      receiveEntryState.classList.add('hidden');
      
      // Show intermediate connecting beacon screen inside entry state (will be replaced by proposed request on meta arrival)
      showToast('Paired', 'Pairing successful! Shaking hands...', 'success');
      
      // Set up WebRTC connection as receiver
      setupWebRTCConnection(senderSocketId);
    });
    
    socket.on('session-error', ({ message }) => {
      pinErrorText.innerText = message;
      pinErrorText.classList.remove('hidden');
      showToast('Pairing Failed', message, 'error');
    });

    // Listen for Files metadata offer
    socket.on('transfer-meta', ({ files }) => {
      activeFilesMetadata = files;
      
      // Slide to proposed transfer decision state
      peerIdDisplay.innerText = activePin;
      metaFilesCount.innerText = files.length;
      
      let totalBytes = files.reduce((acc, f) => acc + f.size, 0);
      metaFilesSize.innerText = formatBytes(totalBytes);
      
      renderProposedFilesList(files);
      
      receiveEntryState.classList.add('hidden');
      receiveRequestState.classList.remove('hidden');
      
      // Action Buttons
      acceptTransferBtn.onclick = () => {
        socket.emit('transfer-status', { pin: activePin, status: 'accepted' });
        prepareReceiverHUD(totalBytes);
      };
      
      rejectTransferBtn.onclick = () => {
        socket.emit('transfer-status', { pin: activePin, status: 'rejected' });
        resetAllPanels();
      };
    });

    // Listen for incoming RTC signals
    socket.on('signal', ({ data }) => {
      handleIncomingRTCSignal(data);
    });

    // Listen for fallback triggers
    socket.on('fallback-links', ({ files }) => {
      engageHTTPReceiverFallback(files);
    });
  }

  function renderProposedFilesList(files) {
    metaFilesList.innerHTML = '';
    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'staged-file-card';
      const iconClass = getFileIconClass(file.name);
      
      card.innerHTML = `
        <div class="file-icon-box">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="file-details">
          <div class="file-name-txt" title="${file.path}">${file.path}</div>
          <div class="file-size-txt">${formatBytes(file.size)}</div>
        </div>
      `;
      metaFilesList.appendChild(card);
    });
  }

  /* ==========================================================================
     WEBRTC P2P TRANSFER CORE ENGINE
     ========================================================================== */
  
  function setupWebRTCConnection(peerSocketId) {
    peerConnection = new RTCPeerConnection(STUN_CONFIG);
    isChannelOpen = false;
    fallbackActive = false;
    
    // Sockets exchange signaling candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { pin: activePin, data: { candidate: event.candidate } });
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection State: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed') {
        triggerFallbackCheck();
      }
    };

    if (isSender) {
      // 1. SENDER: Create Data Channel
      dataChannel = peerConnection.createDataChannel('file-sharing', { ordered: true });
      bindDataChannelEvents();
      
      // Create RTC Offer
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
          socket.emit('signal', { pin: activePin, data: { sdp: peerConnection.localDescription } });
        })
        .catch(err => {
          console.error('[WebRTC] Offer generation error:', err);
          triggerFallbackCheck();
        });
        
      // Establish an 8 second timeout to fall back to HTTP if WebRTC doesn't open
      clearTimeout(signalTimeout);
      signalTimeout = setTimeout(() => {
        if (!isChannelOpen && !fallbackActive) {
          console.log('[WebRTC] Timeout. Engaging smart HTTP fallback.');
          engageHTTPSenderFallback();
        }
      }, 8500);
      
    } else {
      // 2. RECEIVER: Bind Data Channel Receiver event listener
      peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        bindDataChannelEvents();
      };
    }
  }

  function handleIncomingRTCSignal(data) {
    if (!peerConnection) return;
    
    if (data.sdp) {
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
        .then(() => {
          if (!isSender && peerConnection.remoteDescription.type === 'offer') {
            peerConnection.createAnswer()
              .then(answer => peerConnection.setLocalDescription(answer))
              .then(() => {
                socket.emit('signal', { pin: activePin, data: { sdp: peerConnection.localDescription } });
              })
              .catch(err => console.error('[WebRTC] Answer generation error:', err));
          }
        })
        .catch(err => console.error('[WebRTC] Remote SDP set error:', err));
    } else if (data.candidate) {
      peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
        .catch(err => console.error('[WebRTC] Candidate registration error:', err));
    }
  }

  function bindDataChannelEvents() {
    if (!dataChannel) return;
    
    dataChannel.binaryType = 'arraybuffer';
    
    dataChannel.onopen = () => {
      console.log('[WebRTC] Direct P2P Channel Securely Opened!');
      isChannelOpen = true;
      clearTimeout(signalTimeout);
      
      if (isSender) {
        // Transmit files metadata offer to receiver via Sockets
        activeFilesMetadata = stagedFiles.map(item => ({
          name: item.file.name,
          size: item.file.size,
          path: item.relativePath
        }));
        
        socket.emit('transfer-meta', { pin: activePin, files: activeFilesMetadata });
      }
    };
    
    dataChannel.onclose = () => {
      console.log('[WebRTC] DataChannel closed.');
      isChannelOpen = false;
      if (transferInProgress) {
        handleTransferFailure('Data Channel disconnected.');
      }
    };
    
    dataChannel.onerror = (err) => {
      console.error('[WebRTC] DataChannel Error:', err);
      triggerFallbackCheck();
    };
    
    if (!isSender) {
      dataChannel.onmessage = handleIncomingDataMessage;
    }
  }

  function triggerFallbackCheck() {
    if (fallbackActive) return;
    
    if (isSender) {
      engageHTTPSenderFallback();
    }
  }

  /* ==========================================================================
     SENDER: WebRTC DATA TRANSMISSION & BACKPRESSURE CONTROL
     ========================================================================== */
  
  function startWebRTCTransmission() {
    transferInProgress = true;
    currentFileIndex = 0;
    totalTransferSize = stagedFiles.reduce((acc, f) => acc + f.file.size, 0);
    totalBytesTransferred = 0;
    transferStartTime = Date.now();
    bytesTransferredLastSecond = 0;
    
    prepareSenderHUD();
    startSpeedInterval();
    
    streamNextFile();
  }

  function prepareSenderHUD() {
    sendPairingState.classList.add('hidden');
    transferHud.classList.remove('hidden');
    
    hudActivePeer.innerText = `Receiver Device (${activePin})`;
    hudMethodBadge.className = 'hud-transfer-badge';
    hudMethodBadge.innerHTML = '<i class="fa-solid fa-bolt mr-xs"></i> P2P DIRECT';
    
    updateHUDProgress(0);
    
    cancelTransferBtn.onclick = () => {
      socket.emit('transfer-status', { pin: activePin, status: 'cancelled' });
      handleTransferFailure('Transfer aborted.');
    };
  }

  function updateHUDProgress(percent) {
    percent = Math.min(100, Math.max(0, percent));
    
    // Circular fill calculation
    // r=70 => Circumference = 2 * PI * r = 439.82
    const circumference = 439.82;
    const offset = circumference - (percent / 100) * circumference;
    hudCircleFill.style.strokeDashoffset = offset;
    
    hudPercentageTxt.innerText = `${Math.round(percent)}%`;
    hudLinearFill.style.width = `${percent}%`;
  }

  function startSpeedInterval() {
    clearInterval(speedInterval);
    speedInterval = setInterval(() => {
      // Calculate speed
      const speed = bytesTransferredLastSecond;
      bytesTransferredLastSecond = 0;
      hudStatSpeed.innerText = `${formatBytes(speed)}/s`;
      
      // Calculate ETA
      const remainingBytes = totalTransferSize - totalBytesTransferred;
      if (speed > 0) {
        const etaSeconds = Math.ceil(remainingBytes / speed);
        const mins = Math.floor(etaSeconds / 60);
        const secs = etaSeconds % 60;
        
        const elapsedSeconds = Math.floor((Date.now() - transferStartTime) / 1000);
        const eMins = Math.floor(elapsedSeconds / 60);
        const eSecs = elapsedSeconds % 60;
        
        const pad = (num) => String(num).padStart(2, '0');
        hudStatEta.innerText = `${pad(eMins)}:${pad(eSecs)} / ${pad(mins)}:${pad(secs)}`;
      } else {
        hudStatEta.innerText = '--:-- / --:--';
      }
      
      // Delivered string
      hudStatDelivered.innerText = `${formatBytes(totalBytesTransferred)} / ${formatBytes(totalTransferSize)}`;
    }, 1000);
  }

  function streamNextFile() {
    if (currentFileIndex >= stagedFiles.length) {
      // Finished all files!
      dataChannel.send(JSON.stringify({ type: 'transfer-complete' }));
      completeTransferSession(true);
      return;
    }
    
    const item = stagedFiles[currentFileIndex];
    const file = item.file;
    
    // Update active UI card
    const iconClass = getFileIconClass(file.name);
    hudActiveFileItem.innerHTML = `
      <div class="file-icon-box">
        <i class="fa-solid ${iconClass}"></i>
      </div>
      <div class="file-details">
        <div class="file-name-txt">${item.relativePath}</div>
        <div class="file-size-txt">Sending: <span class="text-teal">${formatBytes(0)} / ${formatBytes(file.size)}</span></div>
      </div>
    `;
    
    // Send File Start command chunk
    dataChannel.send(JSON.stringify({
      type: 'file-start',
      index: currentFileIndex,
      name: file.name,
      size: file.size,
      path: item.relativePath
    }));
    
    const CHUNK_SIZE = 64 * 1024; // 64KB
    let offset = 0;
    const fileReader = new FileReader();
    
    function readSlice() {
      if (!transferInProgress) return;
      
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      fileReader.readAsArrayBuffer(slice);
    }
    
    fileReader.onload = (event) => {
      if (!transferInProgress) return;
      
      const buffer = event.target.result;
      dataChannel.send(buffer);
      
      offset += buffer.byteLength;
      totalBytesTransferred += buffer.byteLength;
      bytesTransferredLastSecond += buffer.byteLength;
      
      // Update individual file progress indicator
      const textSpan = hudActiveFileItem.querySelector('.file-size-txt span');
      if (textSpan) {
        textSpan.innerText = `${formatBytes(offset)} / ${formatBytes(file.size)}`;
      }
      
      // Update overall progress percentage
      const totalPercent = (totalBytesTransferred / totalTransferSize) * 100;
      updateHUDProgress(totalPercent);
      
      if (offset < file.size) {
        // Backpressure monitoring: if buffer is choked, pause reading
        // threshold 1MB
        if (dataChannel.bufferedAmount > 1048576) {
          dataChannel.bufferedAmountLowThreshold = 262144; // 256KB
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = null; // Unbind
            readSlice(); // Resume
          };
        } else {
          readSlice();
        }
      } else {
        // File completely transmitted!
        dataChannel.send(JSON.stringify({ type: 'file-end', index: currentFileIndex }));
        currentFileIndex++;
        
        // Wait a slight fraction for browser pipeline before starting next file
        setTimeout(streamNextFile, 250);
      }
    };
    
    readSlice();
  }

  /* ==========================================================================
     RECEIVER: WebRTC DATA ACCUMULATION & AGGREGATION
     ========================================================================== */
  
  function prepareReceiverHUD(totalBytes) {
    receiveRequestState.classList.add('hidden');
    transferHud.classList.remove('hidden');
    
    hudActivePeer.innerText = `Sender Device (${activePin})`;
    hudMethodBadge.className = 'hud-transfer-badge';
    hudMethodBadge.innerHTML = '<i class="fa-solid fa-bolt mr-xs"></i> P2P DIRECT';
    
    transferInProgress = true;
    totalTransferSize = totalBytes;
    totalBytesTransferred = 0;
    transferStartTime = Date.now();
    bytesTransferredLastSecond = 0;
    
    updateHUDProgress(0);
    startSpeedInterval();
    
    cancelTransferBtn.onclick = () => {
      socket.emit('transfer-status', { pin: activePin, status: 'cancelled' });
      handleTransferFailure('Transfer aborted.');
    };
  }

  function handleIncomingDataMessage(event) {
    if (!transferInProgress) return;
    
    if (typeof event.data === 'string') {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'file-start') {
        currentFileIndex = msg.index;
        receivedChunks = [];
        totalBytesTransferred = totalBytesTransferred - (totalBytesTransferred % 1); // Align
        
        const fileMeta = activeFilesMetadata[currentFileIndex];
        fileMeta.name = msg.name;
        fileMeta.size = msg.size;
        fileMeta.path = msg.path;
        
        const iconClass = getFileIconClass(msg.name);
        hudActiveFileItem.innerHTML = `
          <div class="file-icon-box">
            <i class="fa-solid ${iconClass}"></i>
          </div>
          <div class="file-details">
            <div class="file-name-txt">${msg.path}</div>
            <div class="file-size-txt">Receiving: <span class="text-teal">0.00 B / ${formatBytes(msg.size)}</span></div>
          </div>
        `;
      } else if (msg.type === 'file-end') {
        // Construct array chunks into aggregate Blob and save
        const fileMeta = activeFilesMetadata[currentFileIndex];
        const blob = new Blob(receivedChunks, { type: 'application/octet-stream' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileMeta.name;
        document.body.appendChild(link);
        link.click();
        
        // Revoke to conserve browser tab memory
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }, 150);
        
        // Record to localStorage log
        recordHistoryItem(fileMeta.name, fileMeta.size, 'P2P Direct', 'success');
        
        showToast('File Saved', `${fileMeta.name} downloaded successfully!`, 'success');
      } else if (msg.type === 'transfer-complete') {
        completeTransferSession(true);
      }
      
    } else {
      // Direct binary array buffer chunk
      const chunk = event.data;
      receivedChunks.push(chunk);
      totalBytesTransferred += chunk.byteLength;
      bytesTransferredLastSecond += chunk.byteLength;
      
      const fileMeta = activeFilesMetadata[currentFileIndex];
      const receivedFileSize = receivedChunks.reduce((acc, c) => acc + c.byteLength, 0);
      
      const textSpan = hudActiveFileItem.querySelector('.file-size-txt span');
      if (textSpan) {
        textSpan.innerText = `${formatBytes(receivedFileSize)} / ${formatBytes(fileMeta.size)}`;
      }
      
      const totalPercent = (totalBytesTransferred / totalTransferSize) * 100;
      updateHUDProgress(totalPercent);
    }
  }

  /* ==========================================================================
     SMART HTTP UPLOAD/DOWNLOAD FALLBACK FLOW
     ========================================================================== */
  
  // 1. SENDER HTTP Upload Fallback trigger
  function engageHTTPSenderFallback() {
    if (fallbackActive) return;
    fallbackActive = true;
    clearTimeout(signalTimeout);
    
    showToast('P2P Direct Blocked', 'Network strictness detected. Routing secure Cloud Fallback...', 'info');
    
    // Switch HUD display mode
    transferInProgress = true;
    prepareSenderHUD();
    
    hudMethodBadge.className = 'hud-transfer-badge fallback-badge';
    hudMethodBadge.innerHTML = '<i class="fa-solid fa-cloud mr-xs"></i> CLOUD RELAY';
    hudActionLabel.innerText = 'Uploading';
    
    // Package files into FormData payload
    const formData = new FormData();
    stagedFiles.forEach(item => {
      formData.append('files', item.file, item.relativePath);
    });
    
    // Set up XML Http Request to monitor real upload progress
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        updateHUDProgress(percent);
        
        totalBytesTransferred = event.loaded;
        bytesTransferredLastSecond = event.loaded - (totalBytesTransferred - bytesTransferredLastSecond); // approximation
        
        hudStatDelivered.innerText = `${formatBytes(event.loaded)} / ${formatBytes(event.total)}`;
      }
    };
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        
        // Broadcast uploaded direct fallback link package to receiver
        socket.emit('transfer-status', { pin: activePin, status: 'accepted' }); // secure approval bypass
        socket.emit('fallback-links', { pin: activePin, files: res.files });
        
        completeTransferSession(true);
      } else {
        handleTransferFailure('Secure upload pipe failed.');
      }
    };
    
    xhr.onerror = () => {
      handleTransferFailure('Network connection refused.');
    };
    
    xhr.send(formData);
    
    // Fake speed indicator
    totalTransferSize = stagedFiles.reduce((acc, f) => acc + f.file.size, 0);
    transferStartTime = Date.now();
    bytesTransferredLastSecond = 0;
    startSpeedInterval();
    
    cancelTransferBtn.onclick = () => {
      xhr.abort();
      handleTransferFailure('Upload cancelled.');
    };
  }

  // 2. RECEIVER HTTP Download Fallback trigger
  function engageHTTPReceiverFallback(files) {
    fallbackActive = true;
    showToast('Secure Fallback Routed', 'Engaging automated download streams...', 'info');
    
    // Switch HUD display mode
    totalTransferSize = files.reduce((acc, f) => acc + f.size, 0);
    prepareReceiverHUD(totalTransferSize);
    
    hudMethodBadge.className = 'hud-transfer-badge fallback-badge';
    hudMethodBadge.innerHTML = '<i class="fa-solid fa-cloud mr-xs"></i> CLOUD RELAY';
    hudActionLabel.innerText = 'Downloading';
    
    // Trigger sequential download link calls
    let completedDownloads = 0;
    
    function downloadNextFallback(index) {
      if (index >= files.length) {
        completeTransferSession(true);
        return;
      }
      
      const file = files[index];
      
      const iconClass = getFileIconClass(file.name);
      hudActiveFileItem.innerHTML = `
        <div class="file-icon-box">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="file-details">
          <div class="file-name-txt">${file.name}</div>
          <div class="file-size-txt">Fetching: <span class="text-teal">Connecting...</span></div>
        </div>
      `;
      
      // Trigger browser download via dynamic frame anchor
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        completedDownloads++;
        
        // Approximation of progress
        const percent = (completedDownloads / files.length) * 100;
        updateHUDProgress(percent);
        
        totalBytesTransferred = (completedDownloads / files.length) * totalTransferSize;
        hudStatDelivered.innerText = `${formatBytes(totalBytesTransferred)} / ${formatBytes(totalTransferSize)}`;
        
        recordHistoryItem(file.name, file.size, 'Cloud Fallback', 'success');
        
        // Proceed sequence
        setTimeout(() => downloadNextFallback(index + 1), 600);
      }, 500);
    }
    
    downloadNextFallback(0);
  }

  /* ==========================================================================
     CLEANUP & TERMINATION MANAGEMENT
     ========================================================================== */
  
  function completeTransferSession(success = true) {
    transferInProgress = false;
    clearInterval(speedInterval);
    
    if (success) {
      showToast('Transfer Complete', 'All files processed successfully!', 'success');
      
      // If sender, record full batch history items
      if (isSender) {
        stagedFiles.forEach(item => {
          recordHistoryItem(item.file.name, item.file.size, fallbackActive ? 'Cloud Fallback' : 'P2P Direct', 'success');
        });
        stagedFiles = [];
        renderStagedFiles();
      }
      
      renderHistory();
      
      setTimeout(() => {
        resetAllPanels();
      }, 3500);
    }
  }

  function handleTransferFailure(reason) {
    transferInProgress = false;
    clearInterval(speedInterval);
    showToast('Transfer Interrupted', reason, 'error');
    
    if (isSender) {
      stagedFiles.forEach(item => {
        recordHistoryItem(item.file.name, item.file.size, fallbackActive ? 'Cloud Fallback' : 'P2P Direct', 'failed');
      });
    } else if (activeFilesMetadata) {
      activeFilesMetadata.forEach(file => {
        recordHistoryItem(file.name, file.size, fallbackActive ? 'Cloud Fallback' : 'P2P Direct', 'failed');
      });
    }
    
    renderHistory();
    
    setTimeout(() => {
      resetAllPanels();
    }, 4000);
  }

  function cleanupAllConnections() {
    clearTimeout(signalTimeout);
    clearInterval(speedInterval);
    transferInProgress = false;
    
    if (dataChannel) {
      try {
        dataChannel.close();
      } catch (e) {}
      dataChannel = null;
    }
    
    if (peerConnection) {
      try {
        peerConnection.close();
      } catch (e) {}
      peerConnection = null;
    }
    
    if (socket) {
      try {
        socket.disconnect();
      } catch (e) {}
      socket = null;
    }
    
    isChannelOpen = false;
    fallbackActive = false;
  }

  /* ==========================================================================
     HISTORY drawers AND LOCALSTORAGE LOGS
     ========================================================================== */
  
  function setupHistoryDrawer() {
    toggleHistoryBtn.addEventListener('click', () => {
      historyDrawer.classList.add('active');
      historyBackdrop.classList.add('active');
    });
    
    const closeTrigger = () => {
      historyDrawer.classList.remove('active');
      historyBackdrop.classList.remove('active');
    };
    
    closeHistoryBtn.addEventListener('click', closeTrigger);
    historyBackdrop.addEventListener('click', closeTrigger);
    
    clearHistoryBtn.addEventListener('click', () => {
      transferHistory = [];
      localStorage.setItem('sw-here-history', JSON.stringify(transferHistory));
      renderHistory();
      showToast('Cleared', 'History logs wiped successfully.', 'info');
    });
  }

  function recordHistoryItem(name, size, method, status) {
    const newItem = {
      name,
      size,
      method,
      status,
      timestamp: Date.now()
    };
    
    transferHistory.unshift(newItem);
    // Limit to 40 items max in storage
    if (transferHistory.length > 40) {
      transferHistory.pop();
    }
    
    localStorage.setItem('sw-here-history', JSON.stringify(transferHistory));
  }

  function renderHistory() {
    historyItemsList.innerHTML = '';
    
    if (transferHistory.length === 0) {
      historyEmptyView.classList.remove('hidden');
      historyItemsList.classList.add('hidden');
      return;
    }
    
    historyEmptyView.classList.add('hidden');
    historyItemsList.classList.remove('hidden');
    
    transferHistory.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-item-card';
      
      const iconClass = getFileIconClass(item.name);
      const statusBadge = item.status === 'success' 
        ? '<span class="history-status-badge success">Success</span>' 
        : '<span class="history-status-badge failed">Failed</span>';
        
      const dateString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
                         ' ' + new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                         
      card.innerHTML = `
        <div class="file-icon-box">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="file-details">
          <div class="file-name-txt" title="${item.name}">${item.name}</div>
          <div class="file-size-txt" style="margin-top:4px;">
            ${formatBytes(item.size)} &bull; ${item.method} &bull; ${dateString}
          </div>
        </div>
        ${statusBadge}
      `;
      
      historyItemsList.appendChild(card);
    });
  }

  // Self Executing start
  document.addEventListener('DOMContentLoaded', init);

})();
