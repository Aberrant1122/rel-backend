const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateProfile, deleteUser, getPassengers, searchPassengers } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// All user routes require authentication
router.use(authMiddleware);

// Get all users
router.get('/users', getAllUsers);

// Create new user
router.post('/users', createUser);

// Update user profile
router.put('/users/profile', updateProfile);

// Delete user
router.delete('/users/:id', deleteUser);

// Passenger specific routes
router.get('/users/passengers', getPassengers);
router.get('/users/passengers/search', searchPassengers);

module.exports = router;
