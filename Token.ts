import jwt from 'jsonwebtoken';
import { serverConfig } from '../Config/Server';

export const generateAccessToken = (hash: string): string => {
  return jwt.sign({ hash }, serverConfig.jwtSecret, { expiresIn: '1h' });
};

export const generateRefreshToken = (hash: string): string => {
  return jwt.sign({ hash }, serverConfig.jwtSecret, { expiresIn: '7d' });
};