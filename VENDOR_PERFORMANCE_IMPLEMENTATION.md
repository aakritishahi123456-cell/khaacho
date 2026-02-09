# Vendor Performance Tracking - Implementation Details

## Overview

The Vendor Performance Tracking system provides comprehensive monitoring and evaluation of vendor performance based on real operational data. It calculates reliability scores that directly influence order routing decisions.

## Database Schema

### Tables Created

#### 1. vendor_performance
Stores current performance metrics for each vendor.

**Key Fields**:
- `vendor_id`: Reference to vendor
- `total_orders_assigned`: Total orders assigned to vendor
- `orders_accepted`: Orders accepted by vendor
- `orders_rejected`: Orders rejected by vendor
- `orders_completed`: Successfully completed orders
- `orders_cancelled`: Cancelled orders
- `acceptance_rate`: Percentage of orders accepted
- `completion_rate`: Percentage of accepted orders completed
- `avg_fulfillment_time`: Average hours from assignment to delivery
- `cancellation_rate`: Percentage of orders cancelled
- `price_competitiveness_index`: 0-100 score based on pricing
- `reliability_score`: Overall 0-100 score (weighted average)
- `calculation_period`: `all_time`, `last_30_days`, `last_90_days`

#### 2. vendor_performance_history
Historical snapshots for trend analysis.

**Key Fields**:
- `vendor_id`: Reference to vendor
- `acceptance_rate`, `completion_rate`, etc.: Snapshot of metrics
- `period_start`, `period_end`: Time period
- `period_type`: `daily`, `weekly`, `monthly`, `quarterly`

#### 3. vendor_performance_events
Detailed event log for audit trail.

**Key Fields**:
- `vendor_id`: Reference to vendor
- `order_id`: Related order
- `event_type`: Type of event (order_assigned, order_accepted, etc.)
- `event_data`: Additional JSON data
- `affects_acceptance`, `affects_completion`, etc.: Which metrics are impacted

#### 4. vendor_price_comparison
Tracks vendor pricing vs market average.

**Key Fields**:
- `product_id`: Reference to product
- `vendor_id`: Reference to vendor
- `vendor_price`: Vendor's price for product
- `market_avg_price`: Average price across all vendors
- `price_deviation`: Percentage deviation from market average
- `is_competitive`: Boolean (within 10% of market average)

## Reliability Score Calculation

### Formula

```
Reliability Score = (
  (Acceptance Rate × 0.25) +
  (Completion Rate × 0.30) +
  (Fulfillment Time Score × 0.20) +
  ((100 - Cancellation Rate) × 0.15) +
  (Price Competitiveness Index × 0.10)
)
```

### Component Weights

1. **Acceptance Rate (25%)**
   - Measures: Willingness to take orders
   - Calculation: (Orders Accepted / Total Assigned) × 100
   - Impact: Higher acceptance = better reliability

2. **Completion Rate (30%)**
   - Measures: Ability to fulfill accepted orders
   - Calculation: (Orders Completed / Orders Accepted) × 100
   - Impact: Higher completion = better reliability
   - **Highest weight** - most important metric

3. **Fulfillment Time Score (20%)**
   - Measures: Speed of delivery
   - Calculation:
     - ≤ 24 hours: 100 points
     - 24-72 hours: Linear scale (100 to 0)
     - ≥ 72 hours: 0 points
   - Impact: Faster delivery = better score

4. **Cancellation Rate (15%)**
   - Measures: Order cancellations (inverse)
   - Calculation: 100 - (Orders Cancelled / Total Assigned) × 100
   - Impact: Lower cancellations = better score

5. **Price Competitiveness (10%)**
   - Measures: Pricing vs market
   - Calculation: Based on deviation from market average
   - Impact: More competitive pricing = better score

### Performance Grades

| Score | Grade | Label | Description |
|-------|-------|-------|-------------|
| 90-100 | A+ | Excellent | Outstanding performance across all metrics |
| 80-89 | A | Very Good | Consistently good performance |
| 70-79 | B | Good | Acceptable performance with minor issues |
| 60-69 | C | Fair | Needs improvement in some areas |
| 50-59 | D | Poor | Significant performance issues |
| 0-49 | F | Very Poor | Critical performance problems |

## Database Functions

### calculate_vendor_reliability_score()

PostgreSQL function that calculates the weighted reliability score.

**Parameters**:
- `p_acceptance_rate`: Acceptance rate (0-100)
- `p_completion_rate`: Completion rate (0-100)
- `p_avg_fulfillment_time`: Average fulfillment time in hours
- `p_cancellation_rate`: Cancellation rate (0-100)
- `p_price_competitiveness`: Price competitiveness index (0-100)

**Returns**: Decimal (0-100)

### update_vendor_performance_metrics()

