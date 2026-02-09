const express = require('express');
const ProductController = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.post('/', authenticate, authorize('VENDOR'), ProductController.createValidation, validate, ProductController.createProduct.bind(ProductController));
router.get('/', authenticate, ProductController.getProducts.bind(ProductController));
router.patch('/:id', authenticate, authorize('VENDOR', 'ADMIN'), ProductController.updateProduct.bind(ProductController));

module.exports = router;
