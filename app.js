const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer storage configuration for fallback file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    // Keep file extension but prefix with UUID
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB upload limit for fallback
});

// In-memory registries
const sessions = new Map(); // pin -> { pin, senderSocketId, receiverSocketId, createdAt }
const uploadedFiles = new Map(); // fileId -> { fileId, originalName, mimeType, size, filename, filePath, uploadedAt }

// Dynamic routes
app.get('/', (req, res) => {
  res.render('index');
});

// Check if a session code is active
app.get('/api/session/:pin', (req, res) => {
  const pin = req.params.pin;
  const session = sessions.get(pin);
  if (session) {
    return res.json({ active: true, receiverConnected: !!session.receiverSocketId });
  }
  return res.json({ active: false });
});

// Upload endpoint for fallback HTTP transfers
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const responseFiles = req.files.map(file => {
      const fileId = file.filename.split('.')[0]; // UUID from filename
      const fileMetadata = {
        fileId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filename: file.filename,
        filePath: file.path,
        uploadedAt: Date.now()
      };

      uploadedFiles.set(fileId, fileMetadata);

      return {
        fileId,
        name: file.originalname,
        size: file.size,
        downloadUrl: `/api/download/${fileId}`
      };
    });

    res.json({ files: responseFiles });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process files.' });
  }
});

// Download endpoint for fallback HTTP transfers
app.get('/api/download/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const fileMeta = uploadedFiles.get(fileId);

  if (!fileMeta || !fs.existsSync(fileMeta.filePath)) {
    return res.status(404).send('File not found or expired.');
  }

  // Force download with the original file name
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileMeta.originalName)}"`);
  res.setHeader('Content-Type', fileMeta.mimeType);
  
  const fileStream = fs.createReadStream(fileMeta.filePath);
  fileStream.pipe(res);
});

// Periodic garbage collector: deletes files older than 10 minutes (600,000 ms)
const FILE_LIFETIME_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [fileId, fileMeta] of uploadedFiles.entries()) {
    if (now - fileMeta.uploadedAt > FILE_LIFETIME_MS) {
      try {
        if (fs.existsSync(fileMeta.filePath)) {
          fs.unlinkSync(fileMeta.filePath);
        }
        uploadedFiles.delete(fileId);
        console.log(`[GC] Deleted expired file: ${fileMeta.originalName} (${fileId})`);
      } catch (err) {
        console.error(`[GC] Error deleting file ${fileMeta.filePath}:`, err);
      }
    }
  }

  // Also prune extremely old unused sessions
  const SESSION_LIFETIME_MS = 60 * 60 * 1000; // 1 hour for session expiry
  for (const [pin, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_LIFETIME_MS) {
      sessions.delete(pin);
      console.log(`[GC] Expired stale pairing session: ${pin}`);
    }
  }
}, 60 * 1000); // Run scan every 1 minute

// Helper: generate random 4-digit numeric pairing code
function generatePin() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (sessions.has(pin));
  return pin;
}

// Socket.IO Orchestration
io.on('connection', (socket) => {
  console.log(`[Socket] Device connected: ${socket.id}`);

  // Create pairing session
  socket.on('create-session', () => {
    const pin = generatePin();
    sessions.set(pin, {
      pin,
      senderSocketId: socket.id,
      receiverSocketId: null,
      createdAt: Date.now()
    });
    
    socket.join(pin);
    socket.emit('session-created', { pin });
    console.log(`[Socket] Created session pin: ${pin} for sender: ${socket.id}`);
  });

  // Join pairing session
  socket.on('join-session', ({ pin }) => {
    const session = sessions.get(pin);
    
    if (!session) {
      socket.emit('session-error', { message: 'Pairing pin not found or expired.' });
      return;
    }

    if (session.receiverSocketId) {
      socket.emit('session-error', { message: 'This transfer session is already full.' });
      return;
    }

    // Set receiver ID and join room
    session.receiverSocketId = socket.id;
    socket.join(pin);
    
    // Notify both peers
    io.to(pin).emit('session-joined', {
      pin,
      senderSocketId: session.senderSocketId,
      receiverSocketId: socket.id
    });
    
    console.log(`[Socket] Receiver: ${socket.id} joined session pin: ${pin}`);
  });

  // Relay WebRTC SDP & ICE signals between peers
  socket.on('signal', ({ pin, data }) => {
    const session = sessions.get(pin);
    if (!session) return;

    // Send to other socket in the room
    const targetSocketId = socket.id === session.senderSocketId 
      ? session.receiverSocketId 
      : session.senderSocketId;

    if (targetSocketId) {
      io.to(targetSocketId).emit('signal', { data });
    }
  });

  // Transmit files metadata from sender to receiver
  socket.on('transfer-meta', ({ pin, files }) => {
    const session = sessions.get(pin);
    if (session && socket.id === session.senderSocketId && session.receiverSocketId) {
      io.to(session.receiverSocketId).emit('transfer-meta', { files });
    }
  });

  // Relay acceptance, rejection, or cancellation events
  socket.on('transfer-status', ({ pin, status }) => {
    const session = sessions.get(pin);
    if (!session) return;

    const targetSocketId = socket.id === session.senderSocketId 
      ? session.receiverSocketId 
      : session.senderSocketId;

    if (targetSocketId) {
      io.to(targetSocketId).emit('transfer-status', { status });
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Device disconnected: ${socket.id}`);
    
    // Clean up or reset sessions involving this socket
    for (const [pin, session] of sessions.entries()) {
      if (session.senderSocketId === socket.id) {
        // Notify receiver if connected
        if (session.receiverSocketId) {
          io.to(session.receiverSocketId).emit('peer-disconnected', { role: 'sender' });
        }
        sessions.delete(pin);
        console.log(`[Socket] Sender disconnected. Purged session pin: ${pin}`);
      } else if (session.receiverSocketId === socket.id) {
        // Reset receiver slot in session
        session.receiverSocketId = null;
        io.to(session.senderSocketId).emit('peer-disconnected', { role: 'receiver' });
        console.log(`[Socket] Receiver disconnected. Reset session pin: ${pin}`);
      }
    }
  });
});

// Launch Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SW-HERE File Sharing Platform running on Port ${PORT}`);
  console.log(`🔗 Local Address: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