Recalculates all performance metrics for a vendor.

**Parameters**:
- `p_vendor_id`: UUID of vendor

**Process**:
1. Queries `vendor_order_acceptances` table for order statistics
2. Calculates acceptance, completion, and cancellation rates
3. Calculates average fulfillment time from order history
4. Fetches price competitiveness from `vendor_price_comparison`
5. Calls `calculate_vendor_reliability_score()` for final score
6. Upserts into `vendor_performance` table

## Automatic Event Tracking

### Trigger: log_vendor_performance_event()

Automatically logs events when vendor order acceptances change.

**Triggered On**:
- INSERT: Logs `order_assigned` event
- UPDATE: Logs status changes
  - `accepted` → `order_accepted` event
  - `rejected` → `order_rejected` event
  - `completed` → `order_completed` event
  - `cancelled` → `order_cancelled` event

**Benefits**:
- Complete audit trail
- No manual logging required
- Tracks which metrics are affected by each event

## Service Layer

### VendorPerformanceService

**Key Methods**:

1. `calculateVendorPerformance(vendorId)`
   - Calls database function to recalculate metrics
   - Returns updated performance data

2. `getVendorPerformance(vendorId, period)`
   - Retrieves performance metrics for a vendor
   - Auto-calculates if not exists

3. `getAllVendorsPerformance(options)`
   - Gets performance for all vendors
   - Supports sorting, filtering, pagination

4. `getVendorPerformanceDashboard(vendorId)`
   - Comprehensive dashboard data
   - Includes performance, history, events, pricing

5. `getVendorPerformanceHistory(vendorId, options)`
   - Historical trends
   - Supports different period types

6. `updateVendorPriceComparison(productId, vendorId, vendorPrice)`
   - Updates vendor pricing
   - Recalculates market average
   - Determines competitiveness

7. `compareVendors(vendorIds)`
   - Side-by-side comparison
   - Up to 10 vendors at once

8. `getTopPerformers(limit)`
   - Returns highest-scoring vendors
   - Sorted by reliability score

9. `getVendorsNeedingAttention(threshold)`
   - Returns vendors below threshold
   - Default threshold: 60

10. `recalculateAllVendors()`
    - Batch recalculation
    - Used by background worker

## Integration with Order Routing

### Modified: OrderRoutingService._calculateReliabilityScore()

**Before**:
```javascript
_calculateReliabilityScore(vendor) {
  const rating = Number(vendor.rating) || 0;
  let score = (rating / 5) * 100;
  // Simple calculation based on vendor rating
  return Math.min(100, score);
}
```

**After**:
```javascript
async _calculateReliabilityScore(vendor) {
  try {
    // Try to get performance-based reliability score
    const performance = await vendorPerformanceService.getVendorPerformance(vendor.id);
    
    if (performance && performance.reliability_score) {
      return Number(performance.reliability_score);
    }
  } catch (error) {
    // Fallback to basic calculation
  }
  
  // Fallback logic...
}
```

**Impact**:
- Order routing now uses real performance data
- Vendors with better performance get priority
- Automatic adjustment based on actual behavior

## Background Worker

### VendorPerformanceWorker

**Schedule**: Every 6 hours (0 */6 * * *)

**Process**:
1. Gets all active, approved vendors
2. Calls `calculateVendorPerformance()` for each
3. Logs success/failure for each vendor
4. Returns summary statistics

**Benefits**:
- Keeps metrics up-to-date
- Runs during low-traffic periods
- Can be triggered manually via API

**Manual Trigger**:
```javascript
const worker = require('./workers/vendorPerformance.worker');
await worker.runNow();
```

## API Endpoints

### Admin/Operator Endpoints

1. **GET /vendor-performance**
   - View all vendors performance
   - Sort, filter, paginate

2. **GET /vendor-performance/top-performers**
   - Quick view of best vendors

3. **GET /vendor-performance/needs-attention**
   - Vendors requiring intervention

4. **POST /vendor-performance/compare**
   - Compare multiple vendors

5. **POST /vendor-performance/recalculate-all**
   - Trigger batch recalculation

### Vendor Endpoints

1. **GET /vendor-performance/:vendorId**
   - View own performance metrics

2. **GET /vendor-performance/:vendorId/dashboard**
   - Comprehensive performance dashboard

3. **GET /vendor-performance/:vendorId/history**
   - Historical trends

4. **GET /vendor-performance/:vendorId/events**
   - Event log

5. **GET /vendor-performance/:vendorId/pricing**
   - Price competitiveness data

## Price Competitiveness Tracking

### How It Works

