// server/controllers/favoriteController.js
const Favorite = require("../models/Favorite");
const Channel = require("../models/Channel");
const DMSession = require("../models/DMSession");

/**
 * Get all favorites for current user in a workspace
 * GET /api/favorites/:workspaceId
 */
exports.getFavorites = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.sub;

        const favorites = await Favorite.find({
            user: userId,
            workspace: workspaceId
        }).populate('itemId');

        const favoritesData = favorites.map(fav => ({
            id: fav._id,
            itemType: fav.itemType,
            itemId: fav.itemId,
            createdAt: fav.createdAt
        }));

        return res.json({ favorites: favoritesData });
    } catch (err) {
        console.error("GET FAVORITES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Add item to favorites
 * POST /api/favorites
 */
exports.addFavorite = async (req, res) => {
    try {
        const { workspaceId, itemType, itemId } = req.body;
        const userId = req.user?.sub;

        if (!workspaceId || !itemType || !itemId) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Check if already favorited
        const existing = await Favorite.findOne({
            user: userId,
            itemType,
            itemId
        });

        if (existing) {
            return res.status(400).json({ message: "Already favorited" });
        }

        const favorite = await Favorite.create({
            user: userId,
            workspace: workspaceId,
            itemType,
            itemId
        });

        return res.status(201).json({
            message: "Added to favorites",
            favorite: {
                id: favorite._id,
                itemType: favorite.itemType,
                itemId: favorite.itemId
            }
        });
    } catch (err) {
        console.error("ADD FAVORITE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Remove item from favorites
 * DELETE /api/favorites/:id
 */
exports.removeFavorite = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.sub;

        const favorite = await Favorite.findOne({
            _id: id,
            user: userId
        });

        if (!favorite) {
            return res.status(404).json({ message: "Favorite not found" });
        }

        await Favorite.deleteOne({ _id: id });

        return res.json({ message: "Removed from favorites" });
    } catch (err) {
        console.error("REMOVE FAVORITE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
