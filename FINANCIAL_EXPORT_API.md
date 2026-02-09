# Financial Export API Documentation

## Overview

The Financial Export system provides comprehensive reporting functionality for banks and financial partners. It generates detailed reports about retailer creditworthiness, payment behavior, and financial standing.

## Report Types

### 1. Retailer Credit Summary
Comprehensive credit profile including credit score, limits, and payment history.

### 2. Monthly Purchase Volume
Detailed breakdown of purchasing patterns and order volumes.

### 3. Payment Discipline Report
Analysis of payment timeliness and reliability.

### 4. Outstanding Liability Report
Current outstanding debts with aging analysis.

## Export Formats

All reports support three export formats:
- **JSON** (default): Structured data for API consumption
- **CSV**: Spreadsheet-compatible format
- **PDF-ready JSON**: Formatted JSON optimized for PDF generation

---

## API Endpoints

### 1. Retailer Credit Summary

**GET** `/api/v1/financial-export/credit-summary`

Generate comprehensive credit summary for retailers.

**Access:** Admin, Vendor

**Query Parameters:**
- `retailerId` (optional): Filter by specific retailer
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `minCreditScore` (optional): Minimum credit score filter
- `maxCreditScore` (optional): Maximum credit score filter
- `format` (optional): Export format (json|csv|pdf-json)

**Response (JSON):**
```json
{
  "success": true,
  "data": [
    {
      "retailerDetails": {
        "retailerId": "uuid",
        "retailerCode": "RET001",
        "name": "John Doe",
        "businessName": "ABC Store",
        "shopName": "ABC Retail",
        "phoneNumber": "+9779800000001",
        "email": "john@example.com",
        "address": "Surkhet, Nepal",
        "city": "Birendranagar",
        "state": "Karnali",
        "gstNumber": "GST123",
        "panNumber": "PAN123"
      },
      "creditInformation": {
        "creditLimit": 100000,
        "availableCredit": 75000,
        "outstandingDebt": 25000,
        "creditUtilization": "25.00"
      },
      "creditScore": {
        "score": 720,
        "grade": "Good",
        "components": {
          "paymentTimeliness": 85,
          "orderConsistency": 75,
          "creditUtilization": 70,
          "accountAge": 65
        }
      },
      "riskAssessment": {
        "riskScore": 25.50,
        "riskLevel": "LOW",
        "daysOverdue": 0,
        "consecutiveDelays": 0
      },
      "paymentHistory": {
        "totalPayments": 45,
        "totalPaid": "450000.00",
        "averagePaymentAmount": "10000.00",
        "onTimePayments": 40,
        "latePayments": 5,
        "onTimePaymentRate": "88.89",
        "averagePaymentDelay": "3.20"
      },
      "reliabilityRating": {
        "rating": "4.25",
        "grade": "A (Very Good)",
        "components": {
          "creditScore": "4.00",
          "riskScore": "4.50",
          "paymentDiscipline": "4.44"
        }
      },
      "reportMetadata": {
        "generatedAt": "2026-02-06T10:00:00Z",
        "periodStart": "2025-01-01",
        "periodEnd": "2026-02-06",
        "totalOrders": 50,
        "totalPayments": 45
      }
    }
  ]
}
```

**CSV Format:**
```csv
Retailer ID,Retailer Code,Business Name,Shop Name,Phone Number,Credit Limit,Credit Score,Credit Grade,Reliability Rating,Reliability Grade,Available Credit,Outstanding Debt,Credit Utilization %,Risk Score,Risk Level,Days Overdue,Total Payments,On-Time Payment Rate %
uuid,RET001,ABC Store,ABC Retail,+9779800000001,100000,720,Good,4.25,A (Very Good),75000,25000,25.00,25.50,LOW,0,45,88.89
```

---

### 2. Monthly Purchase Volume

**GET** `/api/v1/financial-export/purchase-volume`

Generate monthly purchase volume analysis.

**Access:** Admin, Vendor

**Query Parameters:**
- `retailerId` (optional): Filter by specific retailer
- `year` (optional): Year (default: current year)
- `month` (optional): Month 1-12 (default: current month)
- `format` (optional): Export format (json|csv|pdf-json)

**Response (JSON):**
```json
{
  "success": true,
  "data": [
    {
      "retailerDetails": {
        "retailerId": "uuid",
        "retailerCode": "RET001",
        "name": "John Doe",
        "businessName": "ABC Store",
        "shopName": "ABC Retail"
      },
      "periodInformation": {
        "month": "January",
        "year": 2026,
        "startDate": "2026-01-01T00:00:00Z",
        "endDate": "2026-01-31T23:59:59Z"
      },
      "purchaseMetrics": {
        "totalOrders": 15,
        "totalPurchaseValue": "150000.00",
        "averageOrderValue": "10000.00",
        "ordersByStatus": {
          "COMPLETED": 12,
          "DELIVERED": 2,
          "DISPATCHED": 1
        }
      },
      "productBreakdown": [
        {
          "productName": "Rice (1kg)",
          "quantity": 500,
          "totalValue": "40000.00"
        },
        {
          "productName": "Dal (1kg)",
          "quantity": 300,
          "totalValue": "36000.00"
        }
      ],
      "creditInformation": {
        "creditLimit": 100000,
        "creditUsedThisMonth": "150000.00",
        "outstandingDebt": 25000
      }
    }
  ]
}
```

