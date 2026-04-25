const express = require('express');
const router = express.Router();

const tasksController = require('../src/features/tasks/tasks.controller');
const notesController = require('../src/features/notes/notes.controller');
const favoritesController = require('../src/features/favorites/favorites.controller');
const requireAuth = require('../src/shared/middleware/auth');

router.get('/favorites/:workspaceId', requireAuth, favoritesController.getFavorites);
router.post('/favorites', requireAuth, favoritesController.addFavorite);
router.delete('/favorites/:id', requireAuth, favoritesController.removeFavorite);

module.exports = router;
