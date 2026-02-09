const DashboardService = require('../services/dashboard.service');
const ApiResponse = require('../utils/response');

class DashboardController {
  async getAdminDashboard(req, res, next) {
    try {
      const { days = 30 } = req.query;
      const dashboard = await DashboardService.getAdminDashboard(parseInt(days));
      return ApiResponse.success(res, dashboard, 'Admin dashboard retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getVendorDashboard(req, res, next) {
    try {
      const vendorId = req.user.vendorProfile?.id;
      
      if (!vendorId) {
        return ApiResponse.error(res, 'Vendor profile not found', 404);
      }

      const dashboard = await DashboardService.getVendorDashboard(vendorId);
      return ApiResponse.success(res, dashboard, 'Vendor dashboard retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getRetailerDashboard(req, res, next) {
    try {
      const retailerId = req.user.retailerProfile?.id;
      
      if (!retailerId) {
        return ApiResponse.error(res, 'Retailer profile not found', 404);
      }

      const dashboard = await DashboardService.getRetailerDashboard(retailerId);
      return ApiResponse.success(res, dashboard, 'Retailer dashboard retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
