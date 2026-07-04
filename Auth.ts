import { Request, Response, NextFunction } from "express";

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    (req as any).user = {
        userId: "246",
        nickName: "y2kzn",
        nickHash: "123",
        isBanned: false,
        isAdministrator: true,
        accountCreatedAt: new Date().toISOString(),
        currencies: {},
        logins: [],
        remainingReports: 3,
        worldRank: 0,
        userLanguage: "en",
        properties: {},
        lastSync: new Date().toISOString(),
        ntfupdatedat: new Date().toISOString(),
    };

    next();
};