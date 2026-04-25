const mongoose = require("mongoose");

const PollOptionSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { _id: true });

const PollSchema = new mongoose.Schema({
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    question: { type: String, required: true, trim: true },
    options: [PollOptionSchema],

    
    type: { type: String, enum: ['single', 'multiple'], default: 'single' },

    
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },

    
    totalVotes: { type: Number, default: 0 }
}, { timestamps: true });

PollSchema.index({ channel: 1, createdAt: -1 });
PollSchema.index({ workspace: 1 });
PollSchema.index({ createdBy: 1 });

PollSchema.methods.hasUserVoted = function (userId) {
    return this.options.some(option =>
        option.votes.some(voteId => voteId.toString() === userId.toString())
    );
};

PollSchema.methods.getUserVotedOptions = function (userId) {
    return this.options.filter(option =>
        option.votes.some(voteId => voteId.toString() === userId.toString())
    ).map(opt => opt._id.toString());
};

PollSchema.methods.updateTotalVotes = function () {
    const uniqueVoters = new Set();
    this.options.forEach(option => {
        option.votes.forEach(voteId => uniqueVoters.add(voteId.toString()));
    });
    this.totalVotes = uniqueVoters.size;
};

module.exports = mongoose.model("Poll", PollSchema);
