const { body, param, query } = require('express-validator');
const prisma = require('../config/database');
const ApiResponse = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

class AdminController {
  static approveRetailerValidation = [
    param('id').isUUID().withMessage('Invalid retailer ID'),
    body('creditLimit').isFloat({ min: 0 }).withMessage('Credit limit must be positive'),
  ];

  static updateCreditLimitValidation = [
    param('id').isUUID().withMessage('Invalid retailer ID'),
    body('creditLimit').isFloat({ min: 0 }).withMessage('Credit limit must be positive'),
  ];

  async getRetailers(req, res, next) {
    try {
      const { isApproved, search, page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;
      
      const where = {};
      if (isApproved !== undefined) {
        where.isApproved = isApproved === 'true';
      }
      
      if (search) {
        where.OR = [
          { shopName: { contains: search, mode: 'insensitive' } },
          { retailerCode: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [retailers, total] = await Promise.all([
        prisma.retailer.findMany({
          where,
          skip,
          take: parseInt(limit),
          include: {
            user: {
              select: {
                name: true,
                phoneNumber: true,
                businessName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.retailer.count({ where }),
      ]);

      return ApiResponse.paginated(res, retailers, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  async approveRetailer(req, res, next) {
    try {
      const { id } = req.params;
      const { creditLimit } = req.body;

      const retailer = await prisma.retailer.findUnique({
        where: { id },
      });

      if (!retailer) {
        throw new NotFoundError('Retailer not found');
      }

      const updated = await prisma.retailer.update({
        where: { id },
        data: {
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: req.user.id,
          creditLimit: parseFloat(creditLimit),
          availableCredit: parseFloat(creditLimit),
        },
        include: {
          user: true,
        },
      });

      return ApiResponse.success(res, updated, 'Retailer approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCreditLimit(req, res, next) {
    try {
      const { id } = req.params;
      const { creditLimit } = req.body;

      const retailer = await prisma.retailer.findUnique({
        where: { id },
      });

      if (!retailer) {
        throw new NotFoundError('Retailer not found');
      }

      const creditDiff = parseFloat(creditLimit) - parseFloat(retailer.creditLimit);
      
      const updated = await prisma.retailer.update({
        where: { id },
        data: {
          creditLimit: parseFloat(creditLimit),
          availableCredit: { increment: creditDiff },
        },
      });

      return ApiResponse.success(res, updated, 'Credit limit updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getVendors(req, res, next) {
    try {
      const { isApproved, page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;
      
      const where = {};
      if (isApproved !== undefined) {
        where.isApproved = isApproved === 'true';
      }

      const [vendors, total] = await Promise.all([
        prisma.vendor.findMany({
          where,
          skip,
          take: parseInt(limit),
          include: {
            user: {
              select: {
                name: true,
                phoneNumber: true,
                businessName: true,
              },
            },
            vendorProducts: {
              select: { id: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.vendor.count({ where }),
      ]);

      return ApiResponse.paginated(res, vendors, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  async approveVendor(req, res, next) {
    try {
      const { id } = req.params;

      const vendor = await prisma.vendor.findUnique({
        where: { id },
      });

      if (!vendor) {
        throw new NotFoundError('Vendor not found');
      }

      const updated = await prisma.vendor.update({
        where: { id },
        data: {
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: req.user.id,
        },
        include: {
          user: true,
        },
      });

      return ApiResponse.success(res, updated, 'Vendor approved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          skip,
          take: parseInt(limit),
          include: {
            retailer: {
              select: {
                shopName: true,
              },
            },
            order: {
              select: {
                orderNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.payment.count(),
      ]);

      return ApiResponse.paginated(res, payments, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
