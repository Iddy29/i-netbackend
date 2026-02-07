const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const serviceRoutes = require('./routes/services');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const videoRoutes = require('./routes/videos');
const adultVideoRoutes = require('./routes/adultVideos');
const subscriptionRoutes = require('./routes/subscriptions');
const streamProxyRoute = require('./routes/streamProxy');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (nginx, Cloudflare, etc.) for correct req.protocol
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/adult-videos', adultVideoRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stream-proxy', streamProxyRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'i-Net API is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
