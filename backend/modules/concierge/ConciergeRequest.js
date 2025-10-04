const mongoose = require('mongoose');

const conciergeRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  budgetMonthly: { type: Number, required: true, min: 0 },
  depositBudget: { type: Number, required: true, min: 0 },
  desiredTypes: { type: [String], default: [] },
  zonePoint: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], validate: v => Array.isArray(v) && v.length === 2 }
  },
  zoneRadiusKm: { type: Number, default: 3, min: 0.1 },
  upfrontDeposit: { type: Number, min: 0 },
  status: { type: String, enum: ['open','in_progress','matched','closed'], default: 'open', index: true },
  docsSnapshot: {
    identity_card: { type: Boolean, default: false },
    visale_guarantee: { type: Boolean, default: false },
    proof_of_income: { type: Boolean, default: false },
    proof_of_address: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

conciergeRequestSchema.index({ zonePoint: '2dsphere' });

module.exports = mongoose.model('ConciergeRequest', conciergeRequestSchema);
