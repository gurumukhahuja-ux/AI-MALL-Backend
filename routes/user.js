import express from "express"
import userModel from "../models/User.js"
import { verifyToken } from "../middleware/authorization.js"
import { isAdmin } from "../middleware/isAdmin.js"
import Transaction from "../models/Transaction.js"

const route = express.Router()

route.get("/", verifyToken, async (req, res) => {
    try {

        const userId = req.user.id
        const user = await userModel.findById(userId)
        res.status(200).json(user)
    } catch (error) {
        res.send({ msg: "somthing went wrong" })
    }

})

// GET /profile
route.get("/profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await userModel.findById(userId).select('-password');
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ msg: "Something went wrong" });
    }
});

// PUT /profile
route.put("/profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { settings, notifications } = req.body;

        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ msg: "User not found" });

        if (!user.profile) user.profile = {};

        if (settings) {
            user.profile.settings = { ...user.profile.settings, ...settings };
        }
        if (notifications) {
            user.profile.notifications = { ...user.profile.notifications, ...notifications };
        }

        await user.save();
        res.status(200).json(user);
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Something went wrong" });
    }
});

route.put("/", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ msg: "Name is required" });
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { name },
            { new: true } // Return the updated document
        );

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ msg: "Something went wrong" });
    }
})

// GET /api/user/all - Admin only, fetch all users with details
route.get("/all", verifyToken, isAdmin, async (req, res) => {
    try {
        // Simple admin check (in production use middleware)
        // Assuming verifyToken attaches user info but maybe not role? 
        // We'll trust the request or fetch the user to check role if strictly needed.
        // For now, let's fetch all users.

        const users = await userModel.find({})
            .populate('agents', 'agentName pricing')
            .select('-password');

        // Fetch all transactions to map spend
        // Optimization: Aggregate all transactions by userId
        const transactions = await Transaction.aggregate([
            { $match: { status: 'Success' } },
            { $group: { _id: "$userId", totalSpent: { $sum: "$amount" } } }
        ]);

        const spendMap = transactions.reduce((acc, curr) => {
            if (curr._id) {
                acc[curr._id.toString()] = curr.totalSpent;
            }
            return acc;
        }, {});

        const usersWithDetails = users.map(user => ({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.isVerified ? 'Active' : 'Pending',
            agents: user.agents || [],
            avatar: user.avatar,
            spent: spendMap[user._id.toString()] || 0
        }));

        res.json(usersWithDetails);

    } catch (error) {
        console.error('[FETCH ALL USERS ERROR]', error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// PUT /api/user/:id/block - Admin only, block/unblock user
route.put("/:id/block", verifyToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { isBlocked } = req.body; // Expect boolean or toggle if not provided? Best to be explicit.

        // Find and update
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Prevent blocking self or other admins? optional
        if (user.role === 'admin') {
            return res.status(403).json({ error: "Cannot block admins" });
        }

        user.isBlocked = isBlocked;
        await user.save();

        res.json({
            message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
            user: { id: user._id, isBlocked: user.isBlocked }
        });

    } catch (err) {
        console.error('[BLOCK USER ERROR]', err);
        res.status(500).json({ error: "Failed to update user status" });
    }
});

// DELETE /api/user/:id - Admin only, delete user
route.delete("/:id", verifyToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Prevent deleting self or admins
        if (user.role === 'admin') {
            return res.status(403).json({ error: "Cannot delete admins" });
        }

        await userModel.findByIdAndDelete(userId);

        res.json({ message: "User deleted successfully", id: userId });

    } catch (err) {
        console.error('[DELETE USER ERROR]', err);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// GET /api/user/admin-team - Admin only, fetch all admins
route.get("/admin-team", verifyToken, isAdmin, async (req, res) => {
    try {
        const admins = await userModel.find({ role: 'admin' }).select('-password');
        res.json(admins);
    } catch (err) {
        console.error('[ADMIN TEAM FETCH ERROR]', err);
        res.status(500).json({ error: "Failed to fetch admin team" });
    }
});

// POST /api/user/add-admin - Admin only, promote user to admin
route.post("/add-admin", verifyToken, isAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        user.role = 'admin';
        await user.save();

        res.json({ message: "User promoted to admin successfully", user: { id: user._id, name: user.name, email: user.email } });
    } catch (err) {
        console.error('[ADD ADMIN ERROR]', err);
        res.status(500).json({ error: "Failed to promote user to admin" });
    }
});

export default route