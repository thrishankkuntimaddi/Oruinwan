const User = require('../models/User');

/**
 * Toggle a favorite (channel or DM) for the authenticated user
 * POST /api/users/favorites/toggle
 */
exports.toggleFavorite = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const { itemId } = req.body;

        if (!itemId) {
            return res.status(400).json({ message: 'itemId is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Initialize favorites array if it doesn't exist
        if (!user.favorites) {
            user.favorites = [];
        }

        // Toggle favorite
        const index = user.favorites.indexOf(itemId);
        if (index > -1) {
            // Remove from favorites
            user.favorites.splice(index, 1);
        } else {
            // Add to favorites
            user.favorites.push(itemId);
        }

        await user.save();

        return res.json({
            message: index > -1 ? 'Removed from favorites' : 'Added to favorites',
            favorites: user.favorites
        });
    } catch (err) {
        console.error('TOGGLE FAVORITE ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Get user's favorites
 * GET /api/users/favorites
 */
exports.getFavorites = async (req, res) => {
    try {
        const userId = req.user?.sub;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({
            favorites: user.favorites || []
        });
    } catch (err) {
        console.error('GET FAVORITES ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