1. **Price Update**: When vendor updates product price
2. **Market Average**: System calculates average across all vendors
3. **Deviation**: Calculates percentage deviation
4. **Competitiveness**: Determines if within 10% of average
5. **Index Calculation**:
   - 10%+ below average: 100 points
   - 5-10% below: 90 points
   - Within 5%: 80 points
   - 5-10% above: 70 points
   - 10%+ above: 60 points

### Benefits

- Encourages competitive pricing
- Rewards vendors with good prices
- Transparent pricing comparison
- Automatic updates

## Performance Monitoring

### Key Metrics to Monitor

1. **Acceptance Rate**
   - Target: > 90%
   - Warning: < 80%
   - Critical: < 70%

2. **Completion Rate**
   - Target: > 95%
   - Warning: < 90%
   - Critical: < 85%

3. **Avg Fulfillment Time**
   - Target: < 24 hours
   - Warning: 24-48 hours
   - Critical: > 48 hours

4. **Cancellation Rate**
   - Target: < 5%
   - Warning: 5-10%
   - Critical: > 10%

5. **Reliability Score**
   - Target: > 80 (Grade A)
   - Warning: 60-80 (Grade B-C)
   - Critical: < 60 (Grade D-F)

### Admin Actions

**For Low Performers (Score < 60)**:
1. Review performance dashboard
2. Check event log for patterns
3. Contact vendor to discuss issues
4. Set improvement targets
5. Monitor weekly progress
6. Consider temporary suspension if no improvement

**For High Performers (Score > 90)**:
1. Recognize and reward
2. Offer preferential terms
3. Increase order allocation
4. Feature in vendor directory
5. Use as case study

## Testing

### Test Script: test-vendor-performance.js

**Tests**:
1. Login authentication
2. Get all vendors performance
3. Get specific vendor performance
4. Get vendor dashboard
5. Get performance history
6. Get performance events
7. Get price competitiveness
8. Get top performers
9. Get vendors needing attention
10. Compare vendors
11. Recalculate performance

**Run**:
```bash
node test-vendor-performance.js
```

## Best Practices

### For Admins

1. **Regular Monitoring**
   - Check dashboard weekly
   - Review vendors needing attention
   - Track trends over time

2. **Proactive Management**
   - Contact low performers early
   - Set clear expectations
   - Provide support and training

3. **Fair Evaluation**
   - Consider external factors (seasonality, supply issues)
   - Review event log for context
   - Allow time for improvement

4. **Data Accuracy**
   - Ensure order statuses are updated promptly
   - Verify delivery times are accurate
   - Update pricing regularly

### For Vendors

1. **Maintain High Acceptance Rate**
   - Only reject when absolutely necessary
   - Respond quickly to order assignments
   - Keep inventory updated

2. **Complete Orders Reliably**
   - Fulfill all accepted orders
   - Communicate delays proactively
   - Maintain quality standards

3. **Deliver Quickly**
   - Target < 24 hour fulfillment
   - Optimize logistics
   - Plan for peak periods

4. **Minimize Cancellations**
   - Accurate inventory management
   - Realistic capacity planning
   - Clear communication

5. **Competitive Pricing**
   - Monitor market prices
   - Stay within 10% of average
   - Balance price and quality

## Future Enhancements

### Potential Additions

1. **Customer Feedback Integration**
   - Retailer ratings
   - Quality scores
   - Service feedback

2. **Advanced Analytics**
   - Predictive performance modeling
   - Seasonal trend analysis
   - Capacity forecasting

3. **Automated Alerts**
   - Email notifications for low performance
   - SMS alerts for critical issues
   - Dashboard notifications

4. **Performance Incentives**
   - Bonus programs for high performers
   - Tiered commission rates
   - Priority order allocation

5. **Benchmarking**
   - Industry comparisons
   - Regional performance standards
   - Category-specific metrics

## Troubleshooting

### Common Issues

**Issue**: Reliability score not updating
- **Solution**: Run manual recalculation via API
- **Check**: Worker logs for errors
- **Verify**: Database function is working

**Issue**: Incorrect acceptance rate
- **Solution**: Verify order statuses in database
- **Check**: vendor_order_acceptances table
- **Recalculate**: Trigger manual update

**Issue**: Price competitiveness always 50
- **Solution**: Update vendor_price_comparison table
- **Check**: Market average calculation
- **Verify**: Multiple vendors have pricing data

**Issue**: Performance history empty
- **Solution**: History is generated over time
- **Check**: Wait for first period to complete
- **Note**: Manual snapshots can be created

## Conclusion

The Vendor Performance Tracking system provides:
- ✅ Objective performance measurement
- ✅ Automatic data collection
- ✅ Real-time reliability scoring
- ✅ Integration with order routing
- ✅ Comprehensive reporting
- ✅ Historical trend analysis
- ✅ Fair and transparent evaluation

This system ensures that high-performing vendors are rewarded with more orders, while low performers are identified and supported to improve.
