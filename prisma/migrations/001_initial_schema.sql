-- Production-Grade PostgreSQL Schema for Khaacho Platform
-- Optimized for 2000 concurrent users with immutable financial records

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- Create enums
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VENDOR', 'RETAILER');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'FAILED');
CREATE TYPE "TransactionType" AS ENUM ('ORDER_CREDIT', 'PAYMENT_DEBIT', 'REFUND_DEBIT', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'INTEREST_CREDIT');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'CREDIT');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'PAYMENT', 'REFUND');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    role "UserRole" NOT NULL,
    business_name VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    password_hash VARCHAR(255) NOT NULL,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_active ON users(role, is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Vendors table
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_code VARCHAR(50) UNIQUE NOT NULL,
    business_license VARCHAR(100),
    tax_id VARCHAR(50) UNIQUE,
    gst_number VARCHAR(20),
    pan_number VARCHAR(20),
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(20),
    bank_name VARCHAR(100),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    total_sales DECIMAL(15,2) DEFAULT 0,
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,
    approved_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_vendors_code ON vendors(vendor_code);
CREATE INDEX idx_vendors_tax_id ON vendors(tax_id);
CREATE INDEX idx_vendors_approved ON vendors(is_approved, deleted_at);
CREATE INDEX idx_vendors_created_at ON vendors(created_at);

-- Retailers table
CREATE TABLE retailers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    retailer_code VARCHAR(50) UNIQUE NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    gst_number VARCHAR(20),
    pan_number VARCHAR(20),
    credit_score INT DEFAULT 500 CHECK (credit_score >= 300 AND credit_score <= 900),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    available_credit DECIMAL(15,2) DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(15,2) DEFAULT 0,
    outstanding_debt DECIMAL(15,2) DEFAULT 0,
    last_order_at TIMESTAMP,
    last_payment_at TIMESTAMP,
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,
    approved_by UUID,
    risk_category VARCHAR(20) DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_retailers_code ON retailers(retailer_code);
CREATE INDEX idx_retailers_credit_score ON retailers(credit_score);
CREATE INDEX idx_retailers_approved ON retailers(is_approved, deleted_at);
CREATE INDEX idx_retailers_last_order ON retailers(last_order_at);
CREATE INDEX idx_retailers_debt ON retailers(outstanding_debt);
CREATE INDEX idx_retailers_created_at ON retailers(created_at);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    sub_category VARCHAR(100),
    brand VARCHAR(100),
    unit VARCHAR(50) NOT NULL,
    hsn_code VARCHAR(20),
    barcode VARCHAR(50) UNIQUE,
    min_order_qty INT DEFAULT 1,
    max_order_qty INT,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_products_category ON products(category, sub_category);
CREATE INDEX idx_products_active ON products(is_active, deleted_at);
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Vendor Products table (junction with pricing)
CREATE TABLE vendor_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    vendor_price DECIMAL(12,2) NOT NULL,
    mrp DECIMAL(12,2) NOT NULL,
    discount DECIMAL(5,2) DEFAULT 0,
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 0,
    max_stock INT,
    lead_time_days INT DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    last_restocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(vendor_id, product_id)
);

CREATE INDEX idx_vendor_products_vendor ON vendor_products(vendor_id, is_available);
CREATE INDEX idx_vendor_products_product ON vendor_products(product_id);
CREATE INDEX idx_vendor_products_sku ON vendor_products(sku);
CREATE INDEX idx_vendor_products_stock ON vendor_products(stock);

-- Orders table (IMMUTABLE - no deletes)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    retailer_id UUID NOT NULL REFERENCES retailers(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    status "OrderStatus" DEFAULT 'PENDING',
    payment_status "PaymentStatus" DEFAULT 'PENDING',
    subtotal DECIMAL(15,2) NOT NULL,
    discount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    shipping_charges DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    due_amount DECIMAL(15,2) NOT NULL,
    credit_used DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    internal_notes TEXT,
    cancellation_reason TEXT,
    whatsapp_message_id VARCHAR(255),
    invoice_number VARCHAR(50) UNIQUE,
    invoice_url TEXT,
    expected_delivery TIMESTAMP,
    confirmed_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_orders_retailer_date ON orders(retailer_id, created_at DESC);
CREATE INDEX idx_orders_vendor_date ON orders(vendor_id, created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status, payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_delivered_at ON orders(delivered_at);
CREATE INDEX idx_orders_invoice ON orders(invoice_number);

-- Order Items table (IMMUTABLE - snapshots product data)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_created_at ON order_items(created_at);

-- Payments table (IMMUTABLE)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_method "PaymentMethod" NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    transaction_id VARCHAR(255) UNIQUE,
    bank_reference VARCHAR(255),
    cheque_number VARCHAR(50),
    cheque_date DATE,
    bank_name VARCHAR(100),
    notes TEXT,
    receipt_url TEXT,
    processed_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    is_reversed BOOLEAN DEFAULT false,
    reversed_at TIMESTAMP,
    reversed_by UUID,
    reversal_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX idx_payments_retailer_date ON payments(retailer_id, created_at DESC);
CREATE INDEX idx_payments_vendor_date ON payments(vendor_id, created_at DESC);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_number ON payments(payment_number);
CREATE INDEX idx_payments_transaction ON payments(transaction_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_reversed ON payments(is_reversed);

-- Credit Ledger table (IMMUTABLE - append only)
CREATE TABLE credit_ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_number VARCHAR(50) UNIQUE NOT NULL,
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
    payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
    transaction_type "TransactionType" NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
    running_balance DECIMAL(15,2) NOT NULL,
    previous_balance DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    due_date DATE,
    is_reversed BOOLEAN DEFAULT false,
    reversed_by UUID,
    reversal_ledger_id UUID,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX idx_ledger_retailer_date ON credit_ledgers(retailer_id, created_at DESC);
CREATE INDEX idx_ledger_vendor_date ON credit_ledgers(vendor_id, created_at DESC);
CREATE INDEX idx_ledger_order ON credit_ledgers(order_id);
CREATE INDEX idx_ledger_payment ON credit_ledgers(payment_id);
CREATE INDEX idx_ledger_number ON credit_ledgers(ledger_number);
CREATE INDEX idx_ledger_type ON credit_ledgers(transaction_type);
CREATE INDEX idx_ledger_created_at ON credit_ledgers(created_at DESC);
CREATE INDEX idx_ledger_reversed ON credit_ledgers(is_reversed);
CREATE INDEX idx_ledger_due_date ON credit_ledgers(due_date);

-- WhatsApp Messages table
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    conversation_id VARCHAR(255),
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    body TEXT,
    media_url TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    order_id UUID,
    retailer_id UUID,
    vendor_id UUID,
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_whatsapp_from_date ON whatsapp_messages(from_number, created_at DESC);
CREATE INDEX idx_whatsapp_to_date ON whatsapp_messages(to_number, created_at DESC);
CREATE INDEX idx_whatsapp_message_id ON whatsapp_messages(message_id);
CREATE INDEX idx_whatsapp_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_order ON whatsapp_messages(order_id);
CREATE INDEX idx_whatsapp_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_processed ON whatsapp_messages(is_processed);
CREATE INDEX idx_whatsapp_created_at ON whatsapp_messages(created_at DESC);

-- Audit Logs table (IMMUTABLE)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action "AuditAction" NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user_date ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- Partitioning for audit_logs (monthly partitions for performance)
-- CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
-- FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retailers_updated_at BEFORE UPDATE ON retailers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_products_updated_at BEFORE UPDATE ON vendor_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_messages_updated_at BEFORE UPDATE ON whatsapp_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
