-- Migration: WhatsApp Automation Enhancement
-- Description: Event-driven WhatsApp messaging system

-- WhatsApp Message Templates Table
CREATE TABLE IF NOT EXISTS whatsapp_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL UNIQUE,
    template_type VARCHAR(50) NOT NULL, -- order_confirmation, vendor_notification, delivery_update, payment_reminder, balance_inquiry
    
    -- Template content
    message_text TEXT NOT NULL,
    variables JSONB, -- Template variables like {order_number}, {amount}, etc.
    
    -- Conditions
    trigger_event VARCHAR(100) NOT NULL, -- order_created, order_confirmed, order_dispatched, etc.
    recipient_type VARCHAR(20) NOT NULL, -- retailer, vendor, admin
    
    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    send_delay_minutes INTEGER DEFAULT 0, -- Delay before sending
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- WhatsApp Automation Queue Table
CREATE TABLE IF NOT EXISTS whatsapp_automation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Message details
    template_id UUID NOT NULL REFERENCES whatsapp_message_templates(id),
    recipient_phone VARCHAR(20) NOT NULL,
    recipient_type VARCHAR(20) NOT NULL, -- retailer, vendor, admin
    recipient_id UUID, -- User ID
    
    -- Message content
    message_text TEXT NOT NULL,
    template_variables JSONB,
    
    -- Related entities
    order_id UUID,
    retailer_id UUID,
    vendor_id UUID,
    
    -- Queue status
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, FAILED, CANCELLED
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    
    -- Scheduling
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    
    -- Response tracking
    whatsapp_message_id VARCHAR(255),
    delivery_status VARCHAR(20), -- sent, delivered, read, failed
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Automation Events Table
CREATE TABLE IF NOT EXISTS whatsapp_automation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    
    -- Related entities
    order_id UUID,
    retailer_id UUID,
    vendor_id UUID,
    user_id UUID,
    
    -- Processing status
    is_processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    
    -- Messages triggered
    messages_queued INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Balance Inquiry Log
CREATE TABLE IF NOT EXISTS whatsapp_balance_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Inquiry details
    retailer_id UUID NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    
    -- Balance info at time of inquiry
    outstanding_balance DECIMAL(15,2) NOT NULL,
    available_credit DECIMAL(15,2) NOT NULL,
    credit_limit DECIMAL(15,2) NOT NULL,
    
    -- Response
    response_sent BOOLEAN DEFAULT FALSE,
    response_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Payment Reminders Table
CREATE TABLE IF NOT EXISTS whatsapp_payment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reminder details
    retailer_id UUID NOT NULL,
    order_id UUID,
    
    -- Payment info
    overdue_amount DECIMAL(15,2) NOT NULL,
    days_overdue INTEGER NOT NULL,
    due_date DATE NOT NULL,
    
    -- Reminder settings
    reminder_type VARCHAR(20) NOT NULL, -- gentle, urgent, final
    reminder_sequence INTEGER DEFAULT 1, -- 1st, 2nd, 3rd reminder
    
    -- Status
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    
    -- Next reminder
    next_reminder_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_whatsapp_templates_type ON whatsapp_message_templates(template_type);
