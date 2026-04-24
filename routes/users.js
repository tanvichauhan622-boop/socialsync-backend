const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Auto-create or update MongoDB profile from Supabase user
async function upsertUser(reqUser) {
  return User.findOneAndUpdate(
    { _id: reqUser._id },
    {
      $setOnInsert: { _id: reqUser._id },
      $set: {
        name: reqUser.name,
        age: reqUser.age,
        gender: reqUser.gender,
        interests: reqUser.interests
      }
    },
    { upsert: true, new: true }
  );
}

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await upsertUser(req.user);
    res.json(user.toPublicJSON());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/nearby
router.get('/nearby', auth, async (req, res) => {
  try {
    await upsertUser(req.user);
    const { lat, lng, radius = 5000 } = req.query;

    if (!lat || !lng) {
      const users = await User.find({ _id: { $ne: req.user._id } }).limit(20);
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
    }).limit(20);

    const withDistance = users.map(u => {
      const [uLng, uLat] = u.location.coordinates;
      const R = 6371;
      const dLat = (uLat - parseFloat(lat)) * Math.PI / 180;
      const dLon = (uLng - parseFloat(lng)) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(parseFloat(lat)*Math.PI/180) * Math.cos(uLat*Math.PI/180) * Math.sin(dLon/2)**2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
    await User.findOneAndUpdate(
      { _id: req.user._id },
      { location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/me
router.put('/me', auth, async (req, res) => {
  try {
    const { interests, bio } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.user._id },
      { interests, bio },
      { new: true, upsert: true }
    );
    res.json(user.toPublicJSON());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
