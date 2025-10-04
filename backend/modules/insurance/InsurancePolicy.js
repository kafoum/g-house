const mongoose = require('mongoose');

const InsurancePolicySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  housing: { type: mongoose.Schema.Types.ObjectId, ref: 'Housing', required: true, index: true },
  provider: { type: String, required: true },
  coverageType: { type: String, enum: ['basic','premium','complete'], default: 'basic' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  priceMonthly: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'EUR' },
  status: { type: String, enum: ['active','pending','canceled','expired'], default: 'pending', index: true },
  createdAt: { type: Date, default: Date.now },
  canceledAt: { type: Date },
  meta: { type: Object }
});

InsurancePolicySchema.index({ housing: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('InsurancePolicy', InsurancePolicySchema);
