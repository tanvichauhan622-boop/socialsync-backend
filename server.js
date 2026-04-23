require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

const User = require('./models/User');
const Message = require('./models/Message');
const { getRoomId } = require('./routes/messages');

const app = express();
const server = http.createServer(app);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: true }
});

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
// API only — frontend served from Netlify

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/messages', require('./routes/messages'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Health check only — no HTML serving
app.get('/', (req, res) => res.json({ status: 'SocialSync API running' }));

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return next(new Error('User not found'));
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Auth failed'));
  }
});

io.on('connection', async (socket) => {
  const user = socket.user;
  console.log(`✅ ${user.name} connected (${socket.id})`);

  // Mark online
  await User.findByIdAndUpdate(user._id, { online: true, socketId: socket.id });

  // Broadcast to all that this user is online
  socket.broadcast.emit('user:online', { userId: user._id, name: user.name });

  // ── Location update ──────────────────────────────────────────────────────
  socket.on('location:update', async ({ lat, lng }) => {
    try {
      await User.findByIdAndUpdate(user._id, {
        location: { type: 'Point', coordinates: [lng, lat] }
      });
      // Broadcast updated position to nearby users (simple: broadcast to all)
      socket.broadcast.emit('location:updated', {
        userId: user._id,
        name: user.name,
        lat, lng
      });
    } catch (err) {
      console.error('Location update error:', err);
    }
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  socket.on('chat:send', async ({ toUserId, text }) => {
    if (!text || !text.trim()) return;
    try {
      const roomId = getRoomId(user._id.toString(), toUserId);
      const message = await Message.create({
        sender: user._id,
        receiver: toUserId,
        text: text.trim(),
        roomId
      });
      await message.populate('sender', 'name');

      const payload = {
        _id: message._id,
        text: message.text,
        sender: { _id: user._id, name: user.name },
        createdAt: message.createdAt,
        roomId
      };

      // Send to sender (confirmation)
      socket.emit('chat:message', payload);

      // Send to receiver if online
      const receiver = await User.findById(toUserId);
      if (receiver?.socketId) {
        io.to(receiver.socketId).emit('chat:message', payload);
        io.to(receiver.socketId).emit('chat:notification', {
          from: user.name,
          text: text.trim(),
          userId: user._id
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
    }
  });

  // ── Join plan room ────────────────────────────────────────────────────────
  socket.on('plan:join_room', (planId) => {
    socket.join(`plan_${planId}`);
  });

  socket.on('plan:created', (plan) => {
    socket.broadcast.emit('plan:new', plan);
  });

  socket.on('plan:joined', ({ planId, userName }) => {
    io.emit('plan:attendee_joined', { planId, userName });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log(`❌ ${user.name} disconnected`);
    await User.findByIdAndUpdate(user._id, {
      online: false,
      lastSeen: new Date(),
      socketId: null
    });
    socket.broadcast.emit('user:offline', { userId: user._id });
  });
});

// ─── Connect to MongoDB + Start Server ───────────────────────────────────────
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 SocialSync server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
