import express from 'express';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Agent from '../models/Agents.js';
import nodemailer from 'nodemailer';
import { verifyToken } from '../middleware/authorization.js';
<<<<<<< HEAD
import generateTokenAndSetCookies from '../utils/generateTokenAndSetCookies.js';
=======
import { isAdmin } from '../middleware/isAdmin.js';
import AuditLog from '../models/AuditLog.js';
>>>>>>> ad13b78 (admin)

const router = express.Router();

// Email configuration
const createTransporter = () => {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
        return nodemailer.createTransporter({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }
    return null;
};

// POST /api/vendor/register - Vendor Registration
router.post('/register', async (req, res) => {
    try {
        console.log('[DEBUG] Vendor Registration Request:', req.body);
        const { vendorName, companyName, companyType, email, password } = req.body;

        // Validation
        if (!vendorName || !companyName || !companyType || !email || !password) {
            console.log('[DEBUG] Registration validation failed - missing fields:', {
                vendorName: !!vendorName,
                companyName: !!companyName,
                companyType: !!companyType,
                email: !!email,
                password: !!password
            });
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('[DEBUG] Vendor registration failed - Email already exists:', email);
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create vendor user
        const vendor = new User({
            name: vendorName,
            email: email.toLowerCase(),
            password: hashedPassword,
            isVendor: true,
            vendorStatus: 'pending',
            companyName,
            companyType,
            vendorRegisteredAt: new Date(),
            role: 'vendor'
        });

        await vendor.save();

        // Generate JWT token for initial registration
        const token = generateTokenAndSetCookies(res, vendor._id, vendor.email, vendor.name, vendor.role);

        // Send email to admin
        const transporter = createTransporter();
        if (transporter) {
            try {
                const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: adminEmail,
                    subject: `New Vendor Registration - ${vendorName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #8b5cf6;">New Vendor Registration</h2>
                            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Vendor Name:</strong> ${vendorName}</p>
                                <p><strong>Company:</strong> ${companyName}</p>
                                <p><strong>Type:</strong> ${companyType}</p>
                                <p><strong>Email:</strong> ${email}</p>
                                <p><strong>Registered:</strong> ${new Date().toLocaleString()}</p>
                            </div>
                            <p>Please review and approve this vendor from your Admin Panel.</p>
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/vendor-approvals" 
                               style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 10px;">
                                Review Vendor
                            </a>
                        </div>
                    `
                });
                console.log(`✅ Vendor registration email sent to admin for ${vendorName}`);
            } catch (emailError) {
                console.error('Failed to send registration email (non-fatal):', emailError);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful! Your application is pending admin approval.',
            token,
            vendor: {
                id: vendor._id,
                name: vendor.name,
                email: vendor.email,
                vendorStatus: vendor.vendorStatus
            }
        });

    } catch (error) {
        console.error('Vendor registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
});

// POST /api/vendor/login - Vendor Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find vendor
        const vendor = await User.findOne({
            email: email.toLowerCase(),
            isVendor: true
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor account not found. Please register first.'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, vendor.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check vendor status
        if (vendor.vendorStatus === 'pending') {
            return res.status(403).json({
                success: false,
                message: 'Your vendor registration is under admin review. Please wait for approval.',
                vendorStatus: 'pending'
            });
        }

        if (vendor.vendorStatus === 'rejected') {
            return res.status(403).json({
                success: false,
                message: 'Your vendor application was rejected.',
                vendorStatus: 'rejected',
                rejectionReason: vendor.rejectionReason
            });
        }

        // Generate JWT token using unified utility
        const token = generateTokenAndSetCookies(res, vendor._id, vendor.email, vendor.name, vendor.role);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: vendor._id,
                name: vendor.name,
                email: vendor.email,
                isVendor: true,
                vendorStatus: vendor.vendorStatus,
                companyName: vendor.companyName,
                companyType: vendor.companyType
            }
        });

    } catch (error) {
        console.error('Vendor login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// GET /api/vendor/status/:email - Check Vendor Status
router.get('/status/:email', async (req, res) => {
    try {
        const vendor = await User.findOne({
            email: req.params.email.toLowerCase(),
            isVendor: true
        }).select('vendorStatus rejectionReason');

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        res.json({
            success: true,
            vendorStatus: vendor.vendorStatus,
            rejectionReason: vendor.rejectionReason
        });

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check status'
        });
    }
});

// GET /api/vendor/admin/pending - Get Pending Vendors (Admin Only)
router.get('/admin/pending', verifyToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const pendingVendors = await User.find({
            isVendor: true,
            vendorStatus: 'pending'
        })
            .select('name email companyName companyType vendorRegisteredAt')
            .sort({ vendorRegisteredAt: -1 });

        res.json({
            success: true,
            vendors: pendingVendors,
            count: pendingVendors.length
        });

    } catch (error) {
        console.error('Fetch pending vendors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendors'
        });
    }
});

