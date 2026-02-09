const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.post('/register', AuthController.registerValidation, validate, AuthController.register.bind(AuthController));
router.post('/login', AuthController.loginValidation, validate, AuthController.login.bind(AuthController));
router.get('/profile', authenticate, AuthController.getProfile.bind(AuthController));

module.exports = router;
