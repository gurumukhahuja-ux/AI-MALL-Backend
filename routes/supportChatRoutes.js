import express from 'express';
import SupportChat from '../models/SupportChat.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/authorization.js';

const router = express.Router();

// Get or Create a chat session for a user
router.get('/my-chat', verifyToken, async (req, res) => {
    try {
        const { chatType } = req.query; // 'user_support' or 'vendor_support'
        const type = chatType || 'user_support';

        let chat = await SupportChat.findOne({
            userId: req.user.id,
            status: 'active',
            chatType: type
        });

        if (!chat) {
            console.log(`[SupportChat] Creating NEW ${type} session for User: ${req.user.email || req.user.id}`);
            chat = new SupportChat({
                userId: req.user.id,
                chatType: type
            });
            await chat.save();
        }

        res.json(chat);
    } catch (error) {
        console.error(`[SupportChat] MyChat Error:`, error);
        res.status(500).json({ error: 'Failed to fetch chat' });
    }
});

// Admin: Get all chats (History)
router.get('/admin/active', verifyToken, async (req, res) => {
    console.log(`[SupportChat] Admin History request from: ${req.user.email || req.user.id}`);
    if (req.user.role?.toLowerCase() !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        // Fetch ALL chats regardless of status, sorted by most recent message
        const chats = await SupportChat.find({})
            .populate('userId', 'name email avatar')
            .sort({ lastMessageAt: -1 });

        console.log(`[SupportChat] Found ${chats.length} total chats in history`);
        res.json(chats);
    } catch (error) {
        console.error(`[SupportChat] Fetch History Error:`, error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

// Send a message in a chat
router.post('/:chatId/message', verifyToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Message text is required' });

        console.log(`[SupportChat] Msg from ${req.user.role} (${req.user.email || req.user.id}) to Chat ${req.params.chatId}: "${text}"`);

        const chat = await SupportChat.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        // Security check: Only user or admin can message
        if (chat.userId.toString() !== req.user.id && req.user.role?.toLowerCase() !== 'admin') {
            console.log(`[SupportChat] Unauthorized message attempt by ${req.user.id}`);
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

        const isAdmin = req.user.role?.toLowerCase() === 'admin';

        if (isAdmin) {
            chat.adminId = req.user.id;
        }

        await chat.save();
        console.log(`[SupportChat] Message appended successfully.`);

        // --- Notification Logic ---
        try {
            if (isAdmin) {
                // Admin replied -> Notify User
                const notification = new Notification({
                    userId: chat.userId, // The user who owns the chat
                    title: 'New Support Reply',
                    message: `Admin replied: "${text}"`,
                    type: 'info',
                    role: 'user',
                    targetId: chat._id
                });
                await notification.save();
            } else {
                // User sent message -> Notify Admin(s)
                // Find all admins
                const admins = await User.find({ role: 'admin' }).select('_id');
                const notifications = admins.map(admin => ({
                    userId: admin._id,
                    title: 'New Support Inquiry',
                    message: `User (${req.user.name || 'User'}): "${text}"`,
                    type: 'info',
                    role: 'admin',
                    targetId: chat._id
                }));
                if (notifications.length > 0) {
                    await Notification.insertMany(notifications);
                }
            }
        } catch (notifErr) {
            console.error("[SupportChat] Notification failed:", notifErr);
            // Don't fail the request
        }

        res.json(chat);
    } catch (error) {
        console.error(`[SupportChat] SendMsg Error:`, error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Close a chat
router.post('/:chatId/close', verifyToken, async (req, res) => {
    try {
        const chat = await SupportChat.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        chat.status = 'closed';
        await chat.save();
        res.json({ message: 'Chat closed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to close chat' });
    }
});

export default router;
