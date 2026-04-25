const mongoose = require('mongoose');

const IssueKeyCounterSchema = new mongoose.Schema({
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
        unique: true
    },
    
    prefix: { type: String, required: true, uppercase: true },
    
    seq: { type: Number, default: 0 }
}, { timestamps: false });

IssueKeyCounterSchema.statics.nextKey = async function (workspaceId, workspaceName) {
    
    const prefix = (workspaceName || 'TSK')
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'TSK';

    const counter = await this.findOneAndUpdate(
        { workspace: workspaceId },
        { $inc: { seq: 1 }, $setOnInsert: { prefix } },
        { new: true, upsert: true }
    );

    return `${counter.prefix}-${counter.seq}`;
};

module.exports = mongoose.model('IssueKeyCounter', IssueKeyCounterSchema);
