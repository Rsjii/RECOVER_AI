"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const validate = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
                return res.status(400).json({
                    error: 'Validation failed',
                    details: messages,
                });
            }
            next(error);
        }
    };
};
exports.validate = validate;
