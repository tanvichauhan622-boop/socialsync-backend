const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  time: { type: Date, required: true },
  description: { type: String, default: '', maxlength: 500 },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  maxAttendees: { type: Number, default: 20 },
  coordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  }
}, { timestamps: true });

planSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Plan', planSchema);
