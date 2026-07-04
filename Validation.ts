import { Request, Response, NextFunction } from 'express';
import { createResponse } from '../Utils/Response';
import { Decrypt, Encrypt, Hash } from '../Utils/Cryptography';

export const validateAppId = (req: Request, res: Response, next: NextFunction): void => {
  const appId = req.header('backbone_app_id');

  const allowedAppIds = (process.env.appIds ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  if (!appId) {
    res.status(400).json(createResponse(7, 'auth header required', null, 'APP_001'));
    return;
  }

  if (!allowedAppIds.includes(appId)) {
    res.status(401).json(createResponse(13, 'appid invalid', null, 'APP_001'));
    return;
  }

  (req as any).appId = appId;

  next();
};
