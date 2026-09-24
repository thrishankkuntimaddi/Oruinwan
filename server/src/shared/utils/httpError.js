'use strict';

const logger = require('./logger');

const GENERIC_MESSAGE = 'An unexpected error occurred. Please try again later.';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * The message that is safe to show a client for (err, status).
 * 5xx in production → generic; otherwise err.message.
 */
function safeErrorMessage(err, status) {
  const httpStatus = Number(status || (err && (err.statusCode || err.status)) || 500);
  if (httpStatus >= 500 && isProduction()) return GENERIC_MESSAGE;
  return (err && err.message) || GENERIC_MESSAGE;
}

/**
 * Send an error response without leaking internals.
 *
 * - status defaults to err.statusCode || err.status || 500
 * - 5xx in production: generic message only (never err.message / stack / internal codes)
 * - otherwise: the explicit `message` if given, else err.message
 *
 * @param {import('express').Response} res
 * @param {Error & {statusCode?: number, status?: number, code?: string|number}} err
 * @param {{ status?: number, message?: string }} [opts]
 */
function sendError(res, err, { status, message } = {}) {
  const e = err || {};
  let httpStatus = Number(status || e.statusCode || e.status || 500);
  if (!Number.isInteger(httpStatus) || httpStatus < 400 || httpStatus > 599) httpStatus = 500;

  const isServerError = httpStatus >= 500;

  if (isServerError) {
    logger.error({ err: e, status: httpStatus }, message || e.message || 'Request failed');
  } else {
    logger.warn({ err: e.message, code: e.code, status: httpStatus }, message || e.message || 'Request rejected');
  }

  let clientMessage;
  if (isServerError && isProduction()) {
    clientMessage = message || GENERIC_MESSAGE;
  } else {
    clientMessage = message || e.message || GENERIC_MESSAGE;
  }

  const body = { message: clientMessage };
  if (e.code !== undefined && e.code !== null && (!isServerError || !isProduction())) {
    body.code = e.code;
  }

  if (res.headersSent) return undefined;
  return res.status(httpStatus).json(body);
}

module.exports = { sendError, safeErrorMessage, GENERIC_MESSAGE };
