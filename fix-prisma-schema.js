const fs = require('fs');

// Read the schema
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Add @map attributes for camelCase fields
const mappings = {
  'phoneNumber': 'phone_number',
  'businessName': 'business_name',
  'isActive': 'is_active',
  'isVerified': 'is_verified',
  'passwordHash': 'password_hash',
  'lastLoginAt': 'last_login_at',
  'createdAt': 'created_at',
  'updatedAt': 'updated_at',
  'createdBy': 'created_by',
  'deletedAt': 'deleted_at',
  'userId': 'user_id',
  'vendorId': 'vendor_id',
  'retailerId': 'retailer_id',
  'productId': 'product_id',
  'orderId': 'order_id',
  'paymentId': 'payment_id',
  'vendorCode': 'vendor_code',
  'businessLicense': 'business_license',
  'taxId': 'tax_id',
  'gstNumber': 'gst_number',
  'panNumber': 'pan_number',
  'bankAccountNumber': 'bank_account_number',
  'bankIfscCode': 'bank_ifsc_code',
  'bankName': 'bank_name',
  'creditLimit': 'credit_limit',
  'commissionRate': 'commission_rate',
  'totalSales': 'total_sales',
  'isApproved': 'is_approved',
  'approvedAt': 'approved_at',
  'approvedBy': 'approved_by',
  'retailerCode': 'retailer_code',
  'shopName': 'shop_name',
  'creditScore': 'credit_score',
  'availableCredit': 'available_credit',
  'totalOrders': 'total_orders',
  'totalSpent': 'total_spent',
  'outstandingDebt': 'outstanding_debt',
  'lastOrderAt': 'last_order_at',
  'lastPaymentAt': 'last_payment_at',
  'riskCategory': 'risk_category',
  'productCode': 'product_code',
  'subCategory': 'sub_category',
  'hsnCode': 'hsn_code',
  'minOrderQty': 'min_order_qty',
  'maxOrderQty': 'max_order_qty',
  'isFeatured': 'is_featured',
  'imageUrl': 'image_url',
  'vendorPrice': 'vendor_price',
  'minStock': 'min_stock',
  'maxStock': 'max_stock',
  'leadTimeDays': 'lead_time_days',
  'isAvailable': 'is_available',
  'lastRestockedAt': 'last_restocked_at',
  'orderNumber': 'order_number',
  'paymentStatus': 'payment_status',
  'taxAmount': 'tax_amount',
  'shippingCharges': 'shipping_charges',
  'paidAmount': 'paid_amount',
  'dueAmount': 'due_amount',
  'creditUsed': 'credit_used',
  'internalNotes': 'internal_notes',
  'cancellationReason': 'cancellation_reason',
  'whatsappMessageId': 'whatsapp_message_id',
  'invoiceNumber': 'invoice_number',
  'invoiceUrl': 'invoice_url',
  'expectedDelivery': 'expected_delivery',
  'confirmedAt': 'confirmed_at',
  'shippedAt': 'shipped_at',
  'deliveredAt': 'delivered_at',
  'cancelledAt': 'cancelled_at',
  'productName': 'product_name',
  'productSku': 'product_sku',
  'unitPrice': 'unit_price',
  'taxRate': 'tax_rate',
  'ledgerNumber': 'ledger_number',
  'transactionType': 'transaction_type',
  'runningBalance': 'running_balance',
  'previousBalance': 'previous_balance',
  'referenceNumber': 'reference_number',
  'dueDate': 'due_date',
  'isReversed': 'is_reversed',
  'reversedBy': 'reversed_by',
  'reversalLedgerId': 'reversal_ledger_id',
  'paymentNumber': 'payment_number',
  'paymentMethod': 'payment_method',
  'transactionId': 'transaction_id',
  'bankReference': 'bank_reference',
  'chequeNumber': 'cheque_number',
  'chequeDate': 'cheque_date',
  'receiptUrl': 'receipt_url',
  'processedAt': 'processed_at',
  'failedAt': 'failed_at',
  'failureReason': 'failure_reason',
  'reversedAt': 'reversed_at',
  'reversalReason': 'reversal_reason',
  'entityType': 'entity_type',
  'entityId': 'entity_id',
  'oldValues': 'old_values',
  'newValues': 'new_values',
  'ipAddress': 'ip_address',
  'userAgent': 'user_agent',
  'sessionId': 'session_id',
  'messageId': 'message_id',
  'conversationId': 'conversation_id',
  'mediaUrl': 'media_url',
  'isProcessed': 'is_processed',
  'errorMessage': 'error_message',
  'fromStatus': 'from_status',
  'toStatus': 'to_status',
  'changedBy': 'changed_by'
};

// Function to add @map to a field
function addMapToField(fieldLine, fieldName, snakeName) {
  // Skip if already has @map
  if (fieldLine.includes('@map')) return fieldLine;
  
  // Add @map before any existing attributes or at the end
  const parts = fieldLine.split(/(@\w+)/);
  if (parts.length > 1) {
    // Has other attributes
    return parts[0] + `@map("${snakeName}") ` + parts.slice(1).join('');
  } else {
    // No other attributes
    return fieldLine.trimEnd() + ` @map("${snakeName}")`;
  }
}

// Process each mapping
for (const [camelCase, snake_case] of Object.entries(mappings)) {
  // Match field declarations
  const regex = new RegExp(`^(\\s+${camelCase}\\s+.*)$`, 'gm');
  schema = schema.replace(regex, (match) => {
    return addMapToField(match, camelCase, snake_case);
  });
}

// Write back
fs.writeFileSync('prisma/schema.prisma', schema);
console.log('✓ Prisma schema updated with @map attributes');
