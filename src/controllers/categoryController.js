const Category = require('../models/Category');

// @desc    Get all categories (public - active only)
// @route   GET /api/categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all categories (admin - including inactive)
// @route   GET /api/admin/categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Get all categories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create category
// @route   POST /api/admin/categories
const createCategory = async (req, res) => {
  try {
    const { name, icon, color, sortOrder } = req.body;

    if (!name || !icon) {
      return res.status(400).json({ success: false, message: 'Name and icon are required' });
    }

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }

    const category = await Category.create({ name, icon, color, sortOrder });
    res.status(201).json({ success: true, data: category, message: 'Category created' });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
const updateCategory = async (req, res) => {
  try {
    const { name, icon, color, isActive, sortOrder } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (name !== undefined) category.name = name;
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (isActive !== undefined) category.isActive = isActive;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;

    await category.save();
    res.status(200).json({ success: true, data: category, message: 'Category updated' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const Service = require('../models/Service');
    const serviceCount = await Service.countDocuments({ category: req.params.id });
    if (serviceCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete. ${serviceCount} service(s) are using this category. Remove or reassign them first.`,
      });
    }

    await category.deleteOne();
    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getCategories, getAllCategories, createCategory, updateCategory, deleteCategory };
