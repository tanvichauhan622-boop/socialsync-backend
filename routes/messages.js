const express = require('express');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const router = express.Router();

const getRoomId = (id1, id2) => [id1, id2].sort().join('_');

// GET /api/messages/:userId - get chat history
router.get('/:userId', auth, async (req, res) => {
  try {
    const roomId = getRoomId(req.user._id.toString(), req.params.userId);
    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('sender', 'name');
    // Mark as read
    await Message.updateMany(
      { roomId, receiver: req.user._id, read: false },
      { read: true }
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.getRoomId = getRoomId;
