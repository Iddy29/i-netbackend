/**
 * Seed script to create the default admin user and initial categories.
 * Run: node src/scripts/seedAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');

const ADMIN_EMAIL = 'admin@i-net.com';
const ADMIN_PASSWORD = 'admin123456';

const defaultCategories = [
  { name: 'Streaming', icon: 'play-circle-outline', color: '#E50914', sortOrder: 1 },
  { name: 'AI', icon: 'brain', color: '#10A37F', sortOrder: 2 },
  { name: 'Trading', icon: 'chart-line', color: '#2962FF', sortOrder: 3 },
  { name: 'Internet', icon: 'wifi', color: '#8B5CF6', sortOrder: 4 },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create admin user
    let admin = await User.findOne({ email: ADMIN_EMAIL });
    if (!admin) {
      admin = await User.create({
        fullName: 'Admin',
        email: ADMIN_EMAIL,
        phone: '+255000000000',
        password: ADMIN_PASSWORD,
        isVerified: true,
        role: 'admin',
      });
      console.log(`Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    } else {
      admin.role = 'admin';
      admin.isVerified = true;
      await admin.save();
      console.log('Admin user already exists, role ensured.');
    }

    // Seed default categories
    for (const cat of defaultCategories) {
      const existing = await Category.findOne({ name: cat.name });
      if (!existing) {
        await Category.create(cat);
        console.log(`Category created: ${cat.name}`);
      } else {
        console.log(`Category already exists: ${cat.name}`);
      }
    }

    console.log('\nSeed complete!');
    console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
