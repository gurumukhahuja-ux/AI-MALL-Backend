import express from 'express';
import SupportTicket from '../models/SupportTicket.js';
import User from '../models/User.js';
import { sendContactAdminEmail } from '../utils/Email.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { email, senderName, issueType, message, userId, subject } = req.body;

        if (!email || !issueType || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newTicket = new SupportTicket({
            email,
            senderName: senderName || 'Guest User',
            issueType,
            message,
            subject: subject || 'No Subject',
            userId: userId || null
        });

        await newTicket.save();

        // If it's an Admin Support Request, try to email the admin
        if (issueType === 'AdminSupport') {
            try {
                // Find Admin Email
                const admin = await User.findOne({ role: 'admin' }).select('email');
                const adminEmail = admin ? admin.email : process.env.EMAIL; // Fallback to system email if no admin found

                const vendor = await User.findById(userId).select('name');
                const vendorName = vendor ? vendor.name : 'Vendor';

                await sendContactAdminEmail(adminEmail, vendorName, email, subject || issueType, message);
            } catch (emailErr) {
                console.error("Failed to trigger admin email:", emailErr);
                // Don't fail the request, just log it. The ticket is saved.
            }
        }

        res.status(201).json({ message: 'Support ticket created successfully', ticket: newTicket });
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Reply to a ticket
router.post('/:id/reply', async (req, res) => {
    try {
        const { id } = req.params;
        const { message, sender, senderId } = req.body;

        if (!message || !sender) {
            return res.status(400).json({ message: 'Message and sender are required' });
        }

        const ticket = await SupportTicket.findById(id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        ticket.replies.push({
            sender,
            message,
            senderId,
            createdAt: new Date()
        });

        ticket.updatedAt = new Date();

        // Auto-update status based on sender
        if (sender === 'admin' && ticket.status === 'open') {
            ticket.status = 'in_progress';
        } else if (sender === 'user' && ticket.status === 'resolved') {
            ticket.status = 'in_progress'; // Re-open if user replies
        }

        await ticket.save();
        res.json(ticket);
    } catch (error) {
        console.error("Error adding reply:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get tickets for a user (Vendor Support History)
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { type } = req.query;

        const query = { userId };
        if (type) {
            query.issueType = type;
        }

        const tickets = await SupportTicket.find(query).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching user tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// Admin: Get all tickets
router.get('/admin/all', async (req, res) => {
    try {
        const tickets = await SupportTicket.find().sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching all tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

export default router;
