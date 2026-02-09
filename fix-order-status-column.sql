-- Add status column back to orders table
ALTER TABLE orders ADD COLUMN status "OrderStatus" DEFAULT 'DRAFT';
