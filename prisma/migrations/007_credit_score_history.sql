-- Migration: Credit Score History
-- Description: Create credit score history table with automatic score calculation triggers
-- Date: 2026-02-06

-- Create credit_score_history table
CREATE TABLE IF NOT EXISTS credit_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id UUID NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 300 AND score <= 900),
    
    -- Component scores
    payment_timeliness_score INTEGER NOT NULL,
    order_consistency_score INTEGER NOT NULL,
    credit_utilization_score INTEGER NOT NULL,
    account_age_score INTEGER NOT NULL,
    dispute_rate_score INTEGER NOT NULL,
    
    -- Detailed breakdown (JSON)
    breakdown JSONB NOT NULL,
    explanation JSONB NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_credit_score_history_retailer_date ON credit_score_history(retailer_id, created_at DESC);
CREATE INDEX idx_credit_score_history_score ON credit_score_history(score);
CREATE INDEX idx_credit_score_history_created_at ON credit_score_history(created_at DESC);

-- Prevent manual editing of credit scores
-- Trigger to prevent UPDATE on credit_score_history
CREATE OR REPLACE FUNCTION prevent_credit_score_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Credit score history cannot be modified. Create a new entry instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_credit_score_update
BEFORE UPDATE ON credit_score_history
FOR EACH ROW
EXECUTE FUNCTION prevent_credit_score_update();

-- Trigger to prevent DELETE on credit_score_history
CREATE OR REPLACE FUNCTION prevent_credit_score_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Credit score history cannot be deleted. This is an immutable audit record.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_credit_score_delete
BEFORE DELETE ON credit_score_history
FOR EACH ROW
EXECUTE FUNCTION prevent_credit_score_delete();

-- Add comment
COMMENT ON TABLE credit_score_history IS 'Immutable history of retailer credit scores (300-900 range). Scores are calculated automatically and cannot be manually edited.';
COMMENT ON COLUMN credit_score_history.score IS 'Final credit score (300-900)';
COMMENT ON COLUMN credit_score_history.payment_timeliness_score IS 'Payment timeliness component score (40% weight)';
COMMENT ON COLUMN credit_score_history.order_consistency_score IS 'Order consistency component score (20% weight)';
COMMENT ON COLUMN credit_score_history.credit_utilization_score IS 'Credit utilization component score (20% weight)';
COMMENT ON COLUMN credit_score_history.account_age_score IS 'Account age component score (10% weight)';
COMMENT ON COLUMN credit_score_history.dispute_rate_score IS 'Dispute/cancellation rate component score (10% weight)';
COMMENT ON COLUMN credit_score_history.breakdown IS 'Detailed breakdown of each scoring component with reasons';
COMMENT ON COLUMN credit_score_history.explanation IS 'Human-readable explanation of the score';
