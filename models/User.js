const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true, min: 13, max: 100 },
  gender: { type: String, required: true, enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'] },
  interests: [{ type: String }],
  password: { type: String, required: true, minlength: 6 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
  },
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  socketId: { type: String, default: null },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 200 }
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    age: this.age,
    gender: this.gender,
    interests: this.interests,
    online: this.online,
    lastSeen: this.lastSeen,
    location: this.location,
    bio: this.bio
  };
};

module.exports = mongoose.model('User', userSchema);
