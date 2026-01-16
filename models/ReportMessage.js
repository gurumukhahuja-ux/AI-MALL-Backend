import mongoose from 'mongoose';

const reportMessageSchema = new mongoose.Schema({
    reportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderRole: {
        type: String,
        enum: ['admin', 'vendor', 'user'],
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    attachments: [{
        name: String,
        url: String,
        type: String
    }]
}, {
    timestamps: true
});

const ReportMessage = mongoose.model('ReportMessage', reportMessageSchema);

export default ReportMessage;
