const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateProfile, deleteUser, getPassengers, searchPassengers, updateUserById, getPassengerById } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// All user routes require authentication
router.use(authMiddleware);

// Get all users
router.get('/users', getAllUsers);

// Create new user
router.post('/users', createUser);

// Update user profile
router.put('/users/profile', updateProfile);

// Update user by id
router.put('/users/:id', updateUserById);

// Delete user
router.delete('/users/:id', deleteUser);

// Passenger specific routes
router.get('/users/passengers', getPassengers);
router.get('/users/passengers/search', searchPassengers);
router.get('/users/passengers/:id', getPassengerById);

module.exports = router;
