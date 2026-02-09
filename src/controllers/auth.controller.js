const { body } = require('express-validator');
const AuthService = require('../services/auth.service');
const ApiResponse = require('../utils/response');

class AuthController {
  static registerValidation = [
    body('phoneNumber').isMobilePhone('any').withMessage('Invalid phone number'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').isIn(['VENDOR', 'RETAILER', 'ADMIN']).withMessage('Invalid role'),
  ];

  static loginValidation = [
    body('phoneNumber').isMobilePhone('any').withMessage('Invalid phone number'),
    body('password').notEmpty().withMessage('Password is required'),
  ];

  async register(req, res, next) {
    try {
      const result = await AuthService.register(req.body);
      return ApiResponse.success(res, result, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { phoneNumber, password } = req.body;
      const result = await AuthService.login(phoneNumber, password);
      return ApiResponse.success(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      return ApiResponse.success(res, req.user, 'Profile retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
