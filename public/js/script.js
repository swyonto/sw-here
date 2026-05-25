/* ==========================================================================
   SW-HERE FRONTEND CONTROLLER - PERSISTENT ROOM P2P & HYBRID TRANSFER
   ========================================================================== */

(function () {
  // Navigation & Tab Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabGlider = document.querySelector('.tab-glider');
  const panes = document.querySelectorAll('.tab-content-pane');
  
  // Starting Sender Elements
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
  
  // Starting Receiver Elements
  const receiveEntryState = document.getElementById('receive-entry-state');
  const receiveRequestState = document.getElementById('receive-request-state');
  const pinInputs = document.querySelectorAll('.pin-char-field');
  const pinErrorText = document.getElementById('pin-error-text');
  const joinSessionBtn = document.getElementById('join-session-btn');
  
  // Connected Room Hub Elements
  const paneRoomHub = document.getElementById('pane-room-hub');
  const roomPinDisplay = document.getElementById('room-pin-display');
  const dropzoneRoom = document.getElementById('dropzone-room');
  const fileInputRoom = document.getElementById('file-input-room');
  const folderInputRoom = document.getElementById('folder-input-room');
  const selectFilesBtnRoom = document.getElementById('select-files-btn-room');
  const selectFoldersBtnRoom = document.getElementById('select-folders-btn-room');
  const stagedContainerRoom = document.getElementById('staged-container-room');
  const stagedCountRoom = document.getElementById('staged-count-room');
  const stagedFilesListRoom = document.getElementById('staged-files-list-room');
  const stagedTotalSizeRoom = document.getElementById('staged-total-size-room');
  const clearStagedBtnRoom = document.getElementById('clear-staged-btn-room');
  const sendFilesBtnRoom = document.getElementById('send-files-btn-room');
  const leaveRoomBtn = document.getElementById('leave-room-btn');
  
  // Proposal Modal Overlay Elements
  const proposalBackdrop = document.getElementById('proposal-backdrop');
  const proposalModal = document.getElementById('proposal-modal');
  const propCount = document.getElementById('prop-count');
  const propSize = document.getElementById('prop-size');
  const propFilesList = document.getElementById('prop-files-list');
  const propAcceptBtn = document.getElementById('prop-accept-btn');
  const propRejectBtn = document.getElementById('prop-reject-btn');
  
  // Transfer HUD Elements
  const transferHud = document.getElementById('transfer-hud');
  const hudBackdrop = document.getElementById('hud-backdrop');
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
  
  // History Drawer Elements
  const toggleHistoryBtn = document.getElementById('toggle-history-btn');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const historyDrawer = document.getElementById('history-drawer');
  const historyBackdrop = document.getElementById('history-backdrop');
  const historyEmptyView = document.getElementById('history-empty-view');
  const historyItemsList = document.getElementById('history-items-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  
  const toastContainer = document.getElementById('toast-container');

  // QR Code Scanner DOM Elements
  const openQrScannerBtn = document.getElementById('open-qr-scanner-btn');
  const closeQrScannerBtn = document.getElementById('close-qr-scanner-btn');
  const qrScannerModal = document.getElementById('qr-scanner-modal');
  const qrScannerBackdrop = document.getElementById('qr-scanner-backdrop');

  // Application State Variables
  let socket = null;
  let stagedFiles = []; // { file, id, relativePath }
  let activePin = null;
  let isSender = false;
  let html5QrCode = null;
  let activeTab = 'send'; // 'send' or 'receive'
  let inRoomMode = false;
  
  // WebRTC Variables
  let peerConnection = null;
  let dataChannel = null;
  let signalTimeout = null;
  let isChannelOpen = false;
  const STUN_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };
  
  // Transfer Variables
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
  let activeXhr = null;

  // History Registry
  let transferHistory = JSON.parse(localStorage.getItem('sw-here-history') || '[]');

  /* ==========================================================================
     INITIALIZATION & EVENT BINDINGS
     ========================================================================== */
  
  function init() {
    setupTabSwitcher();
    setupStartingDropzones();
    setupRoomDropzones();
    setupPinInputs();
    setupHistoryDrawer();
    renderHistory();
    
    // Check for query parameter PIN code for auto-connect accessibility
    checkUrlPinCode();
    
    // Theme switcher setup
    setupThemeSwitcher();
    
    window.addEventListener('beforeunload', cleanupAllConnections);
  }

  // Theme Switcher Controller
  function setupThemeSwitcher() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const brandLogoImg = document.querySelector('.brand-logo-img');
    if (!themeToggleBtn) return;
    
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('sw-here-theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      themeToggleBtn.innerHTML = '<i class="fa-regular fa-moon"></i>';
      if (brandLogoImg) brandLogoImg.src = '/images/sw-here-logo.png';
    } else {
      document.body.classList.remove('light-mode');
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
      if (brandLogoImg) brandLogoImg.src = '/images/image-dark.png';
    }
    
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
      const isLight = document.body.classList.contains('light-mode');
      
      if (isLight) {
        themeToggleBtn.innerHTML = '<i class="fa-regular fa-moon"></i>';
        localStorage.setItem('sw-here-theme', 'light');
        if (brandLogoImg) brandLogoImg.src = '/images/sw-here-logo.png';
      } else {
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        localStorage.setItem('sw-here-theme', 'dark');
        if (brandLogoImg) brandLogoImg.src = '/images/image-dark.png';
      }
    });
  }

  // Check query parameter PIN code for auto-connect accessibility
  function checkUrlPinCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');
    if (pinFromUrl && pinFromUrl.length === 4 && /^\d+$/.test(pinFromUrl)) {
      showToast('PIN Detected', `Auto-filling session PIN: ${pinFromUrl}`, 'info');
      
      // Auto switch to receive tab
      const receiveTabBtn = document.querySelector('.tab-btn[data-tab="receive"]');
      if (receiveTabBtn) {
        receiveTabBtn.click();
      }
      
      // Populate numeric pin inputs
      pinInputs.forEach((input, index) => {
        input.value = pinFromUrl[index] || '';
      });
      
      // Auto initiate connection join
      setTimeout(() => {
        initiateReceiverJoin();
      }, 800);
    }
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
        if (inRoomMode) {
          showToast('Active Connection', 'Leave the Connected Room before changing tabs.', 'error');
          return;
        }
        
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (tabGlider) {
          tabGlider.style.transform = `translateX(${index * 100}%)`;
        }
        
        activeTab = btn.getAttribute('data-tab');
        panes.forEach(pane => {
          pane.classList.remove('active');
          if (pane.id === `pane-${activeTab}`) {
            pane.classList.add('active');
          }
        });
        
        resetAllPanels();
      });
    });
  }

  function resetAllPanels() {
    cleanupAllConnections();
    inRoomMode = false;
    
    // Sender panel reset
    sendSelectState.classList.remove('hidden');
    sendPairingState.classList.add('hidden');
    
    // Receiver panel reset
    receiveEntryState.classList.remove('hidden');
    receiveRequestState.classList.add('hidden');
    
    // Room and HUD reset
    paneRoomHub.classList.remove('active');
    transferHud.classList.add('hidden');
    if (hudBackdrop) hudBackdrop.classList.remove('active');
    proposalModal.classList.add('hidden');
    proposalBackdrop.classList.remove('active');
    
    // Clear pin entries
    pinInputs.forEach(input => input.value = '');
    pinErrorText.classList.add('hidden');
    
    // Restore tab selectors
    document.getElementById('tab-switcher').classList.remove('hidden');
  }

  /* ==========================================================================
     DROPZONE DRAG & DROP & staging (STARTING VIEW)
     ========================================================================== */
  
  function setupStartingDropzones() {
    selectFilesBtn.addEventListener('click', () => fileInput.click());
    selectFoldersBtn.addEventListener('click', () => folderInput.click());
    
    fileInput.addEventListener('change', (e) => handleStagedFiles(e.target.files));
    folderInput.addEventListener('change', (e) => handleStagedFiles(e.target.files, true));
    
    dropzone.addEventListener('click', (e) => {
      if (e.target !== selectFilesBtn && e.target !== selectFoldersBtn && !selectFilesBtn.contains(e.target) && !selectFoldersBtn.contains(e.target)) {
        fileInput.click();
      }
    });
    
    setupDragAndDropEvents(dropzone, handleDroppedStartingItems);
    
    clearStagedBtn.addEventListener('click', () => {
      stagedFiles = [];
      renderStagedFiles();
    });
    
    generateCodeBtn.addEventListener('click', initiateSenderSession);
    const instantRoomBtn = document.getElementById('instant-room-btn');
    if (instantRoomBtn) {
      instantRoomBtn.addEventListener('click', initiateSenderSession);
    }
  }

  function setupDragAndDropEvents(zone, dropCallback) {
    ['dragenter', 'dragover'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('dragover');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('dragover');
      }, false);
    });
    
    zone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt.items) {
        dropCallback(dt.items);
      } else {
        handleStagedFiles(dt.files);
      }
    });
  }

  async function handleDroppedStartingItems(items) {
    await parseAndStageItems(items, false);
  }

  async function handleDroppedRoomItems(items) {
    await parseAndStageItems(items, true);
  }

  async function parseAndStageItems(items, isRoom = false) {
    const fileEntries = [];
    
    async function traverseDirectory(entry, path = '') {
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve));
        fileEntries.push({ file, relativePath: path + entry.name });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await new Promise((resolve) => dirReader.readEntries(resolve));
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
            fileEntries.push({ file, relativePath: file.name });
          }
        }
      }
    }
    
    await Promise.all(promises);
    
    fileEntries.forEach(item => {
      const id = 'f_' + Math.random().toString(36).substr(2, 9);
      stagedFiles.push({
        file: item.file,
        id,
        relativePath: item.relativePath
      });
    });
    
    if (isRoom) {
      renderStagedFilesRoom();
    } else {
      renderStagedFiles();
    }
  }

  function handleStagedFiles(filesList, isFolder = false, isRoom = false) {
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const id = 'f_' + Math.random().toString(36).substr(2, 9);
      const relativePath = isFolder && file.webkitRelativePath 
        ? file.webkitRelativePath 
        : file.name;
        
      stagedFiles.push({
        file,
        id,
        relativePath
      });
    }
    
    if (isRoom) {
      renderStagedFilesRoom();
    } else {
      renderStagedFiles();
    }
  }

  function getFileIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'fa-file-zipper text-pink';
    if (['pdf'].includes(ext)) return 'fa-file-pdf text-danger';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'fa-file-image text-teal';
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv'].includes(ext)) return 'fa-file-video text-pink';
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return 'fa-file-audio text-indigo';
    if (['txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'json', 'md', 'csv', 'html', 'css', 'js'].includes(ext)) return 'fa-file-lines text-indigo';
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

  function removeStagedFile(id) {
    stagedFiles = stagedFiles.filter(item => item.id !== id);
    renderStagedFiles();
  }

  /* ==========================================================================
     CONNECTED ROOM HUB EVENT & STAGING CONTROLLER
     ========================================================================== */
  
  function setupRoomDropzones() {
    selectFilesBtnRoom.addEventListener('click', () => fileInputRoom.click());
    selectFoldersBtnRoom.addEventListener('click', () => folderInputRoom.click());
    
    fileInputRoom.addEventListener('change', (e) => handleStagedFiles(e.target.files, false, true));
    folderInputRoom.addEventListener('change', (e) => handleStagedFiles(e.target.files, true, true));
    
    dropzoneRoom.addEventListener('click', (e) => {
      if (e.target !== selectFilesBtnRoom && e.target !== selectFoldersBtnRoom && !selectFilesBtnRoom.contains(e.target) && !selectFoldersBtnRoom.contains(e.target)) {
        fileInputRoom.click();
      }
    });
    
    setupDragAndDropEvents(dropzoneRoom, handleDroppedRoomItems);
    
    clearStagedBtnRoom.addEventListener('click', () => {
      stagedFiles = [];
      renderStagedFilesRoom();
    });
    
    sendFilesBtnRoom.addEventListener('click', proposeActiveRoomTransfer);
    
    leaveRoomBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to disconnect and leave this room?')) {
        resetAllPanels();
      }
    });
  }

  function renderStagedFilesRoom() {
    stagedFilesListRoom.innerHTML = '';
    if (stagedFiles.length === 0) {
      stagedContainerRoom.classList.add('hidden');
      return;
    }
    
    stagedContainerRoom.classList.remove('hidden');
    stagedCountRoom.innerText = stagedFiles.length;
    
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
        stagedFiles = stagedFiles.filter(i => i.id !== item.id);
        renderStagedFilesRoom();
      });
      
      stagedFilesListRoom.appendChild(fileCard);
    });
    
    stagedTotalSizeRoom.innerText = formatBytes(totalSize);
  }

  /* ==========================================================================
     PIN INPUT BOARD (RECEIVER FOCUSING SEQUENCE)
     ========================================================================== */
  
  function setupPinInputs() {
    pinInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val) {
          e.target.value = val.replace(/[^0-9]/g, '');
          if (e.target.value && index < pinInputs.length - 1) {
            pinInputs[index + 1].focus();
          }
        }
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          pinInputs[index - 1].focus();
        }
      });
      
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim().replace(/[^0-9]/g, '');
        if (pasteData.length >= 4) {
          pinInputs.forEach((field, fIdx) => {
            field.value = pasteData[fIdx] || '';
          });
          pinInputs[pinInputs.length - 1].focus();
        }
      });
    });
    
    joinSessionBtn.addEventListener('click', initiateReceiverJoin);
    pinInputs[pinInputs.length - 1].addEventListener('keyup', (e) => {
      if (e.key === 'Enter') initiateReceiverJoin();
    });

    if (openQrScannerBtn) {
      openQrScannerBtn.addEventListener('click', startQRScanner);
    }
    if (closeQrScannerBtn) {
      closeQrScannerBtn.addEventListener('click', closeQRScanner);
    }
  }

  /* ==========================================================================
     SOCKET pairing FLOW & PERSISTENT CHANNELS
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
        handleTransferFailure('Connection disrupted.');
      }
      resetAllPanels();
    });

    socket.on('peer-disconnected', ({ role }) => {
      showToast('Peer Disconnected', `The ${role} has left this room.`, 'error');
      resetAllPanels();
    });
    
    return socket;
  }

  // 1. SENDER: Generated Pairing Pin
  function initiateSenderSession() {
    isSender = true;
    establishSocket();
    
    socket.emit('create-session');
    
    socket.on('session-created', ({ pin }) => {
      activePin = pin;
      
      const digitSpanElements = pairingPinContainer.querySelectorAll('.digit-box');
      for (let i = 0; i < 4; i++) {
        digitSpanElements[i].innerText = pin[i] || '-';
      }
      
      qrcodeContainer.innerHTML = '';
      const qrImg = document.createElement('img');
      
      // Detect if we are in public Website Mode or local offline LAN Mode
      const isLocalMode = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.hostname.startsWith('192.168.') || 
                           window.location.hostname.startsWith('10.') || 
                           window.location.hostname.startsWith('172.');
      
      const localIp = window.localServerIp || 'localhost';
      const port = window.location.port ? `:${window.location.port}` : '';
      
      // Public Mode: use browser's current origin (supports Railway custom domains)
      // Local Mode: use discovered LAN IP for offline network compatibility
      const baseOrigin = (!isLocalMode)
        ? window.location.origin
        : (localIp !== 'localhost' ? `http://${localIp}${port}` : window.location.origin);
        
      const pairingUrl = `${baseOrigin}/?pin=${pin}`;
      
      const qrColor = '3b82f6'; // Shadcn Blue theme (royal blue color)
      const qrBgColor = '09090b'; // Matching pure black bg
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(pairingUrl)}&color=${qrColor}&bgcolor=${qrBgColor}&margin=8`;
      qrImg.alt = 'QR Code';
      qrImg.style.width = '100%';
      qrImg.style.height = '100%';
      qrcodeContainer.appendChild(qrImg);
      
      sendSelectState.classList.add('hidden');
      sendPairingState.classList.remove('hidden');
      
      showToast('Room Created', 'Pairing pin generated. Waiting for peer...', 'success');
      
      // Dynamic Copied indicator
      copyPinBtn.onclick = () => {
        navigator.clipboard.writeText(pin);
        copyPinBtn.innerHTML = '<i class="fa-solid fa-circle-check text-teal"></i> Copied!';
        setTimeout(() => {
          copyPinBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Pin';
        }, 2000);
      };
      
      cancelSendSessionBtn.onclick = () => {
        resetAllPanels();
      };
    });
    
    socket.on('session-joined', ({ receiverSocketId }) => {
      showToast('Handshaking Successful', 'Opening persistent bidirectional sharing link...', 'success');
      setupWebRTCConnection(receiverSocketId);
    });

    socket.on('signal', ({ data }) => {
      handleIncomingRTCSignal(data);
    });

    // Sockets backup proposal fallback channel
    socket.on('transfer-proposal-fallback', ({ files }) => {
      handleIncomingFallbackProposal(files);
    });

    socket.on('fallback-links', ({ files }) => {
      engageHTTPReceiverFallback(files);
    });

    socket.on('transfer-status', ({ status }) => {
      if (status === 'cancelled') {
        if (activeXhr) {
          try { activeXhr.abort(); } catch (e) {}
        }
        handleTransferFailure('Peer cancelled the transfer.');
        return;
      }
      if (fallbackActive) {
        if (status === 'accepted') {
          streamFallbackTransmission();
        } else if (status === 'rejected') {
          showToast('Declined', 'Receiver declined the fallback transfer.', 'error');
          completeTransferSession(false);
        }
      }
    });
  }

  // 2. RECEIVER: Joining Room
  function initiateReceiverJoin() {
    let pin = '';
    pinInputs.forEach(input => pin += input.value);
    
    if (pin.length < 4) {
      pinErrorText.innerText = 'Input the full 4-digit pin code.';
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
      
      showToast('Handshaking Successful', 'Opening persistent bidirectional sharing link...', 'success');
      setupWebRTCConnection(senderSocketId);
    });
    
    socket.on('session-error', ({ message }) => {
      pinErrorText.innerText = message;
      pinErrorText.classList.remove('hidden');
      showToast('Pairing Failed', message, 'error');
    });

    socket.on('signal', ({ data }) => {
      handleIncomingRTCSignal(data);
    });

    socket.on('transfer-proposal-fallback', ({ files }) => {
      handleIncomingFallbackProposal(files);
    });

    socket.on('fallback-links', ({ files }) => {
      engageHTTPReceiverFallback(files);
    });

    socket.on('transfer-status', ({ status }) => {
      if (status === 'cancelled') {
        if (activeXhr) {
          try { activeXhr.abort(); } catch (e) {}
        }
        handleTransferFailure('Peer cancelled the transfer.');
        return;
      }
      if (fallbackActive) {
        if (status === 'accepted') {
          streamFallbackTransmission();
        } else if (status === 'rejected') {
          showToast('Declined', 'Receiver declined the fallback transfer.', 'error');
          completeTransferSession(false);
        }
      }
    });
  }

  function handleIncomingFallbackProposal(files) {
    const autoAccept = document.getElementById('auto-accept-toggle').checked;
    if (autoAccept) {
      // Auto-approve fallback transfer
      socket.emit('transfer-status', { pin: activePin, status: 'accepted' });
    } else {
      handleIncomingProposal(files, true);
    }
  }

  /* ==========================================================================
     WEBRTC P2P ROOM LINK ESTABLISHMENT
     ========================================================================== */
  
  function setupWebRTCConnection(peerSocketId) {
    peerConnection = new RTCPeerConnection(STUN_CONFIG);
    isChannelOpen = false;
    fallbackActive = false;
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { pin: activePin, data: { candidate: event.candidate } });
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection State: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed') {
        engageRoomFallbackMode();
      }
    };

    if (isSender) {
      dataChannel = peerConnection.createDataChannel('file-sharing', { ordered: true });
      bindDataChannelEvents();
      
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
          socket.emit('signal', { pin: activePin, data: { sdp: peerConnection.localDescription } });
        })
        .catch(err => {
          console.error('[WebRTC] Signaling Offer generation error:', err);
          engageRoomFallbackMode();
        });
        
      clearTimeout(signalTimeout);
      signalTimeout = setTimeout(() => {
        if (!isChannelOpen && !fallbackActive) {
          console.log('[WebRTC] Connection Timeout. Routing HTTP Backup Room.');
          engageRoomFallbackMode();
        }
      }, 7500);
    } else {
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
              .catch(err => console.error('[WebRTC] Answer Generation error:', err));
          }
        })
        .catch(err => console.error('[WebRTC] Remote SDP set failed:', err));
    } else if (data.candidate) {
      peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
        .catch(err => console.error('[WebRTC] Candidate registration failed:', err));
    }
  }

  function bindDataChannelEvents() {
    if (!dataChannel) return;
    dataChannel.binaryType = 'arraybuffer';
    
    dataChannel.onopen = () => {
      console.log('[WebRTC] Connected Room Channel Securely Activated!');
      isChannelOpen = true;
      clearTimeout(signalTimeout);
      
      // Pivot both users into the persistent room panel
      transitionToRoomHub();
    };
    
    dataChannel.onclose = () => {
      console.log('[WebRTC] Room channel closed.');
      isChannelOpen = false;
      if (transferInProgress) {
        handleTransferFailure('Tunnel connection terminated.');
      }
    };
    
    dataChannel.onerror = (err) => {
      console.error('[WebRTC] Channel Error:', err);
      engageRoomFallbackMode();
    };
    
    dataChannel.onmessage = handleIncomingDataChannelMessage;
  }

  function engageRoomFallbackMode() {
    if (fallbackActive) return;
    fallbackActive = true;
    clearTimeout(signalTimeout);
    
    showToast('Direct Link Unavailable', 'Network restrictions active. Routing secure HTTP server hub.', 'info');
    transitionToRoomHub();
  }

  function transitionToRoomHub() {
    inRoomMode = true;
    
    // Hide startup panes & sliders
    document.getElementById('tab-switcher').classList.add('hidden');
    panes.forEach(p => p.classList.remove('active'));
    
    // Show room hub
    paneRoomHub.classList.add('active');
    roomPinDisplay.innerText = activePin;
    
    // Preserve staged files from setup, if any, otherwise stage clean
    renderStagedFilesRoom();
  }

  /* ==========================================================================
     ACTIVE ROOM TRANSFER PROPOSALS & MODALS (BIDIRECTIONAL WORKFLOW)
     ========================================================================== */
  
  // SENDER (Peer A): Stage and Send Files
  function proposeActiveRoomTransfer() {
    if (stagedFiles.length === 0) return;
    if (transferInProgress) {
      showToast('Transfer Active', 'Wait for the current transfer to complete.', 'error');
      return;
    }
    
    activeFilesMetadata = stagedFiles.map(item => ({
      name: item.file.name,
      size: item.file.size,
      path: item.relativePath
    }));
    
    if (isChannelOpen) {
      // 1. P2P Direct: Propose files payload directly over DataChannel
      dataChannel.send(JSON.stringify({
        type: 'propose-transfer',
        files: activeFilesMetadata
      }));
      showToast('Proposal Transmitted', 'Waiting for peer approval...', 'info');
    } else {
      // 2. HTTP Fallback: Broadcast fallback transfer meta to peer via socket
      socket.emit('transfer-status', { pin: activePin, status: 'propose-fallback' });
      socket.emit('signal', {
        pin: activePin,
        data: { fallbackProposal: true, files: activeFilesMetadata }
      });
      showToast('Upload Commenced', 'Packaging files for Cloud Fallback delivery...', 'info');
      uploadStagedFilesForFallback();
    }
  }

  // Helper to trigger fallback upload
  function uploadStagedFilesForFallback() {
    transferInProgress = true;
    
    // Pop up Transfer HUD as uploading fallbacks
    prepareTransferHUD(true);
    hudActionLabel.innerText = 'Uploading';
    
    const formData = new FormData();
    stagedFiles.forEach(item => {
      formData.append('files', item.file, item.relativePath);
    });
    
    activeXhr = new XMLHttpRequest();
    activeXhr.open('POST', '/api/upload', true);
    
    activeXhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        updateHUDProgress(percent);
        totalBytesTransferred = event.loaded;
        bytesTransferredLastSecond = event.loaded - (totalBytesTransferred - bytesTransferredLastSecond);
        hudStatDelivered.innerText = `${formatBytes(event.loaded)} / ${formatBytes(event.total)}`;
      }
    };
    
    activeXhr.onload = () => {
      if (activeXhr.status === 200) {
        const res = JSON.parse(activeXhr.responseText);
        activeFilesMetadata = res.files; // Replace with server download links metadata
        
        // Notify the receiver that files are ready on server
        socket.emit('signal', {
          pin: activePin,
          data: { fallbackProposalReady: true, files: res.files }
        });
      } else {
        handleTransferFailure('Secure cloud pipeline upload failed.');
      }
    };
    
    activeXhr.onerror = () => {
      handleTransferFailure('Server pipeline interrupted.');
    };
    
    activeXhr.send(formData);
    
    totalTransferSize = stagedFiles.reduce((acc, f) => acc + f.file.size, 0);
    transferStartTime = Date.now();
    bytesTransferredLastSecond = 0;
    startSpeedInterval();
    
    cancelTransferBtn.onclick = () => {
      activeXhr.abort();
      socket.emit('transfer-status', { pin: activePin, status: 'cancelled' });
      handleTransferFailure('Upload cancelled.');
    };
  }

  // Handle incoming proposal modal overlays (Universal Receiver - Peer B)
  function handleIncomingProposal(files, isFallback = false) {
    if (transferInProgress) return; // Ignore overlapping
    
    activeFilesMetadata = files;
    
    // Fill in proposal modal parameters
    propCount.innerText = files.length;
    let totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    propSize.innerText = formatBytes(totalBytes);
    
    propFilesList.innerHTML = '';
    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'staged-file-card';
      const iconClass = getFileIconClass(file.name);
      card.innerHTML = `
        <div class="file-icon-box">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="file-details">
          <div class="file-name-txt" title="${file.path || file.name}">${file.path || file.name}</div>
          <div class="file-size-txt">${formatBytes(file.size)}</div>
        </div>
      `;
      propFilesList.appendChild(card);
    });
    
    // Show modal & backdrop
    proposalBackdrop.classList.add('active');
    proposalModal.classList.remove('hidden');
    
    propAcceptBtn.onclick = () => {
      proposalModal.classList.add('hidden');
      proposalBackdrop.classList.remove('active');
      
      if (isFallback) {
        socket.emit('transfer-status', { pin: activePin, status: 'accepted' });
      } else {
        dataChannel.send(JSON.stringify({ type: 'approve-transfer', status: 'accepted' }));
        prepareTransferHUD(false, totalBytes);
      }
    };
    
    propRejectBtn.onclick = () => {
      proposalModal.classList.add('hidden');
      proposalBackdrop.classList.remove('active');
      
      if (isFallback) {
        socket.emit('transfer-status', { pin: activePin, status: 'rejected' });
      } else {
        dataChannel.send(JSON.stringify({ type: 'approve-transfer', status: 'rejected' }));
      }
    };
  }

  /* ==========================================================================
     INCOMING DATA HANDLERS & WebRTC DATASTREAM CHANNEL
     ========================================================================== */
  
  function handleIncomingDataChannelMessage(event) {
    if (typeof event.data === 'string') {
      const msg = JSON.parse(event.data);
      
      // 1. Receive incoming transfer proposals
      if (msg.type === 'propose-transfer') {
        const autoAccept = document.getElementById('auto-accept-toggle').checked;
        if (autoAccept) {
          // Bypasses confirmation modal and approves immediately!
          dataChannel.send(JSON.stringify({ type: 'approve-transfer', status: 'accepted' }));
          
          let totalBytes = msg.files.reduce((acc, f) => acc + f.size, 0);
          activeFilesMetadata = msg.files;
          prepareTransferHUD(false, totalBytes);
        } else {
          handleIncomingProposal(msg.files, false);
        }
      }
      
      // 2. Receive incoming transfer decisions (Sender side)
      else if (msg.type === 'approve-transfer') {
        if (msg.status === 'accepted') {
          startWebRTCTransmission();
        } else if (msg.status === 'rejected') {
          showToast('Declined', 'Peer declined the files payload.', 'error');
          stagedFiles = [];
          renderStagedFilesRoom();
        }
      }
      
      // 3. Receive streams logic
      else if (msg.type === 'file-start') {
        currentFileIndex = msg.index;
        receivedChunks = [];
        
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
        const fileMeta = activeFilesMetadata[currentFileIndex];
        const blob = new Blob(receivedChunks, { type: 'application/octet-stream' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileMeta.name;
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }, 150);
        
        recordHistoryItem(fileMeta.name, fileMeta.size, 'P2P Direct', 'success');
      } else if (msg.type === 'transfer-cancelled') {
        handleTransferFailure('Peer cancelled the transfer.');
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
     TRANSMISSION ENGINE HUD & SPEED METRICS
     ========================================================================== */
  
  function prepareTransferHUD(isFallback = false, totalBytes = 0) {
    transferInProgress = true;
    proposalModal.classList.add('hidden');
    proposalBackdrop.classList.remove('active');
    
    // Toggle active underlay backdrop
    if (hudBackdrop) hudBackdrop.classList.add('active');
    transferHud.classList.remove('hidden');
    
    hudActivePeer.innerText = `Device Link (${activePin})`;
    if (isFallback) {
      hudMethodBadge.className = 'hud-transfer-badge fallback-badge';
      hudMethodBadge.innerHTML = '<i class="fa-solid fa-cloud mr-xs"></i> CLOUD RELAY';
    } else {
      hudMethodBadge.className = 'hud-transfer-badge';
      hudMethodBadge.innerHTML = '<i class="fa-solid fa-bolt mr-xs"></i> P2P DIRECT';
    }
    
    updateHUDProgress(0);
    
    if (!isSender) {
      // Receiver statistics prepare
      totalTransferSize = totalBytes;
      totalBytesTransferred = 0;
      transferStartTime = Date.now();
      bytesTransferredLastSecond = 0;
      startSpeedInterval();
    }
    
    cancelTransferBtn.onclick = () => {
      if (isChannelOpen) {
        try {
          dataChannel.send(JSON.stringify({ type: 'transfer-cancelled' }));
        } catch (e) {}
      }
      socket.emit('transfer-status', { pin: activePin, status: 'cancelled' });
      cleanupWebRTC();
      handleTransferFailure('Transfer aborted.');
    };
  }

  function updateHUDProgress(percent) {
    percent = Math.min(100, Math.max(0, percent));
    const circumference = 376.99; // 2 * PI * r = 2 * 3.14159 * 60 = 376.99
    const offset = circumference - (percent / 100) * circumference;
    hudCircleFill.style.strokeDashoffset = offset;
    hudPercentageTxt.innerText = `${Math.round(percent)}%`;
    hudLinearFill.style.width = `${percent}%`;
  }

  function startSpeedInterval() {
    clearInterval(speedInterval);
    speedInterval = setInterval(() => {
      const speed = bytesTransferredLastSecond;
      bytesTransferredLastSecond = 0;
      hudStatSpeed.innerText = `${formatBytes(speed)}/s`;
      
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
      hudStatDelivered.innerText = `${formatBytes(totalBytesTransferred)} / ${formatBytes(totalTransferSize)}`;
    }, 1000);
  }

  function startWebRTCTransmission() {
    transferInProgress = true;
    currentFileIndex = 0;
    totalTransferSize = stagedFiles.reduce((acc, f) => acc + f.file.size, 0);
    totalBytesTransferred = 0;
    transferStartTime = Date.now();
    bytesTransferredLastSecond = 0;
    
    prepareTransferHUD(false, totalTransferSize);
    hudActionLabel.innerText = 'Streaming';
    startSpeedInterval();
    
    streamNextFile();
  }

  function streamNextFile() {
    if (currentFileIndex >= stagedFiles.length) {
      dataChannel.send(JSON.stringify({ type: 'transfer-complete' }));
      completeTransferSession(true);
      return;
    }
    
    const item = stagedFiles[currentFileIndex];
    const file = item.file;
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
    
    dataChannel.send(JSON.stringify({
      type: 'file-start',
      index: currentFileIndex,
      name: file.name,
      size: file.size,
      path: item.relativePath
    }));
    
    const CHUNK_SIZE = 64 * 1024;
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
      
      const textSpan = hudActiveFileItem.querySelector('.file-size-txt span');
      if (textSpan) {
        textSpan.innerText = `${formatBytes(offset)} / ${formatBytes(file.size)}`;
      }
      
      const totalPercent = (totalBytesTransferred / totalTransferSize) * 100;
      updateHUDProgress(totalPercent);
      
      if (offset < file.size) {
        if (dataChannel.bufferedAmount > 1048576) {
          dataChannel.bufferedAmountLowThreshold = 262144;
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = null;
            readSlice();
          };
        } else {
          readSlice();
        }
      } else {
        dataChannel.send(JSON.stringify({ type: 'file-end', index: currentFileIndex }));
        currentFileIndex++;
        setTimeout(streamNextFile, 150);
      }
    };
    
    readSlice();
  }

  /* ==========================================================================
     HTTP UPLOAD/DOWNLOAD FALLBACK SEQUENCE
     ========================================================================== */
  
  function streamFallbackTransmission() {
    completeTransferSession(true);
  }

  function engageHTTPReceiverFallback(files) {
    fallbackActive = true;
    
    totalTransferSize = files.reduce((acc, f) => acc + f.size, 0);
    prepareTransferHUD(true, totalTransferSize);
    hudActionLabel.innerText = 'Downloading';
    
    let completedDownloads = 0;
    
    function downloadNextFallback(index) {
      if (!transferInProgress) return;
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
          <div class="file-size-txt">Fetching: <span class="text-teal">Streaming...</span></div>
        </div>
      `;
      
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        completedDownloads++;
        
        const percent = (completedDownloads / files.length) * 100;
        updateHUDProgress(percent);
        
        totalBytesTransferred = (completedDownloads / files.length) * totalTransferSize;
        hudStatDelivered.innerText = `${formatBytes(totalBytesTransferred)} / ${formatBytes(totalTransferSize)}`;
        
        recordHistoryItem(file.name, file.size, 'Cloud Fallback', 'success');
        
        setTimeout(() => downloadNextFallback(index + 1), 600);
      }, 500);
    }
    
    downloadNextFallback(0);
  }

  /* ==========================================================================
     CLEANUP & SESSION RESET (PERSISTENT FOCUS)
     ========================================================================== */
  
  function completeTransferSession(success = true) {
    if (!transferInProgress) return;
    transferInProgress = false;
    clearInterval(speedInterval);
    
    if (success) {
      showToast('Transfer Complete', 'All files processed successfully!', 'success');
      
      if (isSender) {
        stagedFiles.forEach(item => {
          recordHistoryItem(item.file.name, item.file.size, fallbackActive ? 'Cloud Fallback' : 'P2P Direct', 'success');
        });
      }
      
      stagedFiles = [];
      renderStagedFilesRoom();
      renderHistory();
      
      // Fade out transfer HUD gracefully
      setTimeout(() => {
        transferHud.classList.add('hidden');
        if (hudBackdrop) hudBackdrop.classList.remove('active');
      }, 2000);
    }
  }

  function handleTransferFailure(reason) {
    if (!transferInProgress) return;
    transferInProgress = false;
    clearInterval(speedInterval);
    showToast('Transfer Failed', reason, 'error');
    
    cleanupWebRTC();
    
    if (isSender) {
      stagedFiles.forEach(item => {
        recordHistoryItem(item.file.name, item.file.size, fallbackActive ? 'Cloud Fallback' : 'P2P Direct', 'failed');
      });
    }
    
    stagedFiles = [];
    renderStagedFilesRoom();
    renderHistory();
    
    setTimeout(() => {
      transferHud.classList.add('hidden');
      if (hudBackdrop) hudBackdrop.classList.remove('active');
    }, 2500);
  }

  /* ==========================================================================
     INTEGRATED QR CODE SCANNER CONTROLLER
     ========================================================================== */
  
  function startQRScanner() {
    qrScannerBackdrop.classList.add('active');
    qrScannerModal.classList.remove('hidden');
    
    // Initialize html5QrCode scanner instance
    try {
      html5QrCode = new Html5Qrcode("qr-reader");
      const config = { fps: 10, qrbox: { width: 220, height: 220 } };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          console.log(`[QR Scanner] Decoded value: ${decodedText}`);
          let pin = "";
          try {
            const url = new URL(decodedText);
            pin = url.searchParams.get("pin");
          } catch (e) {
            if (/^\d{4}$/.test(decodedText.trim())) {
              pin = decodedText.trim();
            }
          }

          if (pin && pin.length === 4) {
            showToast("QR Code Scanned", `Pairing code ${pin} successfully detected!`, "success");
            
            for (let i = 0; i < 4; i++) {
              const field = document.getElementById(`p-${i+1}`);
              if (field) field.value = pin[i];
            }
            
            closeQRScanner();
            initiateReceiverJoin();
          } else {
            showToast("Scanning Alert", "Invalid QR code format. Please scan a valid SW-HERE QR code.", "warning");
          }
        },
        (errorMessage) => {
          // Silent scan feedback loop warnings
        }
      ).catch(err => {
        console.error("[QR Scanner] Camera start failure:", err);
        showToast("Camera Access Error", "Unable to start camera. Please verify permissions.", "error");
        closeQRScanner();
      });
    } catch (e) {
      console.error("[QR Scanner] Initialization error:", e);
      showToast("Scanner Error", "Failed to initialize scanner. Please try again.", "error");
      closeQRScanner();
    }
  }

  function closeQRScanner() {
    if (html5QrCode) {
      try {
        html5QrCode.stop().then(() => {
          html5QrCode = null;
          qrScannerModal.classList.add('hidden');
          qrScannerBackdrop.classList.remove('active');
        }).catch(err => {
          console.error("[QR Scanner] Error stopping scanner:", err);
          html5QrCode = null;
          qrScannerModal.classList.add('hidden');
          qrScannerBackdrop.classList.remove('active');
        });
      } catch (e) {
        html5QrCode = null;
        qrScannerModal.classList.add('hidden');
        qrScannerBackdrop.classList.remove('active');
      }
    } else {
      qrScannerModal.classList.add('hidden');
      qrScannerBackdrop.classList.remove('active');
    }
  }

  function cleanupWebRTC() {
    isChannelOpen = false;
    if (dataChannel) {
      try { dataChannel.close(); } catch (e) {}
      dataChannel = null;
    }
    if (peerConnection) {
      try { peerConnection.close(); } catch (e) {}
      peerConnection = null;
    }
  }

  function cleanupAllConnections() {
    clearTimeout(signalTimeout);
    clearInterval(speedInterval);
    transferInProgress = false;
    
    cleanupWebRTC();
    
    if (socket) {
      try { socket.disconnect(); } catch (e) {}
      socket = null;
    }
    
    fallbackActive = false;
  }

  /* ==========================================================================
     HISTORY DRAWER & LOG REGISTRATION
     ========================================================================== */
  
  function setupHistoryDrawer() {
    if (!toggleHistoryBtn) return;
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
      showToast('Cleared', 'History wiped successfully.', 'info');
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
    if (transferHistory.length > 40) transferHistory.pop();
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

  document.addEventListener('DOMContentLoaded', init);
})();
