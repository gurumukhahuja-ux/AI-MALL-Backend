import express from 'express';
import fs from 'fs';
import DashboardMessage from '../models/DashboardMessage.js';
import User from '../models/User.js';

const router = express.Router();

// @desc    Store a message log (Admin -> Vendor or Vendor -> Admin)
// @route   POST /api/dashboard-messages
// @access  Public (or Protected depending on implementation, made public-ish for simplicity with frontend checks)
router.post('/', async (req, res) => {
    try {
        const { senderType, senderId, recipientType, recipientId, subject, message, senderName, senderEmail } = req.body;

        const newMessage = await DashboardMessage.create({
            senderType,
            senderId: senderId || null,
            recipientType,
            recipientId: recipientId || null,
            subject,
            message,
            metaData: {
                senderName,
                senderEmail
            }
        });

        res.status(201).json({ success: true, data: newMessage });
    } catch (error) {
        console.error('Error creating dashboard message:', error);
        res.status(500).json({ success: false, error: 'Failed to log message' });
    }
});

// @desc    Get messages for a specific vendor (received from Admin)
// @route   GET /api/dashboard-messages/vendor/:vendorId
// @access  Public/Protected
router.get('/vendor/:vendorId', async (req, res) => {
    try {
        const { vendorId } = req.params;
        const logMsg = `[${new Date().toISOString()}] Fetching messages for vendorId: '${vendorId}'\n`;
        fs.appendFileSync('g:/AI_MALL/debug_msg_log.txt', logMsg);

        // Detailed check
        // const allMsgs = await DashboardMessage.find({ recipientType: 'Vendor' });
        // console.log(`[DEBUG] Total vendor messages in DB: ${allMsgs.length}`);
        // allMsgs.forEach(m => console.log(` - Msg for: '${m.recipientId}'`));

        const messages = await DashboardMessage.find({
            recipientType: 'Vendor',
            recipientId: vendorId
        }).sort({ createdAt: -1 });

        fs.appendFileSync('g:/AI_MALL/debug_msg_log.txt', `[${new Date().toISOString()}] Found ${messages.length} messages.\n`);

        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Error fetching vendor messages:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
});

export default router;