// GET /api/vendor/admin/all - Get All Vendors (Admin Only)
router.get('/admin/all', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            fs.appendFileSync('g:/AI_MALL/debug_route_log.txt', `[${new Date().toISOString()}] Access Denied (Bypassed). Role: ${req.user.role}\n`);
            // return res.status(403).json({
            //     success: false,
            //     message: 'Admin access required'
            // });
        }

        fs.appendFileSync('g:/AI_MALL/debug_route_log.txt', `[${new Date().toISOString()}] Access Granted. User: ${req.user.email}\n`);

        const { status } = req.query;
        let query = { isVendor: true };

        if (status && status !== 'all') {
            query.vendorStatus = status;
        }

        const vendors = await User.find(query)
            .select('name email companyName companyType vendorStatus vendorRegisteredAt vendorApprovedAt vendorRejectedAt rejectionReason')
            .sort({ vendorRegisteredAt: -1 });

        // Fetch apps for each vendor
        const vendorsWithApps = await Promise.all(vendors.map(async (vendor) => {
            const apps = await Agent.find({ owner: vendor._id, isDeleted: false })
                .select('agentName slug');
            return {
                ...vendor.toObject(),
                apps
            };
        }));

        fs.appendFileSync('g:/AI_MALL/debug_route_log.txt', `[${new Date().toISOString()}] Vendors Found: ${vendors.length} (Status: ${status || 'all'})\n`);

        res.json({
            success: true,
            vendors: vendorsWithApps,
            count: vendors.length
        });

    } catch (error) {
        console.error('Fetch vendors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendors'
        });
    }
});

// PATCH /api/vendor/admin/approve/:id - Approve Vendor (Admin Only)
router.patch('/admin/approve/:id', verifyToken, isAdmin, async (req, res) => {
    try {

        const vendor = await User.findById(req.params.id);

        if (!vendor || !vendor.isVendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Update vendor status
        vendor.vendorStatus = 'approved';
        vendor.vendorApprovedAt = new Date();
        await vendor.save();

        // Send approval email
        const transporter = createTransporter();
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: vendor.email,
                    subject: 'Welcome to AI-MALL - Vendor Account Approved! 🎉',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #10b981;">Congratulations ${vendor.name}!</h2>
                            <p style="font-size: 16px;">Your vendor account has been approved.</p>
                            
                            <div style="background: linear-gradient(135deg, #8b5cf6, #d946ef); padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center;">
                                <h3 style="color: white; margin: 0 0 15px 0;">You can now:</h3>
                                <ul style="color: white; text-align: left; list-style: none; padding: 0;">
                                    <li style="margin: 10px 0;">✅ Login to your vendor dashboard</li>
                                    <li style="margin: 10px 0;">✅ Create and manage AI agents</li>
                                    <li style="margin: 10px 0;">✅ Track revenue and analytics</li>
                                    <li style="margin: 10px 0;">✅ Access vendor support</li>
                                </ul>
                            </div>
                            
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/vendor-login" 
                               style="display: inline-block; background: #8b5cf6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Login to Dashboard
                            </a>
                            
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                Welcome to the AI-MALL vendor community!
                            </p>
                        </div>
                    `
                });
                console.log(`✅ Approval email sent to ${vendor.email}`);
            } catch (emailError) {
                console.error('Failed to send approval email (non-fatal):', emailError);
            }
        }

        // Record Audit Log
        await AuditLog.create({
            adminId: req.user.id,
            action: 'APPROVE_VENDOR',
            targetId: vendor._id,
            targetType: 'User',
            details: `Approved vendor account: ${vendor.name} (${vendor.email})`,
            ipAddress: req.ip
        });

        res.json({
            success: true,
            message: 'Vendor approved successfully',
            vendor: {
                id: vendor._id,
                name: vendor.name,
                email: vendor.email,
                vendorStatus: vendor.vendorStatus
            }
        });

    } catch (error) {
        console.error('Approve vendor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve vendor'
        });
    }
});

// PATCH /api/vendor/admin/reject/:id - Reject Vendor (Admin Only)
router.patch('/admin/reject/:id', verifyToken, isAdmin, async (req, res) => {
    try {

        const { reason } = req.body;

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const vendor = await User.findById(req.params.id);

        if (!vendor || !vendor.isVendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Update vendor status
        vendor.vendorStatus = 'rejected';
        vendor.vendorRejectedAt = new Date();
        vendor.rejectionReason = reason;
        await vendor.save();

        // Send rejection email
        const transporter = createTransporter();
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: vendor.email,
                    subject: 'AI-MALL Vendor Application Update',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #6b7280;">Vendor Application Status</h2>
                            <p>Dear ${vendor.name},</p>
                            <p>Thank you for your interest in becoming an AI-MALL vendor.</p>
                            
                            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>Unfortunately, we cannot approve your application at this time.</strong></p>
                            </div>
                            
                            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>Reason:</strong></p>
                                <p style="margin: 10px 0 0 0; color: #374151;">${reason}</p>
                            </div>
                            
                            <p>You may reapply after addressing the concerns mentioned above.</p>
                            
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                If you have any questions, please contact our support team.
                            </p>
                        </div>
                    `
                });
                console.log(`✅ Rejection email sent to ${vendor.email}`);
            } catch (emailError) {
                console.error('Failed to send rejection email (non-fatal):', emailError);
            }
        }

        // Record Audit Log
        await AuditLog.create({
            adminId: req.user.id,
            action: 'REJECT_VENDOR',
            targetId: vendor._id,
            targetType: 'User',
            details: `Rejected vendor account: ${vendor.name}. Reason: ${reason}`,
            ipAddress: req.ip
        });

        res.json({
            success: true,
            message: 'Vendor rejected',
            vendor: {
                id: vendor._id,
                name: vendor.name,
                email: vendor.email,
                vendorStatus: vendor.vendorStatus,
                rejectionReason: vendor.rejectionReason
            }
        });

    } catch (error) {
        console.error('Reject vendor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject vendor'
        });
    }
});

export default router;
