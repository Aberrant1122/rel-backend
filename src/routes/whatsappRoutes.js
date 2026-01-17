const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Webhook verification (GET) and message receiving (POST)
router.get('/webhook/whatsapp', whatsappController.verifyWebhook);
router.post('/webhook/whatsapp', whatsappController.receiveMessage);

// Send WhatsApp message
router.post('/whatsapp/send', whatsappController.sendMessage);

// Lead management endpoints
router.get('/leads', whatsappController.getLeads);
router.get('/leads/:id', whatsappController.getLeadDetails);

module.exports = router;
