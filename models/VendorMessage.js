import mongoose from 'mongoose';

const vendorMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Allow non-logged-in users to contact
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
        required: true,
        index: true
    },
    userName: {
        type: String,
        required: true,
        trim: true
    },
    userEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    status: {
        type: String,
        enum: ['New', 'Replied', 'Closed'],
        default: 'New',
        index: true
    },
    agentName: {
        type: String,
        required: true
    },
    vendorEmail: {
        type: String,
        required: true
    },
    replyMessage: {
        type: String,
        trim: true,
        maxlength: 2000
    },
    repliedAt: {
        type: Date
    },
    senderType: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'User'
    }
}, {
    timestamps: true
});

// Index for efficient vendor queries
vendorMessageSchema.index({ vendorId: 1, createdAt: -1 });
vendorMessageSchema.index({ agentId: 1, createdAt: -1 });

const VendorMessage = mongoose.model('VendorMessage', vendorMessageSchema);

export default VendorMessage;
