const express = require('express');
const authRoutes = require('./auth.routes');
const orderRoutes = require('./order.routes');
const orderLifecycleRoutes = require('./orderLifecycle.routes');
const productRoutes = require('./product.routes');
const creditRoutes = require('./credit.routes');
const whatsappRoutes = require('./whatsapp.routes');
const dashboardRoutes = require('./dashboard.routes');
const analyticsRoutes = require('./analytics.routes');
const adminRoutes = require('./admin.routes');
const financialMetricsRoutes = require('./financialMetrics.routes');
const creditScoringRoutes = require('./creditScoring.routes');
const riskControlRoutes = require('./riskControl.routes');
const financialExportRoutes = require('./financialExport.routes');
const orderRoutingRoutes = require('./orderRouting.routes');
const vendorPerformanceRoutes = require('./vendorPerformance.routes');
const priceIntelligenceRoutes = require('./priceIntelligence.routes');
const queueRoutes = require('./queue.routes');
const recoveryRoutes = require('./recovery.routes');
const monitoringRoutes = require('./monitoring.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/order-lifecycle', orderLifecycleRoutes);
router.use('/order-routing', orderRoutingRoutes);
router.use('/products', productRoutes);
router.use('/credit', creditRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/admin', adminRoutes);
router.use('/financial-metrics', financialMetricsRoutes);
router.use('/credit-scoring', creditScoringRoutes);
router.use('/risk-control', riskControlRoutes);
router.use('/financial-export', financialExportRoutes);
router.use('/vendor-performance', vendorPerformanceRoutes);
router.use('/price-intelligence', priceIntelligenceRoutes);
router.use('/queues', queueRoutes);
router.use('/recovery', recoveryRoutes);
router.use('/monitoring', monitoringRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
