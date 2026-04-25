function registerPollHandlers(io, socket) {

    
    socket.on('poll:created', (data) => {
        const { channelId, poll } = data;

        if (!channelId || !poll) {
            socket.emit('error', { message: 'Missing channelId or poll' });
            return;
        }

        
        io.to(`channel:${channelId}`).emit('poll:new', poll);
    });

    
    socket.on('poll:voted', (data) => {
        const { channelId, poll } = data;

        if (!channelId || !poll) return;

        
        io.to(`channel:${channelId}`).emit('poll:update', poll);
    });

    
    socket.on('poll:closed', (data) => {
        const { channelId, poll } = data;

        if (!channelId || !poll) return;

        
        io.to(`channel:${channelId}`).emit('poll:update', poll);
    });

    
    socket.on('poll:deleted', (data) => {
        const { channelId, pollId } = data;

        if (!channelId || !pollId) return;

        
        io.to(`channel:${channelId}`).emit('poll:removed', { pollId });
    });
}

module.exports = registerPollHandlers;
