import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
        return res.status(400).json({
          error: 'Validation failed',
          details: messages,
        });
      }
      next(error);
    }
  };
};

