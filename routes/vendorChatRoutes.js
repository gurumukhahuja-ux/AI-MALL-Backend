import express from 'express';
import VendorChat from '../models/VendorChat.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// User: Get or Create a chat session with a vendor
router.get('/my-chats', verifyToken, async (req, res) => {
    try {
        const chats = await VendorChat.find({ userId: req.user.id, status: 'active' })
            .populate('vendorId', 'name email avatar')
            .populate('agentId', 'agentName')
            .sort({ lastMessageAt: -1 });

        console.log(`[VendorChat] User ${req.user.email || req.user.id} has ${chats.length} active chats`);
        res.json(chats);
    } catch (error) {
        console.error(`[VendorChat] MyChats Error:`, error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// Vendor: Get all active chats for this vendor
router.get('/vendor/active', verifyToken, async (req, res) => {
    console.log(`[VendorChat] Vendor Active request from: ${req.user.email || req.user.id}`);

    try {
        const chats = await VendorChat.find({ vendorId: req.user.id, status: 'active' })
            .populate('userId', 'name email avatar')
            .populate('agentId', 'agentName')
            .sort({ lastMessageAt: -1 });

        console.log(`[VendorChat] Found ${chats.length} active chats for vendor`);
        res.json(chats);
    } catch (error) {
        console.error(`[VendorChat] Vendor Active Error:`, error);
        res.status(500).json({ error: 'Failed to fetch active chats' });
    }
});

// User: Send initial message to vendor (or continue existing chat)
router.post('/message', verifyToken, async (req, res) => {
    const { vendorId, agentId, text } = req.body;
    const userId = req.user.id;

    if (!text || !vendorId) {
        return res.status(400).json({ error: 'Text and vendorId are required' });
    }

    console.log(`[VendorChat] User ${userId} messaging Vendor ${vendorId} about Agent ${agentId}: "${text}"`);

    try {
        let chat = await VendorChat.findOne({
            userId,
            vendorId,
            agentId: agentId || null,
            status: 'active'
        });

        if (!chat) {
            console.log(`[VendorChat] Creating NEW chat session`);
            chat = new VendorChat({
                userId,
                vendorId,
                agentId: agentId || null,
                messages: [{ senderId: userId, text }]
            });
        } else {
            chat.messages.push({ senderId: userId, text });
            chat.lastMessageAt = Date.now();
        }

        await chat.save();
        console.log(`[VendorChat] Message saved. Chat ID: ${chat._id}`);
        res.status(201).json(chat);
    } catch (error) {
        console.error(`[VendorChat] Send Message Error:`, error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Send a message in an existing chat
router.post('/:chatId/message', verifyToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Message text is required' });

        console.log(`[VendorChat] Message from ${req.user.role || 'user'} (${req.user.email || req.user.id}) to Chat ${req.params.chatId}: "${text}"`);

        const chat = await VendorChat.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        // Security check: Only user or vendor can message
        if (chat.userId.toString() !== req.user.id && chat.vendorId.toString() !== req.user.id) {
            console.log(`[VendorChat] Unauthorized message attempt by ${req.user.id}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const newMessage = {
            senderId: req.user.id,
            text,
            timestamp: new Date(),
            isRead: false
        };

        chat.messages.push(newMessage);
        chat.lastMessageAt = new Date();

        await chat.save();
        console.log(`[VendorChat] Message appended successfully.`);
        res.json(chat);
    } catch (error) {
        console.error(`[VendorChat] SendMsg Error:`, error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Close a chat
router.post('/:chatId/close', verifyToken, async (req, res) => {
    try {
        const chat = await VendorChat.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        // Only vendor or user in the chat can close it
        if (chat.userId.toString() !== req.user.id && chat.vendorId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        chat.status = 'closed';
        await chat.save();

        console.log(`[VendorChat] Chat ${req.params.chatId} closed by ${req.user.email || req.user.id}`);
        res.json({ message: 'Chat closed successfully' });
    } catch (error) {
        console.error(`[VendorChat] Close Error:`, error);
        res.status(500).json({ error: 'Failed to close chat' });
    }
});

export default router;
