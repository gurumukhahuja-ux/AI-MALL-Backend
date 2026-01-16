import mongoose from 'mongoose';

const dashboardMessageSchema = new mongoose.Schema({
    senderType: {
        type: String,
        enum: ['Admin', 'Vendor'],
        required: true
    },
    senderId: {
        type: String, // Changed from ObjectId to String for flexibility
        required: false
    },
    recipientType: {
        type: String,
        enum: ['Admin', 'Vendor'],
        required: true
    },
    recipientId: {
        type: String, // Changed from ObjectId to String for flexibility
        required: false
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['Unread', 'Read'],
        default: 'Unread'
    },
    metaData: {
        // e.g., Vendor Name if sender is vendor, or 'Admin'
        senderName: String,
        senderEmail: String
    }
}, {
    timestamps: true
});

const DashboardMessage = mongoose.model('DashboardMessage', dashboardMessageSchema);

export default DashboardMessage;