---

### 3. Payment Discipline Report

**GET** `/api/v1/financial-export/payment-discipline`

Analyze payment timeliness and discipline.

**Access:** Admin, Vendor

**Query Parameters:**
- `retailerId` (optional): Filter by specific retailer
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `minScore` (optional): Minimum discipline score (0-100)
- `maxScore` (optional): Maximum discipline score (0-100)
- `format` (optional): Export format (json|csv|pdf-json)

**Response (JSON):**
```json
{
  "success": true,
  "data": [
    {
      "retailerDetails": {
        "retailerId": "uuid",
        "retailerCode": "RET001",
        "name": "John Doe",
        "businessName": "ABC Store",
        "shopName": "ABC Retail",
        "phoneNumber": "+9779800000001"
      },
      "paymentDiscipline": {
        "disciplineScore": 88.89,
        "totalOrders": 45,
        "paidOnTime": 40,
        "paidLate": 5,
        "unpaid": 0,
        "averagePaymentDelay": "3.20",
        "onTimePaymentRate": "88.89"
      },
      "creditScore": {
        "score": 720,
        "grade": "Good",
        "paymentTimelinessScore": 85
      },
      "creditInformation": {
        "creditLimit": 100000,
        "outstandingDebt": 25000
      },
      "reliabilityRating": {
        "rating": "4.25",
        "grade": "A (Very Good)",
        "components": {
          "creditScore": "4.00",
          "riskScore": "4.50",
          "paymentDiscipline": "4.44"
        }
      }
    }
  ]
}
```

---

### 4. Outstanding Liability Report

**GET** `/api/v1/financial-export/outstanding-liability`

Detailed breakdown of outstanding debts with aging analysis.

**Access:** Admin, Vendor

**Query Parameters:**
- `retailerId` (optional): Filter by specific retailer
- `minAmount` (optional): Minimum outstanding amount
- `maxAmount` (optional): Maximum outstanding amount
- `overdueOnly` (optional): Show only overdue accounts (true|false)
- `format` (optional): Export format (json|csv|pdf-json)

**Response (JSON):**
```json
{
  "success": true,
  "data": [
    {
      "retailerDetails": {
        "retailerId": "uuid",
        "retailerCode": "RET001",
        "name": "John Doe",
        "businessName": "ABC Store",
        "shopName": "ABC Retail",
        "phoneNumber": "+9779800000001",
        "email": "john@example.com"
      },
      "liabilitySummary": {
        "totalOutstanding": "25000.00",
        "creditLimit": "100000.00",
        "availableCredit": "75000.00",
        "creditUtilization": "25.00"
      },
      "liabilityBreakdown": {
        "current": "15000.00",
        "days30to60": "7000.00",
        "days60to90": "3000.00",
        "over90days": "0.00"
      },
      "agingAnalysis": [
        {
          "orderNumber": "ORD-2026-001",
          "orderDate": "2026-01-15",
          "dueAmount": "10000.00",
          "daysPastDue": 22,
          "status": "PARTIAL"
        }
      ],
      "riskAssessment": {
        "riskScore": 25.50,
        "riskLevel": "LOW",
        "daysOverdue": 0
      },
      "creditScore": {
        "score": 720,
        "grade": "Good"
      },
      "reliabilityRating": {
        "rating": "4.25",
        "grade": "A (Very Good)",
        "components": {
          "creditScore": "4.00",
          "riskScore": "4.50",
          "paymentDiscipline": "4.44"
        }
      },
      "recentTransactions": [
        {
          "date": "2026-02-01T10:00:00Z",
          "type": "ORDER_CREDIT",
          "amount": 10000,
          "balance": 25000
        }
      ]
    }
  ]
}
```

---

### 5. Combined Financial Report

**GET** `/api/v1/financial-export/combined`

Generate all reports in a single response.

**Access:** Admin, Vendor

**Query Parameters:**
- `retailerId` (optional): Filter by specific retailer
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `format` (optional): Export format (json|pdf-json)

**Response (JSON):**
```json
{
  "success": true,
  "data": {
    "generatedAt": "2026-02-06T10:00:00Z",
    "period": {
      "startDate": "2025-01-01",
      "endDate": "2026-02-06"
    },
    "reports": {
      "creditSummary": [...],
      "purchaseVolume": [...],
      "paymentDiscipline": [...],
      "outstandingLiability": [...]
    },
    "summary": {
      "totalRetailers": 150,
      "totalOutstanding": "3750000.00",
      "averageCreditScore": 685
    }
  }
}
```

