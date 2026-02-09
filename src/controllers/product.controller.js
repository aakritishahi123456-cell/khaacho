const { body, param } = require('express-validator');
const prisma = require('../config/database');
const ApiResponse = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

class ProductController {
  static createValidation = [
    body('name').notEmpty().withMessage('Product name is required'),
    body('sku').notEmpty().withMessage('SKU is required'),
    body('unit').notEmpty().withMessage('Unit is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  ];

  async createProduct(req, res, next) {
    try {
      const vendorId = req.user.vendorProfile?.id;

      if (!vendorId) {
        return ApiResponse.error(res, 'Only vendors can create products', 403);
      }

      const product = await prisma.product.create({
        data: {
          ...req.body,
          vendorId,
        },
      });

      return ApiResponse.success(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const vendorId = req.user.vendorProfile?.id;

      const product = await prisma.product.findUnique({ where: { id } });

      if (!product) {
        throw new NotFoundError('Product not found');
      }

      if (product.vendorId !== vendorId && req.user.role !== 'ADMIN') {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const updated = await prisma.product.update({
        where: { id },
        data: req.body,
      });

      return ApiResponse.success(res, updated, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getProducts(req, res, next) {
    try {
      const { vendorId, search, page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;
      const where = { isActive: true };

      if (vendorId) where.vendorId = vendorId;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: parseInt(limit),
          include: {
            vendor: {
              include: { user: true },
            },
          },
        }),
        prisma.product.count({ where }),
      ]);

      return ApiResponse.paginated(res, products, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      }, 'Products retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
