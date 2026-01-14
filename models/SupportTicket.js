import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    issueType: {
        type: String,
        required: true,
        enum: ["General Inquiry", "Payment Issue", "Refund Request", "Technical Support", "Account Access", "Other", "AdminSupport"],
    },
    subject: {
        type: String,
        required: false
    },
    message: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    replies: [{
        sender: {
            type: String,
            required: true,
            enum: ['user', 'admin']
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false // Optional, but good for tracking which admin replied
        },
        message: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('SupportTicket', supportTicketSchema);