---

## Data Fields Reference

### Retailer Details
- `retailerId`: Unique identifier
- `retailerCode`: Business code (e.g., RET001)
- `name`: Owner/contact name
- `businessName`: Registered business name
- `shopName`: Shop/store name
- `phoneNumber`: Contact number
- `email`: Email address
- `address`: Physical address
- `city`: City
- `state`: State/province
- `gstNumber`: GST registration number
- `panNumber`: PAN card number

### Credit Information
- `creditLimit`: Maximum credit allowed
- `availableCredit`: Remaining credit available
- `outstandingDebt`: Current debt amount
- `creditUtilization`: Percentage of credit used

### Credit Score (300-900 scale)
- `score`: Overall credit score
- `grade`: Text grade (Excellent/Good/Fair/Poor/Very Poor)
- `components`: Breakdown of score components
  - `paymentTimeliness`: Payment punctuality score
  - `orderConsistency`: Order pattern regularity
  - `creditUtilization`: Credit usage efficiency
  - `accountAge`: Account longevity bonus

### Risk Assessment
- `riskScore`: Risk score (0-100, lower is better)
- `riskLevel`: Risk category (LOW/MEDIUM/HIGH/CRITICAL)
- `daysOverdue`: Maximum days payment is overdue
- `consecutiveDelays`: Number of consecutive late payments

### Payment History
- `totalPayments`: Total number of payments made
- `totalPaid`: Total amount paid
- `averagePaymentAmount`: Average payment size
- `onTimePayments`: Number of on-time payments
- `latePayments`: Number of late payments
- `onTimePaymentRate`: Percentage of on-time payments
- `averagePaymentDelay`: Average delay in days for late payments

### Reliability Rating (1-5 scale)
- `rating`: Numerical rating (1.00-5.00)
- `grade`: Letter grade with description
  - A+ (4.5-5.0): Excellent
  - A (4.0-4.5): Very Good
  - B+ (3.5-4.0): Good
  - B (3.0-3.5): Satisfactory
  - C+ (2.5-3.0): Fair
  - C (2.0-2.5): Below Average
  - D (1.5-2.0): Poor
  - F (<1.5): Very Poor
- `components`: Breakdown of rating factors

---

## Usage Examples

### Example 1: Export Credit Summary as CSV
```bash
GET /api/v1/financial-export/credit-summary?format=csv&minCreditScore=600
Authorization: Bearer <token>
```

Response: CSV file download

### Example 2: Get Payment Discipline for Specific Retailer
```bash
GET /api/v1/financial-export/payment-discipline?retailerId=uuid&format=json
Authorization: Bearer <token>
```

### Example 3: Export Outstanding Liabilities as PDF-ready JSON
```bash
GET /api/v1/financial-export/outstanding-liability?overdueOnly=true&format=pdf-json
Authorization: Bearer <token>
```

### Example 4: Generate Combined Report for Date Range
```bash
GET /api/v1/financial-export/combined?startDate=2025-01-01&endDate=2025-12-31&format=pdf-json
Authorization: Bearer <token>
```

---

## Integration with Banks/Financial Partners

### Recommended Workflow

1. **Daily/Weekly Exports**
   - Schedule automated exports of credit summaries
   - Monitor outstanding liabilities
   - Track payment discipline trends

2. **Loan Application Support**
   - Generate combined report for specific retailer
   - Export as PDF-ready JSON for documentation
   - Include credit score and reliability rating

3. **Risk Monitoring**
   - Regular outstanding liability reports
   - Filter by risk levels
   - Track aging analysis

4. **Performance Analysis**
   - Monthly purchase volume reports
   - Payment discipline trends
   - Credit utilization patterns

### Data Security

- All endpoints require authentication
- Access restricted to Admin and Vendor roles
- Audit logging for all export operations
- Data encrypted in transit (HTTPS)

### Rate Limiting

- Standard API rate limits apply
- Large exports may take longer to generate
- Consider pagination for very large datasets

---

## Error Responses

```json
{
  "success": false,
  "message": "Error description"
}
```

Common error codes:
- `400`: Invalid parameters
- `401`: Unauthorized
- `403`: Forbidden (insufficient permissions)
- `404`: Retailer not found
- `500`: Server error

---

## Best Practices

1. **Use Filters**: Apply filters to reduce data volume
2. **Date Ranges**: Specify date ranges for historical analysis
3. **Format Selection**: Choose appropriate format for use case
4. **Caching**: Cache reports that don't change frequently
5. **Scheduling**: Schedule large exports during off-peak hours

---

## Support

For technical support or questions about financial exports:
- Review this documentation
- Check API response error messages
- Contact system administrator

---

## Changelog

### Version 1.0 (2026-02-06)
- Initial release
- Four report types
- Three export formats
- Comprehensive retailer financial data
