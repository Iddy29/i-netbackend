const Service = require('../models/Service');
const Category = require('../models/Category');
const { uploadImage } = require('../utils/imageUpload');

// @desc    Get all services (public - active only)
// @route   GET /api/services
const getServices = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };

    if (category && category !== 'all') {
      const cat = await Category.findOne({ name: { $regex: new RegExp(`^${category}$`, 'i') }, isActive: true });
      if (cat) {
        filter.category = cat._id;
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const services = await Service.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all services (admin - including inactive)
// @route   GET /api/admin/services
const getAllServices = async (req, res) => {
  try {
    const services = await Service.find().sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single service
// @route   GET /api/services/:id
const getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.status(200).json({ success: true, data: service });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create service
// @route   POST /api/admin/services
const createService = async (req, res) => {
  try {
    const { name, category, description, price, currency, duration, features, iconType, iconImage, color, sortOrder } = req.body;

    if (!name || !category || !description || price === undefined || !duration) {
      return res.status(400).json({ success: false, message: 'Name, category, description, price, and duration are required' });
    }

    // Verify category exists
    const cat = await Category.findById(category);
    if (!cat) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }

    const service = await Service.create({
      name, category, description, price, currency, duration, features,
      iconType: iconType || 'internet',
      iconImage: iconImage || '',
      color, sortOrder,
    });

    // Re-fetch to populate category
    const populated = await Service.findById(service._id);
    res.status(201).json({ success: true, data: populated, message: 'Service created' });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update service
// @route   PUT /api/admin/services/:id
const updateService = async (req, res) => {
  try {
    const { name, category, description, price, currency, duration, features, iconType, iconImage, color, isActive, sortOrder } = req.body;

    const service = await Service.findById(req.params.id).setOptions({ skipPopulate: true });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (category) {
      const cat = await Category.findById(category);
      if (!cat) {
        return res.status(400).json({ success: false, message: 'Invalid category' });
      }
      service.category = category;
    }

    if (name !== undefined) service.name = name;
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = price;
    if (currency !== undefined) service.currency = currency;
    if (duration !== undefined) service.duration = duration;
    if (features !== undefined) service.features = features;
    if (iconType !== undefined) service.iconType = iconType;
    if (iconImage !== undefined) service.iconImage = iconImage;
    if (color !== undefined) service.color = color;
    if (isActive !== undefined) service.isActive = isActive;
    if (sortOrder !== undefined) service.sortOrder = sortOrder;

    await service.save();

    const populated = await Service.findById(service._id);
    res.status(200).json({ success: true, data: populated, message: 'Service updated' });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete service
// @route   DELETE /api/admin/services/:id
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await service.deleteOne();
    res.status(200).json({ success: true, message: 'Service deleted' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get dashboard stats (admin)
// @route   GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const User = require('../models/User');
    const [totalServices, totalCategories, activeServices, totalUsers] = await Promise.all([
      Service.countDocuments(),
      Category.countDocuments(),
      Service.countDocuments({ isActive: true }),
      User.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: { totalServices, totalCategories, activeServices, totalUsers },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Upload service icon image
// @route   POST /api/admin/services/upload-icon
// @access  Admin
const uploadServiceIcon = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    const result = await uploadImage(image, `service_icon_${Date.now()}`);

    res.status(200).json({
      success: true,
      message: 'Icon uploaded',
      data: {
        url: result.displayUrl,
        thumbnail: result.thumbnail,
      },
    });
  } catch (error) {
    console.error('Upload service icon error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload icon',
    });
  }
};

module.exports = { getServices, getAllServices, getService, createService, updateService, deleteService, getStats, uploadServiceIcon };
