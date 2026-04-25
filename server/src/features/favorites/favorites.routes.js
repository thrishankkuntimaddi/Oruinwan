const express = require('express');
const router = express.Router();
const favoritesController = require('./favorites.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.get('/:workspaceId', favoritesController.getFavorites);

router.post('/', favoritesController.addFavorite);

router.delete('/:id', favoritesController.removeFavorite);

module.exports = router;
