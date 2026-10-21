'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const service = require('./designReview.service');
const logger = require('../../../utils/logger');

router.use(requireAuth);

function handleError(res, err) {
    const status = err.statusCode || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
    if (status >= 500) logger.error('[design-review]', err);
    const body = { message: status >= 500 ? 'Internal server error' : err.message };
    if (Array.isArray(err.errors)) body.errors = err.errors;
    return res.status(status).json(body);
}

const wrap = (fn, code = 200) => async (req, res) => {
    try {
        return res.status(code).json(await fn(req));
    } catch (err) { return handleError(res, err); }
};

const uid = (req) => req.user.sub;

// Reviews
router.get('/', wrap((req) => service.listReviews(uid(req), req.query)));
router.post('/', wrap((req) => service.createReview(uid(req), req.body || {}, req.io), 201));
router.get('/compare', wrap((req) => service.compareVersions(uid(req), req.query)));
router.get('/:id', wrap((req) => service.getReview(uid(req), req.params.id)));
router.patch('/:id', wrap((req) => service.updateReview(uid(req), req.params.id, req.body || {}, req.io)));
router.delete('/:id', wrap((req) => service.deleteReview(uid(req), req.params.id, req.io)));
router.post('/:id/decision', wrap((req) => service.decide(uid(req), req.params.id, req.body || {}, req.io)));
router.post('/:id/rounds', wrap((req) => service.newRound(uid(req), req.params.id, req.body || {}, req.io)));

// Annotations
router.get('/:id/annotations', wrap((req) => service.listAnnotations(uid(req), req.params.id, req.query)));
router.post('/:id/annotations', wrap((req) => service.addAnnotation(uid(req), req.params.id, req.body || {}, req.io), 201));
router.patch('/:id/annotations/:annotationId', wrap((req) => service.updateAnnotation(uid(req), req.params.id, req.params.annotationId, req.body || {}, req.io)));
router.delete('/:id/annotations/:annotationId', wrap((req) => service.deleteAnnotation(uid(req), req.params.id, req.params.annotationId, req.io)));
router.post('/:id/annotations/:annotationId/resolve', wrap((req) => service.resolveAnnotation(uid(req), req.params.id, req.params.annotationId, req.body || {}, req.io)));
router.post('/:id/annotations/:annotationId/replies', wrap((req) => service.replyToAnnotation(uid(req), req.params.id, req.params.annotationId, req.body || {}, req.io), 201));

module.exports = router;
