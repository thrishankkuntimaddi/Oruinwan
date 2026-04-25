const Favorite = require('../../../models/Favorite');
const _Channel = require("../channels/channel.model.js");
const _DMSession = require('../../../models/DMSession');

async function getFavorites(userId, workspaceId) {
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

    return { favorites: favoritesData };
}

async function addFavorite(userId, favoriteData) {
    const { workspaceId, itemType, itemId } = favoriteData;

    
    if (!workspaceId || !itemType || !itemId) {
        const error = new Error('Missing required fields');
        error.statusCode = 400;
        throw error;
    }

    
    const existing = await Favorite.findOne({
        user: userId,
        itemType,
        itemId
    });

    if (existing) {
        const error = new Error('Already favorited');
        error.statusCode = 400;
        throw error;
    }

    
    const favorite = await Favorite.create({
        user: userId,
        workspace: workspaceId,
        itemType,
        itemId
    });

    return {
        message: 'Added to favorites',
        favorite: {
            id: favorite._id,
            itemType: favorite.itemType,
            itemId: favorite.itemId
        }
    };
}

async function removeFavorite(userId, favoriteId) {
    const favorite = await Favorite.findOne({
        _id: favoriteId,
        user: userId
    });

    if (!favorite) {
        const error = new Error('Favorite not found');
        error.statusCode = 404;
        throw error;
    }

    await Favorite.deleteOne({ _id: favoriteId });

    return { message: 'Removed from favorites' };
}

module.exports = {
    getFavorites,
    addFavorite,
    removeFavorite
};
