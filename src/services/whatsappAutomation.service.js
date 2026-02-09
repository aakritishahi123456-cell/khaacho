const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class WhatsAppAutomationService {
  /**
   * Trigger WhatsApp automation event
   */
  async triggerEvent(eventType, eventData, options = {}) {
    try {
      const {
        orderId,
        retailerId,
        vendorId,
        userId,
      } = options;

      const result = await prisma.$queryRawUnsafe(
        `SELECT trigger_whatsapp_automation($1, $2::jsonb, $3::uuid, $4