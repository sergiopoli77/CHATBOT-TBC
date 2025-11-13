const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../controllers/chatbot.controller');

// Add webhook routes
// GET route for webhook verification
router.get('/webhook', (req, res) => {
    console.log('🔍 Webhook verification request received');
    res.status(200).json({
        status: true,
        message: 'Webhook endpoint is active'
    });
});

// POST route for handling incoming messages
router.post('/webhook', async (req, res, next) => {
    console.log('🔔 Webhook received at:', new Date().toISOString());
    console.log('📍 URL:', req.originalUrl);
    console.log('📝 Method:', req.method);
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    console.log('🔑 Headers:', JSON.stringify(req.headers, null, 2));
    
    try {
        await handleIncomingMessage(req, res);
    } catch (error) {
        console.error('❌ Webhook error:', error);
        next(error);
    }
});

module.exports = router;
