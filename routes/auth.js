const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('age').isInt({ min: 13, max: 100 }).withMessage('Age must be between 13 and 100'),
  body('gender').notEmpty().withMessage('Gender is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, age, gender, interests = [], password } = req.body;
    const existing = await User.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) return res.status(409).json({ error: 'Name already taken' });

    const user = await User.create({ name, age, gender, interests, password });
    const token = signToken(user._id);
    res.status(201).json({ token, user: user.toPublicJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('name').trim().notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, password } = req.body;
    const user = await User.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid name or password' });
    }
    const token = signToken(user._id);
    res.json({ token, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
