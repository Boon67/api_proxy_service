const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validation middleware
const validateUser = [
  body('username').notEmpty().trim().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('contactNumber').optional().trim(),
  body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];

const validateUserUpdate = [
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('contactNumber').optional().trim(),
  body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// GET /api/users - List all users
router.get('/users', async (req, res) => {
  try {
    // Only admins can view all users
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required'
      });
    }

    const users = await databaseService.getAllUsers();
    // Remove password hashes from response
    const safeUsers = users.map(user => {
      const { PASSWORD_HASH, ...safeUser } = user;
      return safeUser;
    });

    res.json({
      success: true,
      data: safeUsers,
      count: safeUsers.length
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// GET /api/users/:id - Get specific user
router.get('/users/:id', async (req, res) => {
  try {
    // Only admins or the user themselves can view user details
    if (req.user?.role !== 'admin' && req.user?.userId !== req.params.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Access denied'
      });
    }

    const user = await databaseService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove password hash from response
    const { PASSWORD_HASH, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// POST /api/users - Create new user
router.post('/users', validateUser, async (req, res) => {
  try {
    // Only admins can create users
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if username already exists
    const existingUser = await databaseService.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(req.body.password, 12);

    const userData = {
      username: req.body.username,
      passwordHash,
      firstName: req.body.firstName || null,
      lastName: req.body.lastName || null,
      email: req.body.email || null,
      contactNumber: req.body.contactNumber || null,
      role: req.body.role || 'user',
      isActive: req.body.isActive !== false,
      createdBy: req.user?.username || 'system'
    };

    const user = await databaseService.createUser(userData);
    
    // Remove password hash from response
    const { PASSWORD_HASH, ...safeUser } = user;

    logger.info(`User created: ${user.USERNAME} by ${req.user?.username || 'system'}`);

    res.status(201).json({
      success: true,
      data: safeUser,
      message: 'User created successfully'
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// PUT /api/users/:id - Update user
router.put('/users/:id', validateUserUpdate, async (req, res) => {
  try {
    // Only admins or the user themselves can update (with restrictions)
    const isAdmin = req.user?.role === 'admin';
    const isSelf = req.user?.userId === req.params.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Access denied'
      });
    }

    // Non-admins can only update their own personal information
    if (!isAdmin && isSelf) {
      const allowedFields = ['password', 'email', 'firstName', 'lastName', 'contactNumber'];
      const requestedFields = Object.keys(req.body);
      const hasRestrictedFields = requestedFields.some(field => !allowedFields.includes(field));
      
      if (hasRestrictedFields) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only update your personal information (password, email, name, contact)'
        });
      }
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const updateData = {};

    if (req.body.firstName !== undefined) {
      updateData.firstName = req.body.firstName;
    }
    if (req.body.lastName !== undefined) {
      updateData.lastName = req.body.lastName;
    }
    if (req.body.email !== undefined) {
      updateData.email = req.body.email;
    }
    if (req.body.contactNumber !== undefined) {
      updateData.contactNumber = req.body.contactNumber;
    }
    if (req.body.role !== undefined && isAdmin) {
      updateData.role = req.body.role;
    }
    if (req.body.isActive !== undefined && isAdmin) {
      updateData.isActive = req.body.isActive;
    }
    if (req.body.password !== undefined) {
      updateData.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    const user = await databaseService.updateUser(req.params.id, updateData);


    // Remove password hash from response
    const { PASSWORD_HASH, ...safeUser } = user;

    logger.info(`User updated: ${user.USERNAME} by ${req.user?.username || 'system'}`);

    res.json({
      success: true,
      data: safeUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    // Only admins can delete users
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required'
      });
    }

    // Prevent deleting yourself
    if (req.user?.userId === req.params.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    const user = await databaseService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await databaseService.deleteUser(req.params.id);

    logger.info(`User deleted: ${user.USERNAME} (${req.params.id}) by ${req.user?.username || 'system'}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

module.exports = router;

