import express from 'express';
import Report from '../models/Report.js';
import ReportMessage from '../models/ReportMessage.js';
import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/authorization.js';
import { sendAdminNotification, sendVendorReply } from '../services/emailService.js';

const router = express.Router();

// GET /api/reports (Admin only - fetch all reports)
router.get('/', verifyToken, async (req, res) => {
    try {
        // Find all reports, populate user details
        const reports = await Report.find()
            .populate('userId', 'name email')
            .sort({ timestamp: -1 });

        res.json(reports);
    } catch (err) {
        console.error('[FETCH REPORTS ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

<<<<<<< HEAD
// GET /api/reports/my-reports (User/Vendor fetches their own reports)
router.get('/my-reports', verifyToken, async (req, res) => {
=======
// GET /api/reports/me (Fetch reports for the logged-in user)
router.get('/me', verifyToken, async (req, res) => {
>>>>>>> ad13b78 (admin)
    try {
        const reports = await Report.find({ userId: req.user.id })
            .sort({ timestamp: -1 });
        res.json(reports);
    } catch (err) {
        console.error('[FETCH MY REPORTS ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch your reports' });
    }
});

// POST /api/reports/submit (User submits a report)
router.post('/submit', verifyToken, async (req, res) => {
    try {
        const { type, priority, description, targetId } = req.body;
        console.log('[DEBUG SUBMIT REPORT] Body:', req.body);
        console.log('[DEBUG SUBMIT REPORT] User:', req.user);

        const newReport = await Report.create({
            userId: req.user.id,
            type,
            priority,
            description,
            status: 'open',
            targetId // Optional: if reporting a specific app/agent
        });

        // Populate user details for email
        await newReport.populate('userId', 'name email');

        // Send email notification to admin
        const emailResult = await sendAdminNotification(newReport);
        console.log('[EMAIL NOTIFICATION]', emailResult.message);

        res.status(201).json(newReport);
    } catch (err) {
        console.error('[SUBMIT REPORT ERROR]', err);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// POST /api/reports/:id/reply (Admin sends email reply to vendor)
router.post('/:id/reply', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        const reportId = req.params.id;

        // Find report and populate user details
        const report = await Report.findById(reportId).populate('userId', 'name email');

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        if (!report.userId || !report.userId.email) {
            return res.status(400).json({ error: 'Vendor email not found' });
        }

        // Send email reply to vendor
        const emailResult = await sendVendorReply(
            report.userId.email,
            report.userId.name,
            message,
            reportId
        );

        if (!emailResult.success) {
            return res.status(500).json({ error: emailResult.message });
        }

        // Create notification for vendor
        await Notification.create({
            userId: report.userId._id,
            message: `Admin replied to your support ticket: "${message.substring(0, 50)}..."`,
            type: 'admin_directive',
            role: 'vendor',
            targetId: reportId
        });

        res.json({ success: true, message: 'Reply sent successfully' });
    } catch (err) {
        console.error('[REPLY TO REPORT ERROR]', err);
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

// PUT /api/reports/:id/resolve (Admin updates status)
router.put('/:id/resolve', verifyToken, async (req, res) => {
    try {
        const { status, resolutionNote } = req.body;
        const reportId = req.params.id;

        const report = await Report.findByIdAndUpdate(
            reportId,
            { status }, // Could also add resolutionNote field to schema if needed
            { new: true }
        );

        if (!report) return res.status(404).json({ error: 'Report not found' });

        // Notify the user who submitted the report
        // Notify the user who submitted the report
        const notificationMessage = resolutionNote
            ? `Your report (ID: ${report._id.toString().substring(0, 8)}) status has been updated to: ${status}. Admin response: "${resolutionNote}"`
            : `Your report (ID: ${report._id.toString().substring(0, 8)}) status has been updated to: ${status}`;

        await Notification.create({
            userId: report.userId,
            message: notificationMessage,
            type: 'admin_directive',
            role: 'vendor',
            targetId: report._id
        });

        res.json(report);
    } catch (err) {
        console.error('[RESOLVE REPORT ERROR]', err);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// DELETE /api/reports/:id (Admin only - delete report)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const reportId = req.params.id;
        const report = await Report.findByIdAndDelete(reportId);

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({ message: 'Report deleted successfully' });
    } catch (err) {
        console.error('[DELETE REPORT ERROR]', err);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

// GET /api/reports/:id/messages (Fetch chat history for a report)
router.get('/:id/messages', verifyToken, async (req, res) => {
    try {
        const messages = await ReportMessage.find({ reportId: req.params.id })
            .populate('senderId', 'name email')
            .sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        console.error('[FETCH REPORT MESSAGES ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST /api/reports/:id/messages (Send a message in the report thread)
router.post('/:id/messages', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        const reportId = req.params.id;

        const newMessage = await ReportMessage.create({
            reportId,
            senderId: req.user.id,
            senderRole: req.user.role || (req.user.isVendor ? 'vendor' : 'user'),
            message
        });

        // Also update report status if it was 'open' or 'closed' back to 'in-progress' or stay 'resolved'
        const report = await Report.findById(reportId);
        if (report && (report.status === 'open' || report.status === 'closed')) {
            report.status = 'in-progress';
            await report.save();
        }

        res.status(201).json(newMessage);
    } catch (err) {
        console.error('[SEND REPORT MESSAGE ERROR]', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

export default router;
