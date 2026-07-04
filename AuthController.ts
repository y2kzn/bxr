import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { updateUser, getDatabase, findByDeviceId } from '../Config/Database';
import { createResponse } from '../Utils/Response';
import { generateAccessToken, generateRefreshToken } from '../Utils/Token';
import { GenCaracters, Hash } from '../Utils/Cryptography';

export const ping = (req: Request, res: Response): void => {
  res.status(200).json(createResponse(0, 'pong', { serverTime: new Date().toISOString() }));
};

export const userLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, nickName, clientToken, createNewUser, deviceId, deviceName, devicePlatform, ...providerParams } = req.body;

    let user = await findByDeviceId(deviceId) as any;
    const expireAt = new Date(Date.now() + 60 * 60 * 1000);

    if (createNewUser == 1 && !user) {
      const hashSeed = `${await bcrypt.hash(clientToken, 4)}${userId}${deviceName}`;
      const hash = Hash("sha256", hashSeed);
      const accessToken = generateAccessToken(`${hash}`);
      const refreshToken = generateRefreshToken(`${hash}`);

      const nickHash = Math.floor(Math.random() * 100);

      user = {
        userId,
        nickName: nickName,
        nickHash: nickHash,
        accessToken,
        refreshToken,
        expireAt: expireAt.toISOString(),
        deviceId,
        level: 1,
        deviceName,
        experience: 0,
        ntfupdatedat: new Date().toISOString(),
        userLanguage: "en",
        remainingReports: 3,
        reportsResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastReportedUsers: [],
        currencies: [
          {
            currencyid: 1,
            amount: 100 
          }
        ],
        logins: [
          {
            platformType: 7,
            platformId: userId,
          }
        ],
        seasonData: {
          seasonid: 1,
          season: 1,
          seasonday: 1,
          csseed: Math.floor(Math.random() * 1000000),
          psseed: 0,
          seasonseedend: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          seasonprogress: 0.0,
        },
        properties: [
          {
             "@name": "server_region",
             "@value": "SA"
          }
        ],
        accountCreatedAt: new Date().toISOString(),
        dataCreatedAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        isSyncDirty: false,
        isBanned: false,
        rankScore: 0,
        worldRank: 0
      };

      await getDatabase().collection("Users").insertOne(user);
    } else if (user) {
      await updateUser(user.userId, { 
        lastLogin: new Date()
      });
    } else {
      res.status(400).json(createResponse(-1, 'error', null, 'AUTH_006'));
      return;
    }


    res.status(200).json(createResponse(1, "login successful", {
      deviceId,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      expireAt: user.expireAt
    }));

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(createResponse(500, 'Internal server error', null, 'SYS_001'));
  }
};

export const userConnect = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId, deviceName, devicePlatform, ...providerParams } = req.body;
    const user = (req as any).user;

    const updatedLogins = Array.isArray(user.logins) ? [...user.logins] : [];
    
    const loginExists = updatedLogins.some(login => 
      login.platformType === 0 && login.platformId === deviceId
    );
    
    if (!loginExists) {
      updatedLogins.push({
        platformType: 0,
        platformId: deviceId
      });
    }

    const updatedCurrencies = Array.isArray(user.currencies) ? [...user.currencies] : [];
    
    if (!updatedCurrencies.find(c => c.currencyid === 1)) {
      updatedCurrencies.push({ currencyid: 1, amount: 1000 });
    }
    
    if (!updatedCurrencies.find(c => c.currencyid === 2)) {
      updatedCurrencies.push({ currencyid: 2, amount: 50 });
    }

    const newUser = await updateUser(user.userId, { 
      lastLogin: new Date(),
      logins: updatedLogins,
      currencies: updatedCurrencies
    });

    const responseData = {
      id: newUser.userId,
      nick: newUser.nickName,
      nickhashnumber: newUser.nickHash,
      rank: newUser.rankScore || 0,
      worldrank: newUser.worldRank || 0,
      createdAt: newUser.accountCreatedAt,
      lastsync: newUser.lastSync,
      remainingReports: newUser.remainingReports,
      reportsResetAt: newUser.reportsResetAt,
      ban: newUser.isBanned || false,
      serverTime: new Date().toISOString(),
      logins: newUser.logins || [],
      currencies: newUser.currencies || []
    };

    res.json(createResponse(1, "user connected", responseData));
  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json(createResponse(500, 'Internal server error', null, 'SYS_009'));
  }
};

export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken, deviceId } = req.body;
    const user = await findByDeviceId(deviceId);

    if (!user) {
      res.status(404).json(createResponse(404, 'User not found', null, 'AUTH_007'));
      return;
    }

    if (user.refreshToken != refreshToken) {
       res.status(401).json(createResponse(401, 'Invalid refresh token', null, 'AUTH_008'));
       return;
    }

    const tokenSeed = `${user.userId}${user.nickName}${user.deviceName}`;
    const newAccessToken = generateAccessToken(tokenSeed);
    const newRefreshToken = generateRefreshToken(tokenSeed);
    const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const updatedUser = await updateUser(user.userId, { 
      accessToken: newAccessToken, 
      expireAt, 
      refreshToken: newRefreshToken
    });

    res.json(createResponse(1, 'Access token refreshed', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expireAt: expireAt.toISOString()
    }));
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json(createResponse(500, 'Internal server error', null, 'SYS_010'));
  }
};
