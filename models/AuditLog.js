import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ['APPROVE_AGENT', 'REJECT_AGENT', 'APPROVE_VENDOR', 'REJECT_VENDOR', 'DELETE_AGENT', 'BLOCK_USER', 'UNBLOCK_USER', 'CHANGE_PLATFORM_SETTINGS']
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    targetType: {
        type: String,
        required: true,
        enum: ['Agent', 'User', 'Report', 'Settings']
    },
    details: {
        type: String
    },
    ipAddress: {
        type: String
    }
}, { timestamps: true });

export default mongoose.model('AuditLog', auditLogSchema);
