import express from "express";
import ChatSession from "../models/ChatSession.js";
import User from "../models/User.js";
import Agent from "../models/Agents.js";
import Report from "../models/Report.js";
import Transaction from "../models/Transaction.js";
import Notification from "../models/Notification.js";
import Settings from "../models/Settings.js";
import { updateRateLimit } from "../middleware/dynamicRateLimiter.js";
import { isAdmin } from "../middleware/isAdmin.js";
import { verifyToken } from "../middleware/authorization.js";
const router = express.Router();

// Dashboard Stats (General/User view)
router.get('/dashboard/stats', async (req, res) => {
  try {
    const sessionCount = await ChatSession.countDocuments();
    const liveAgentsCount = await Agent.countDocuments({ status: { $in: ['Live', 'active', 'Active'] } });

    res.json({
      totalChats: sessionCount,
      activeAgents: liveAgentsCount,
      tokensUsed: 125000 + (sessionCount * 150), // Dynamic mock calculation
      savedTime: '12h 30m'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Admin Stats Endpoints (Specification-aligned)

router.get('/admin/stats/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const count = await User.countDocuments();
    const activeCount = await User.countDocuments({ status: 'Active' });
    res.json({ total: count, active: activeCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/stats/vendors', verifyToken, isAdmin, async (req, res) => {
  try {
    const total = await User.countDocuments({ isVendor: true });
    const approved = await User.countDocuments({ isVendor: true, vendorStatus: 'approved' });
    const pending = await User.countDocuments({ isVendor: true, vendorStatus: 'pending' });
    res.json({ total, approved, pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/stats/agents', verifyToken, isAdmin, async (req, res) => {
  try {
    const total = await Agent.countDocuments();
    const active = await Agent.countDocuments({ status: { $in: ['Live', 'Active', 'active'] } });
    const archive = await Agent.countDocuments({ status: 'Archived' });
    res.json({ total, active, archive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/stats/revenue', verifyToken, isAdmin, async (req, res) => {
  try {
    const stats = await Transaction.aggregate([
      { $match: { status: 'Success' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          platformFees: { $sum: "$platformFee" },
          vendorPayouts: { $sum: "$netAmount" }
        }
      }
    ]);
    res.json(stats[0] || { totalRevenue: 0, platformFees: 0, vendorPayouts: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy Admin Overview Stats (Optimized)
router.get('/admin/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      agents,
      activeAgentsCount,
      pendingApprovalsCount,
      openComplaintsCount,
      recentAgents,
      recentReports,
      financialsData,
      usageCountsData,
      totalVendors
    ] = await Promise.all([
      User.countDocuments(),
      Agent.find().sort({ updatedAt: -1 }),
      Agent.countDocuments({ status: { $in: ['Live', 'active', 'Active'] } }),
      Agent.countDocuments({ reviewStatus: 'Pending Review' }),
      Report.countDocuments({ status: 'open' }),
      Agent.find().sort({ createdAt: -1 }).limit(3),
      Report.find().sort({ timestamp: -1 }).limit(3),
      Transaction.aggregate([
        { $match: { status: 'Success' } },
        {
          $group: {
            _id: null,
            grossSales: { $sum: "$amount" },
            platformFee: { $sum: "$platformFee" },
            netEarnings: { $sum: "$netAmount" }
          }
        }
      ]),
      User.aggregate([
        { $match: { agents: { $exists: true, $not: { $size: 0 } } } },
        { $unwind: "$agents" },
        { $group: { _id: "$agents", count: { $sum: 1 } } }
      ]),
      User.countDocuments({ isVendor: true })
    ]);

    const usageMap = (usageCountsData || []).reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    const financials = financialsData[0] || { grossSales: 0, platformFee: 0, netEarnings: 0 };

    // Format recent activity
    const recentActivity = [
      ...recentAgents.map(a => ({
        type: 'agent',
        user: 'System',
        detail: `New agent ${a.agentName} deployed`,
        time: a.createdAt
      })),
      ...recentReports.map(r => ({
        type: 'report',
        user: r.userId || 'Anonymous',
        detail: `New ${r.type} issue: ${r.description.substring(0, 30)}...`,
        time: r.timestamp
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

    res.json({
      totalUsers: totalUsers,
      totalVendors: totalVendors,
      activeAgents: activeAgentsCount,
      pendingApprovals: pendingApprovalsCount,
      totalRevenue: financials.grossSales,
      openComplaints: openComplaintsCount,
      recentActivity,
      financials: {
        grossSales: financials.grossSales,
        platformFee: financials.platformFee,
        netEarnings: financials.netEarnings,
        status: financials.grossSales > 0 ? 'Active' : 'N/A',
        nextPayout: financials.grossSales > 0 ? 'Processing' : 'Pending Sales'
      },
      inventory: agents.map(a => ({
        id: a._id,
        name: a.agentName,
        description: a.description || '',
        url: a.url || '',
        category: a.category || '',
        pricing: a.pricing || 'Free',
        status: a.status || 'Inactive',
        reviewStatus: a.reviewStatus || 'Draft',
        avatar: a.avatar || '/AGENTS_IMG/default.png',
<<<<<<< HEAD
        usageCount: usageMap[a._id.toString()] || 0,
        deletionStatus: a.deletionStatus || 'None'
=======
        owner: a.owner,
        usageCount: usageMap[a._id.toString()] || 0
>>>>>>> ad13b78 (admin)
      }))
    });
  } catch (err) {
    console.error('[ADMIN STATS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});


// Automations (Mock Data stored in memory for demo)
let automations = [
  { id: '1', name: 'Daily Diary', description: 'Summarize unread emails at 9 AM', active: true, type: 'Email' },
  { id: '2', name: 'Lead Qualifier', description: 'Score incoming leads from CRM', active: false, type: 'CRM' },
  { id: '3', name: 'Code Reviewer', description: 'Auto-review PRs on GitHub', active: true, type: 'Dev' },
];

router.get('/automations', (req, res) => {
  res.json(automations);
});

router.post('/automations/:id/toggle', (req, res) => {
  const { id } = req.params;
  const auto = automations.find(a => a.id === id);
  if (auto) {
    auto.active = !auto.active;
    res.json(auto);
  } else {
    res.status(404).json({ error: 'Automation not found' });
  }
});

// Admin Settings
router.get('/admin/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/admin/settings/maintenance', async (req, res) => {
  try {
    const { enabled } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    settings.maintenanceMode = enabled;
    await settings.save();

    if (enabled) {
      // Notify ALL users
      const users = await User.find({}, '_id');
      const notifications = users.map(user => ({
        userId: user._id,
        message: "⚠️ System Maintenance: The platform is currently in maintenance mode. Some features may be unavailable.",
        type: "warning",
        targetId: null
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } else {
      // Notify ALL users system is back
      const users = await User.find({}, '_id');
      const notifications = users.map(user => ({
        userId: user._id,
        message: "✅ System Restored: Maintenance is complete. All systems are operational.",
        type: "success",
        targetId: null
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    }

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update maintenance mode' });
  }
});

// Toggle Kill Switch
router.post('/admin/settings/killswitch', async (req, res) => {
  try {
    const { enabled } = req.body;
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    settings.globalKillSwitch = enabled;
    await settings.save();

    res.json({ success: true, globalKillSwitch: enabled });
  } catch (err) {
    console.error("Kill switch toggle error:", err);
    res.status(500).json({ error: "Failed to update kill switch" });
  }
});

// Update Rate Limit
router.post('/admin/settings/ratelimit', async (req, res) => {
  try {
    const { limit } = req.body;
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    settings.globalRateLimit = limit;
    await settings.save();

    // Update active memory limit immediately
    updateRateLimit(limit);

    res.json({ success: true, globalRateLimit: limit });
  } catch (err) {
    console.error("Rate limit update error:", err);
    res.status(500).json({ error: "Failed to update rate limit" });
  }
});

router.post('/admin/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      Object.assign(settings, req.body);
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
