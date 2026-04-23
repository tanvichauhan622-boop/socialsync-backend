const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/users/nearby?lat=&lng=&radius=5000
router.get('/nearby', auth, async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;

    if (!lat || !lng) {
      // Return all online users if no location given (demo mode)
      const users = await User.find({ _id: { $ne: req.user._id }, online: true }).limit(20).select('-password');
      return res.json(users.map(u => ({ ...u.toPublicJSON(), distance: null })));
    }

    const users = await User.find({
      _id: { $ne: req.user._id },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius)
        }
      }
    }).limit(20).select('-password');

    // Calculate distance in km
    const withDistance = users.map(u => {
      const [uLng, uLat] = u.location.coordinates;
      const R = 6371;
      const dLat = (uLat - parseFloat(lat)) * Math.PI / 180;
      const dLon = (uLng - parseFloat(lng)) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(parseFloat(lat) * Math.PI / 180) * Math.cos(uLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...u.toPublicJSON(), distance: Math.round(distance * 10) / 10 };
    });

    res.json(withDistance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/location
router.put('/location', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  res.json(req.user.toPublicJSON());
});

// PUT /api/users/me
router.put('/me', auth, async (req, res) => {
  try {
    const { interests, bio } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { interests, bio },
      { new: true }
    ).select('-password');
    res.json(updated.toPublicJSON());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
