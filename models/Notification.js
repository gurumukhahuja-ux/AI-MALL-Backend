import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error', 'admin_directive'],
        default: 'info'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['user', 'vendor', 'admin'],
        default: 'user'
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
