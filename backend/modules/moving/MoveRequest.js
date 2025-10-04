const mongoose = require('mongoose');

const MoveRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  housingFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Housing' },
  housingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Housing' },
  fromAddress: { type: String },
  toAddress: { type: String },
  volumeM3: { type: Number, min: 0 },
  desiredDate: { type: Date, required: true },
  scheduledDate: { type: Date },
  status: { type: String, enum: ['requested','scheduled','in_progress','completed','canceled'], default: 'requested', index: true },
  priceEstimate: { type: Number },
  currency: { type: String, default: 'EUR' },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

MoveRequestSchema.index({ user: 1, desiredDate: -1 });

module.exports = mongoose.model('MoveRequest', MoveRequestSchema);
