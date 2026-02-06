const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'TZS',
      enum: ['TZS', 'USD'],
    },
    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
    },
    features: {
      type: [String],
      default: [],
    },
    iconType: {
      type: String,
      default: 'internet',
      trim: true,
    },
    iconImage: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: '#06B6D4',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Populate category by default
serviceSchema.pre(/^find/, function (next) {
  this.populate('category', 'name icon color');
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
