
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';
import { AppError } from './error-handler';

export const validate = (schema: AnyZodObject) => 
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      next(new AppError(400, 'Invalid request data'));
    }
  };
