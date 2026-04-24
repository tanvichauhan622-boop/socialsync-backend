const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { type: String }, // Supabase UUID
  name: { type: String, required: true, trim: true },
  age: { type: Number, default: null },
  gender: { type: String, default: '' },
  interests: [{ type: String }],
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  socketId: { type: String, default: null },
  bio: { type: String, default: '', maxlength: 200 }
}, { timestamps: true, _id: false });

userSchema.index({ location: '2dsphere' });

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
