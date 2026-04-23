const express = require('express');
const Plan = require('../models/Plan');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/plans
router.get('/', auth, async (req, res) => {
  try {
    const plans = await Plan.find({ time: { $gte: new Date() } })
      .populate('creator', 'name age')
      .populate('attendees', 'name')
      .sort({ time: 1 })
      .limit(50);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plans
router.post('/', auth, async (req, res) => {
  try {
    const { title, category, location, time, description, maxAttendees } = req.body;
    if (!title || !location || !time) {
      return res.status(400).json({ error: 'Title, location, and time are required' });
    }
    const plan = await Plan.create({
      title, category, location,
      time: new Date(time),
      description: description || '',
      maxAttendees: maxAttendees || 20,
      creator: req.user._id,
      attendees: [req.user._id]
    });
    await plan.populate('creator', 'name age');
    res.status(201).json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plans/:id/join
router.post('/:id/join', auth, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.attendees.includes(req.user._id)) {
      return res.status(400).json({ error: 'Already joined' });
    }
    if (plan.attendees.length >= plan.maxAttendees) {
      return res.status(400).json({ error: 'Plan is full' });
    }
    plan.attendees.push(req.user._id);
    await plan.save();
    await plan.populate('creator', 'name age');
    await plan.populate('attendees', 'name');
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/plans/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await plan.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
