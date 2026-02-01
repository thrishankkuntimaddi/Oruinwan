// client/src/services/debugKeyDistribution.js
// Temporary debugging wrapper

export async function handleKeyNeededEvent(payload, currentUserId) {
    try {
        const { handleKeyNeededEvent: actualHandler } = await import('./clientKeyDistribution');
        await actualHandler(payload, currentUserId);
    } catch (error) {
        console.error('❌ [Key Distribution] Failed:', error);
    }
}
