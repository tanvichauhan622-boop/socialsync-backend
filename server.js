require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

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

// Routes — auth handled by Supabase
app.use('/api/users', require('./routes/users'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/messages', require('./routes/messages'));

// Health check — always responds (Railway uses this)
let dbConnected = false;
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbConnected ? 'connected' : 'connecting', time: new Date() });
});

app.get('/', (req, res) => res.json({ status: 'SocialSync API running' }));

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));

    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub) return next(new Error('Invalid token'));

    // Upsert user in MongoDB using Supabase identity
    const User = require('./models/User');
    let user = await User.findOneAndUpdate(
      { _id: decoded.sub },
      {
        $setOnInsert: { _id: decoded.sub },
        $set: {
          name: decoded.user_metadata?.name || 'Anonymous',
          age: decoded.user_metadata?.age || null,
          interests: decoded.user_metadata?.interests || []
        }
      },
      { upsert: true, new: true }
    );

    socket.user = user;
    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Auth failed'));
  }
});

io.on('connection', async (socket) => {
  const user = socket.user;
  console.log(`✅ ${user.name} connected (${socket.id})`);

  await User.findByIdAndUpdate(user._id, { online: true, socketId: socket.id });
  socket.broadcast.emit('user:online', { userId: user._id, name: user.name });

  socket.on('location:update', async ({ lat, lng }) => {
    try {
      await User.findByIdAndUpdate(user._id, {
        location: { type: 'Point', coordinates: [lng, lat] }
      });
      socket.broadcast.emit('location:updated', { userId: user._id, name: user.name, lat, lng });
    } catch (err) {
      console.error('Location update error:', err);
    }
  });

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

      socket.emit('chat:message', payload);

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

  socket.on('plan:join_room', (planId) => socket.join(`plan_${planId}`));

  socket.on('plan:created', (plan) => socket.broadcast.emit('plan:new', plan));

  socket.on('plan:joined', ({ planId, userName }) => {
    io.emit('plan:attendee_joined', { planId, userName });
  });

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

// ─── START SERVER FIRST, then connect MongoDB ────────────────────────────────
// Server starts immediately so Railway healthcheck passes.
// MongoDB connects in the background with auto-retry.
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SocialSync running on port ${PORT}`);
});

const connectMongo = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set! Add it in Railway → Variables tab.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    dbConnected = true;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB failed:', err.message);
    console.log('⏳ Retrying in 5s...');
    setTimeout(connectMongo, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  dbConnected = false;
  console.warn('⚠️ MongoDB disconnected, retrying...');
  setTimeout(connectMongo, 5000);
});

connectMongo();