CREATE INDEX idx_whatsapp_templates_event ON whatsapp_message_templates(trigger_event);
CREATE INDEX idx_whatsapp_templates_active ON whatsapp_message_templates(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_whatsapp_queue_status ON whatsapp_automation_queue(status);
CREATE INDEX idx_whatsapp_queue_scheduled ON whatsapp_automation_queue(scheduled_at);
CREATE INDEX idx_whatsapp_queue_retry ON whatsapp_automation_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_whatsapp_queue_recipient ON whatsapp_automation_queue(recipient_phone);
CREATE INDEX idx_whatsapp_queue_order ON whatsapp_automation_queue(order_id);

CREATE INDEX idx_whatsapp_events_type ON whatsapp_automation_events(event_type);
CREATE INDEX idx_whatsapp_events_processed ON whatsapp_automation_events(is_processed, created_at);
CREATE INDEX idx_whatsapp_events_order ON whatsapp_automation_events(order_id);

CREATE INDEX idx_balance_inquiries_retailer ON whatsapp_balance_inquiries(retailer_id);
CREATE INDEX idx_balance_inquiries_phone ON whatsapp_balance_inquiries(phone_number);
CREATE INDEX idx_balance_inquiries_created ON whatsapp_balance_inquiries(created_at DESC);

CREATE INDEX idx_payment_reminders_retailer ON whatsapp_payment_reminders(retailer_id);
CREATE INDEX idx_payment_reminders_order ON whatsapp_payment_reminders(order_id);
CREATE INDEX idx_payment_reminders_due ON whatsapp_payment_reminders(due_date);
CREATE INDEX idx_payment_reminders_next ON whatsapp_payment_reminders(next_reminder_date);

-- Function to process template variables
CREATE OR REPLACE FUNCTION process_whatsapp_template(
    p_template_text TEXT,
    p_variables JSONB
) RETURNS TEXT AS $$
DECLARE
    v_result TEXT;
    v_key TEXT;
    v_value TEXT;
BEGIN
    v_result := p_template_text;
    
    -- Replace each variable in the template
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
    LOOP
        v_result := REPLACE(v_result, '{' || v_key || '}', v_value);
    END LOOP;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to queue WhatsApp message
CREATE OR REPLACE FUNCTION queue_whatsapp_message(
    p_template_name VARCHAR(100),
    p_recipient_phone VARCHAR(20),
    p_recipient_type VARCHAR(20),
    p_recipient_id UUID,
    p_variables JSONB DEFAULT '{}',
    p_order_id UUID DEFAULT NULL,
    p_retailer_id UUID DEFAULT NULL,
    p_vendor_id UUID DEFAULT NULL,
    p_priority INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    v_template RECORD;
    v_message_text TEXT;
    v_queue_id UUID;
    v_scheduled_at TIMESTAMP;
BEGIN
    -- Get template
    SELECT * INTO v_template
    FROM whatsapp_message_templates
    WHERE template_name = p_template_name
    AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found: %', p_template_name;
    END IF;
    
    -- Process template variables
    v_message_text := process_whatsapp_template(v_template.message_text, p_variables);
    
    -- Calculate scheduled time
    v_scheduled_at := CURRENT_TIMESTAMP + (v_template.send_delay_minutes || ' minutes')::INTERVAL;
    
    -- Insert into queue
    INSERT INTO whatsapp_automation_queue (
        template_id,
        recipient_phone,
        recipient_type,
        recipient_id,
        message_text,
        template_variables,
        order_id,
        retailer_id,
        vendor_id,
        priority,
        scheduled_at
    ) VALUES (
        v_template.id,
        p_recipient_phone,
        p_recipient_type,
        p_recipient_id,
        v_message_text,
        p_variables,
        p_order_id,
        p_retailer_id,
        p_vendor_id,
        p_priority,
        v_scheduled_at
    ) RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function to trigger WhatsApp automation events
CREATE OR REPLACE FUNCTION trigger_whatsapp_automation(
    p_event_type VARCHAR(100),
    p_event_data JSONB,
    p_order_id UUID DEFAULT NULL,
    p_retailer_id UUID DEFAULT NULL,
    p_vendor_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_template RECORD;
    v_messages_queued INTEGER := 0;
    v_recipient_phone VARCHAR(20);
    v_recipient_id UUID;
    v_queue_id UUID;
BEGIN
    -- Insert event
    INSERT INTO whatsapp_automation_events (
        event_type,
        event_data,
        order_id,
        retailer_id,
        vendor_id,
        user_id
    ) VALUES (
        p_event_type,
        p_event_data,
        p_order_id,
        p_retailer_id,
        p_vendor_id,
        p_user_id
    ) RETURNING id INTO v_event_id;
    
    -- Find matching templates
    FOR v_template IN 
        SELECT * FROM whatsapp_message_templates
        WHERE trigger_event = p_event_type
        AND is_active = TRUE
    LOOP
        -- Determine recipient based on template recipient type
        IF v_template.recipient_type = 'retailer' AND p_retailer_id IS NOT NULL THEN
            SELECT u.phone_number, r.id
            INTO v_recipient_phone, v_recipient_id
            FROM retailers r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = p_retailer_id;
            
        ELSIF v_template.recipient_type = 'vendor' AND p_vendor_id IS NOT NULL THEN
            SELECT u.phone_number, v.id
            INTO v_recipient_phone, v_recipient_id
            FROM vendors v
            JOIN users u ON v.user_id = u.id
            WHERE v.id = p_vendor_id;
            
        ELSIF v_template.recipient_type = 'admin' THEN
            -- Get first admin user
            SELECT phone_number, id
            INTO v_recipient_phone, v_recipient_id
            FROM users
            WHERE role = 'ADMIN'
            AND is_active = TRUE
            LIMIT 1;
        END IF;
        
        -- Queue message if recipient found
        IF v_recipient_phone IS NOT NULL THEN
            v_queue_id := queue_whatsapp_message(
                v_template.template_name,
                v_recipient_phone,
                v_template.recipient_type,
                v_recipient_id,
                p_event_data,
                p_order_id,
                p_retailer_id,
                p_vendor_id,
                5 -- default priority
            );
            
            IF v_queue_id IS NOT NULL THEN
                v_messages_queued := v_messages_queued + 1;
            END IF;
        END IF;
    END LOOP;
    
    -- Update event with messages queued count
    UPDATE whatsapp_automation_events
    SET messages_queued = v_messages_queued,
        is_processed = TRUE,
        processed_at = CURRENT_TIMESTAMP
    WHERE id = v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default message templates
INSERT INTO whatsapp_message_templates (template_name, template_type, message_text, variables, trigger_event, recipient_type) VALUES

-- Order Confirmation Templates
('order_confirmation_retailer', 'order_confirmation', 
'✅ Order Confirmed!

Order #: {order_number}
Total: Rs. {total_amount}
Items: {item_count}
Vendor: {vendor_name}

Expected delivery: {expected_delivery}

Thank you for your order! 🙏', 
'{"order_number": "", "total_amount": "", "item_count": "", "vendor_name": "", "expected_delivery": ""}',
'order_confirmed', 'retailer'),

('order_notification_vendor', 'vendor_notification',
'🔔 New Order Assigned!

Order #: {order_number}
Retailer: {retailer_name}
Total: Rs. {total_amount}
Items: {item_count}

Please confirm acceptance within 2 hours.

View details: {order_link}', 
'{"order_number": "", "retailer_name": "", "total_amount": "", "item_count": "", "order_link": ""}',
'order_assigned_to_vendor', 'vendor'),

-- Delivery Status Templates
('order_dispatched_retailer', 'delivery_update',
'🚚 Order Dispatched!

Order #: {order_number}
Dispatched by: {vendor_name}
Expected delivery: {expected_delivery}

Your order is on the way! 📦', 
'{"order_number": "", "vendor_name": "", "expected_delivery": ""}',
'order_dispatched', 'retailer'),

('order_delivered_retailer', 'delivery_update',
'✅ Order Delivered!

Order #: {order_number}
Delivered at: {delivery_time}
Total: Rs. {total_amount}

Thank you for choosing Khaacho! 🎉

Rate your experience: {rating_link}', 
'{"order_number": "", "delivery_time": "", "total_amount": "", "rating_link": ""}',
'order_delivered', 'retailer'),

-- Payment Reminder Templates
('payment_reminder_gentle', 'payment_reminder',
'💰 Payment Reminder

Hi {retailer_name},

Your payment of Rs. {overdue_amount} for Order #{order_number} was due on {due_date}.

Please make payment at your earliest convenience.

Outstanding balance: Rs. {outstanding_balance}

Pay now: {payment_link}', 
'{"retailer_name": "", "overdue_amount": "", "order_number": "", "due_date": "", "outstanding_balance": "", "payment_link": ""}',
'payment_overdue_gentle', 'retailer'),

('payment_reminder_urgent', 'payment_reminder',
'⚠️ URGENT: Payment Overdue

Hi {retailer_name},

Your payment of Rs. {overdue_amount} is now {days_overdue} days overdue.

Order #{order_number}
Due date: {due_date}
Outstanding balance: Rs. {outstanding_balance}

Please pay immediately to avoid service suspension.

Pay now: {payment_link}', 
'{"retailer_name": "", "overdue_amount": "", "days_overdue": "", "order_number": "", "due_date": "", "outstanding_balance": "", "payment_link": ""}',
'payment_overdue_urgent', 'retailer'),

-- Balance Inquiry Response Template
('balance_inquiry_response', 'balance_inquiry',
'💳 Account Balance

Hi {retailer_name},

Credit Limit: Rs. {credit_limit}
Available Credit: Rs. {available_credit}
Outstanding Balance: Rs. {outstanding_balance}
Utilization: {utilization_percent}%

Last updated: {current_time}

Need help? Contact support: {support_phone}', 
'{"retailer_name": "", "credit_limit": "", "available_credit": "", "outstanding_balance": "", "utilization_percent": "", "current_time": "", "support_phone": ""}',
'balance_inquiry_request', 'retailer');

-- Comments
COMMENT ON TABLE whatsapp_message_templates IS 'Templates for automated WhatsApp messages';
COMMENT ON TABLE whatsapp_automation_queue IS 'Queue for outgoing WhatsApp messages';
COMMENT ON TABLE whatsapp_automation_events IS 'Log of events that trigger WhatsApp automation';
COMMENT ON TABLE whatsapp_balance_inquiries IS 'Log of balance inquiries via WhatsApp';
COMMENT ON TABLE whatsapp_payment_reminders IS 'Payment reminder tracking';
COMMENT ON FUNCTION process_whatsapp_template IS 'Processes template variables in WhatsApp messages';
COMMENT ON FUNCTION queue_whatsapp_message IS 'Queues a WhatsApp message for sending';
COMMENT ON FUNCTION trigger_whatsapp_automation IS 'Triggers WhatsApp automation based on events';