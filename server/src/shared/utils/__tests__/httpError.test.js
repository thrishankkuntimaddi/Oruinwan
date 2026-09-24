'use strict';

jest.mock('../logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));

const logger = require('../logger');
const { sendError, safeErrorMessage, GENERIC_MESSAGE } = require('../httpError');

function mockRes() {
  const res = { headersSent: false };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('sendError', () => {
  const OLD_ENV = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = OLD_ENV; });

  test('hides internal message and code for 500 in production', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    const err = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:27017'), { code: 'ECONNREFUSED' });
    sendError(res, err);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: GENERIC_MESSAGE });
    expect(logger.error).toHaveBeenCalled();
  });

  test('includes err.message for 500 outside production', () => {
    process.env.NODE_ENV = 'development';
    const res = mockRes();
    sendError(res, Object.assign(new Error('boom'), { code: 'X' }));
    expect(res.json).toHaveBeenCalledWith({ message: 'boom', code: 'X' });
  });

  test('uses err.statusCode and exposes client-error messages in production', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    sendError(res, Object.assign(new Error('Not allowed'), { statusCode: 403, code: 'FORBIDDEN' }));
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not allowed', code: 'FORBIDDEN' });
  });

  test('explicit status and message override', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    sendError(res, new Error('internal detail'), { status: 400, message: 'Bad input' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Bad input' });
  });

  test('invalid status falls back to 500', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    sendError(res, Object.assign(new Error('x'), { status: 200 }));
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('does nothing when headers already sent', () => {
    const res = mockRes();
    res.headersSent = true;
    sendError(res, new Error('late'));
    expect(res.status).not.toHaveBeenCalled();
  });

  test('safeErrorMessage', () => {
    process.env.NODE_ENV = 'production';
    expect(safeErrorMessage(new Error('secret'), 500)).toBe(GENERIC_MESSAGE);
    expect(safeErrorMessage(new Error('Bad'), 400)).toBe('Bad');
  });
});
