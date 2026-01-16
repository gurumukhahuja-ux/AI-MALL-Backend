import express from 'express';
import VendorMessage from '../models/VendorMessage.js';
import Agent from '../models/Agents.js';
import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/authorization.js';
import { sendVendorContactEmail } from '../services/emailService.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter: 5 messages per 15 minutes per IP
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many contact requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// POST /api/messages/contact-vendor - Submit new message from user or admin
router.post('/contact-vendor', contactLimiter, async (req, res) => {
    try {
        const { agentId, userName, userEmail, subject, message, userId, senderType } = req.body;

        const isSystemAdmin = senderType === 'Admin' || userEmail === 'admin@aimall.com';

        // Validate required fields
        if (!agentId || !userName || !userEmail || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate email format (skip for system admin if using a placeholder or trusted source)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!isSystemAdmin && !emailRegex.test(userEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        // Fetch agent details
        const agent = await Agent.findById(agentId).populate('owner', 'name email');
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }

        if (!agent.owner) {
            return res.status(400).json({
                success: false,
                message: 'Agent has no associated vendor'
            });
        }

        // Create message record
        const vendorMessage = new VendorMessage({
            userId: userId || null,
            vendorId: agent.owner._id,
            agentId: agent._id,
            userName: userName.trim(),
            userEmail: userEmail.trim().toLowerCase(),
            subject: subject.trim(),
            message: message.trim(),
            agentName: agent.agentName,
            vendorEmail: agent.owner.email,
            status: 'New',
            senderType: senderType || 'User'
        });

        await vendorMessage.save();
        console.log(`[CONTACT VENDOR] Message from ${senderType || 'User'} (${userEmail}) saved for vendor ${agent.owner.email}`);

        // Send email notification to vendor
        try {
            await sendVendorContactEmail({
                vendorEmail: agent.owner.email,
                vendorName: agent.owner.name,
                userName: userName.trim(),
                userEmail: userEmail.trim(),
                agentName: agent.agentName,
                subject: subject.trim(),
                message: message.trim()
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail the request if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Your message has been sent to the vendor successfully',
            data: {
                messageId: vendorMessage._id
            }
        });

    } catch (error) {
        console.error('Contact vendor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message. Please try again later.'
        });
    }
});

// GET /api/messages/vendor/:vendorId - Fetch all messages for vendor
router.get('/vendor/:vendorId', async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { status, agentId, page = 1, limit = 50 } = req.query;

        // Build query
        const query = { vendorId };

        if (status && status !== 'all') {
            query.status = status;
        }

        if (agentId && agentId !== 'all') {
            query.agentId = agentId;
        }

        // Fetch messages with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const messages = await VendorMessage.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await VendorMessage.countDocuments(query);

        res.json({
            success: true,
            data: {
                messages,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Fetch vendor messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
});

// PATCH /api/messages/:messageId/status - Update message status
router.patch('/:messageId/status', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { status } = req.body;

        if (!['New', 'Replied', 'Closed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }

        const message = await VendorMessage.findByIdAndUpdate(
            messageId,
            { status },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.json({
            success: true,
            message: 'Status updated successfully',
            data: message
        });

    } catch (error) {
        console.error('Update message status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update status'
        });
    }
});

// POST /api/messages/send-reply - Send reply from vendor to user
router.post('/send-reply', async (req, res) => {
    try {
        const { messageId, userEmail, userName, vendorName, agentName, originalSubject, originalMessage, replyMessage } = req.body;

        if (!userEmail || !replyMessage) {
            return res.status(400).json({
                success: false,
                message: 'User email and reply message are required'
            });
        }

        // Find original message
        const originalMsg = await VendorMessage.findById(messageId);

        let emailSent = false;

        // Try to send email, but don't block on failure
        try {
            if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
                const nodemailer = await import('nodemailer');
                const transporter = nodemailer.default.createTransporter({
                    service: process.env.EMAIL_SERVICE || 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: userEmail,
                    subject: `RE: ${originalSubject}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="color: white; margin: 0;">AI-MALL</h1>
                                <p style="color: #f0f0f0; margin: 5px 0 0 0;">Vendor Response</p>
                            </div>
                            <div style="padding: 30px; background: #f9fafb;">
                                <h2 style="color: #1e293b; margin-top: 0;">Hello ${userName},</h2>
                                <p style="color: #475569; margin-bottom: 20px;">${vendorName} has responded to your inquiry about <strong>${agentName}</strong>.</p>
                                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                    <h3 style="color: #1e293b; margin-top: 0;">Vendor's Response:</h3>
                                    <p style="color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${replyMessage}</p>
                                </div>
                                <div style="background: #e0e7ff; padding: 15px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
                                    <p style="margin: 0; color: #3730a3; font-size: 14px;"><strong>Your Original Message:</strong></p>
                                    <p style="margin: 10px 0 0 0; color: #475569;">${originalMessage}</p>
                                </div>
                            </div>
                            <div style="background: #f1f5f9; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; color: #64748b; font-size: 12px;">
                                <p style="margin: 0;">AI-MALL Platform</p>
                            </div>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                emailSent = true;
            } else {
                console.warn("EMAIL_USER or EMAIL_PASSWORD missing. Skipping email send.");
            }
        } catch (emailError) {
            console.error("Failed to send email reply (non-fatal):", emailError);
            // Continue execution to update DB
        }

        // Update Status to Replied
        if (originalMsg) {
            originalMsg.status = 'Replied';
            originalMsg.replyMessage = replyMessage;
            originalMsg.repliedAt = new Date();
            await originalMsg.save();

            // Create In-App Notification for User
            if (originalMsg.userId) {
                try {
                    const Notification = (await import('../models/Notification.js')).default;
                    await Notification.create({
                        userId: originalMsg.userId,
                        message: `New Message: ${vendorName} replied regarding '${agentName}'.`,
                        type: 'info',
                        role: 'user',
                        targetId: messageId
                    });
                } catch (notifError) {
                    console.error("Failed to create notification:", notifError);
                }
            }
        }

        res.json({
            success: true,
            message: emailSent ? 'Reply sent successfully via email' : 'Reply saved successfully (Email skipped)',
            warning: !emailSent ? 'Email configuration missing or failed' : undefined
        });

    } catch (error) {
        console.error('Send reply fatal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process reply'
        });
    }
});

// GET /api/messages/:id - Fetch single message details
router.get('/:id', async (req, res) => {
    try {
        const message = await VendorMessage.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }
        res.json({ success: true, data: message });
    } catch (error) {
        console.error('Fetch message error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/messages/admin-direct - Admin directly contacts a vendor
router.post('/admin-direct', verifyToken, async (req, res) => {
    try {
        const { vendorId, subject, message } = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
        }

        if (!vendorId || !subject || !message) {
            return res.status(400).json({ success: false, message: 'VendorId, subject and message are required' });
        }

        // 1. Create In-App Notification for Vendor
        await Notification.create({
            userId: vendorId,
            title: `Message from Admin: ${subject}`,
            message: message,
            type: 'info',
            role: 'vendor'
        });

        // 2. Opt-in: Send email in background if possible
        // (Reusing logic from send-reply or similar if needed, keeping it simple for now)

        res.json({
            success: true,
            message: 'Message sent to vendor successfully'
        });

    } catch (error) {
        console.error('Admin direct message error:', error);
        res.status(500).json({ success: false, message: 'Failed to send direct message' });
    }
});

export default router;
