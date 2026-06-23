// Transaction Model
// Track payments, subscription actions, and status updates

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userPhoneHash: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  razorpayPaymentId: {
    type: String,
    trim: true,
  },
  razorpayPaymentLinkId: {
    type: String,
    trim: true,
  },
  plan: {
    type: String,
    enum: ['basic', 'premium'],
    required: true,
  },
  amount: {
    type: Number,
    required: true, // in paise or base unit
  },
  currency: {
    type: String,
    default: 'INR',
  },
  status: {
    type: String,
    enum: ['pending', 'captured', 'failed', 'refunded'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes for admin reporting and history search
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
transactionSchema.index({ razorpayPaymentLinkId: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
