const mongoose = require('mongoose');

const marketplaceItemSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reservedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, enum: ['meuble','electromenager','divers'], required: true },
  condition: { type: String, enum: ['new','good','used'], default: 'used' },
  priceUser: { type: Number, required: true }, // prix payé au propriétaire (<= 10)
  platformFee: { type: Number, required: true }, // commission fixe (5€)
  totalPrice: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  images: { type: [String], default: [] },
  status: { type: String, enum: ['active','reserved','given','cancelled','archived'], default: 'active', index: true },
  archivedAt: { type: Date },
}, { timestamps: true });

marketplaceItemSchema.index({ status: 1, createdAt: -1 });
marketplaceItemSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('MarketplaceItem', marketplaceItemSchema);
