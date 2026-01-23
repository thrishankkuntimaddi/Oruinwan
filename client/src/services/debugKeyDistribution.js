// client/src/services/debugKeyDistribution.js
// Temporary debugging wrapper

export async function handleKeyNeededEvent(payload, currentUserId) {
    console.log('🔐🔐🔐 [KEY DISTRIBUTION] EVENT RECEIVED!', payload);
    console.log(`🔐 [Key Distribution] newUserId: ${payload.newUserId}, currentUserId: ${currentUserId}`);

    try {
        const { handleKeyNeededEvent: actualHandler } = await import('./clientKeyDistribution');
        await actualHandler(payload, currentUserId);
    } catch (error) {
        console.error('❌ [Key Distribution] Failed:', error);
    }
}
