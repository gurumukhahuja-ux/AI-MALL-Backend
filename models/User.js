import mongoose from 'mongoose';


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    avatar: {
        type: String,
        default: '/User.jpeg'
    },
    agents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agent"
    }],
    role: {
        type: String,
        default: "user"
    },
    chatSessions: [{ type: mongoose.Schema.Types.ObjectId, ref: "ChatSession" }],
    verificationCode: Number,
    isBlocked: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // Vendor-specific fields
    isVendor: {
        type: Boolean,
        default: false
    },
    vendorStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: null
    },
    companyName: {
        type: String,
        trim: true
    },
    companyType: {
        type: String,
        enum: ['Startup', 'SME', 'Enterprise', 'Individual / Freelancer']
    },
    vendorRegisteredAt: {
        type: Date
    },
    vendorApprovedAt: {
        type: Date
    },
    vendorRejectedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true
    },
    profile: {
        settings: {
            country: { type: String, default: 'India (English)' },
            theme: { type: String, default: 'light' },
            timezone: { type: String, default: 'India (GMT+5:30)' },
            currency: { type: String, default: 'INR (₹)' }
        },
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: false }
        },
        stats: {
            credits: { type: String, default: "Infinity" },
            intelligenceLevel: { type: String, default: "Level 42" },
            securityStatus: { type: String, default: "Shielded" }
        }
    }

}, { timestamps: true });

export default mongoose.model('User', userSchema);