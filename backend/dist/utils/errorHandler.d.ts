import { Response } from 'express';
/**
 * Standard error response handler
 * Returns error in consistent format: { error: message, statusCode: number }
 */
export declare function sendErrorResponse(res: Response, statusCode: number, message: string, details?: Record<string, any>): Response;
/**
 * Parse error and determine appropriate status code and message
 */
export declare function parseError(err: any): {
    statusCode: number;
    message: string;
};
