"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendErrorResponse = sendErrorResponse;
exports.parseError = parseError;
/**
 * Standard error response handler
 * Returns error in consistent format: { error: message, statusCode: number }
 */
function sendErrorResponse(res, statusCode, message, details) {
    const errorResponse = { error: message };
    if (details) {
        errorResponse.details = details;
    }
    return res.status(statusCode).json(errorResponse);
}
/**
 * Parse error and determine appropriate status code and message
 */
function parseError(err) {
    // Handle specific error types
    if (err.statusCode) {
        return { statusCode: err.statusCode, message: err.message };
    }
    // Handle Stripe errors (they have type property)
    if (err.type === 'StripeSignatureVerificationError' || err.type === 'StripeSignatureVerificationError') {
        return { statusCode: 400, message: 'Invalid webhook signature' };
    }
    if (err.message) {
        // Common error patterns
        if (err.message.includes('not found'))
            return { statusCode: 404, message: err.message };
        if (err.message.includes('not connected') || err.message.includes('Not connected'))
            return { statusCode: 400, message: err.message };
        // Authentication errors (invalid credentials) - check before generic "Invalid"
        if (err.message.includes('Invalid email or password') || err.message.includes('invalid email or password'))
            return { statusCode: 401, message: err.message };
        if (err.message.includes('unauthorized') || err.message.includes('Unauthorized'))
            return { statusCode: 401, message: err.message };
        // Other invalid errors
        if (err.message.includes('Invalid') || err.message.includes('invalid') || err.message.includes('signature'))
            return { statusCode: 400, message: err.message };
        if (err.message.includes('Forbidden') || err.message.includes('forbidden'))
            return { statusCode: 403, message: err.message };
        if (err.message.includes('required'))
            return { statusCode: 400, message: err.message };
        // Conflict errors (duplicate/already exists)
        if (err.message.includes('already exists') || err.message.includes('already registered') || err.message.includes('Email already'))
            return { statusCode: 409, message: err.message };
        // Default to 500 for unexpected errors
        return { statusCode: 500, message: 'An error occurred' };
    }
    return { statusCode: 500, message: 'An error occurred' };
}
