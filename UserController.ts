  import { Request, Response } from 'express';
  import { findUserById, updateUser } from '../Config/Database';
  import { createResponse } from '../Utils/Response';
  import { Hash } from '../Utils/Cryptography';

  export const userGet = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { getQuests, getTiles, getLayouts } = req.body;

      const responseData: any = {
        ban: user.isBanned || false,
        createdAt: user.accountCreatedAt,
        nick: user.nickName,
        nickhashnumber: `${user.nickHash}`,
        id: user.userId.toString(),
        logins: user.logins || [],
        currencies: user.currencies,
        rank: user.rankScore || 0,
        ntfupdatedat: user.ntfupdatedat,
        worldrank: user.worldRank || 0,
        lastsync: user.lastSync,
        remainingReports: user.remainingReports || 3,
        reportsResetAt: user.reportsResetAt,
        properties: user.properties,
        ...user.seasonData,
        serverTime: new Date().toISOString(),
      };

      if (user.properties || user.userLanguage) {
        responseData.usersettingdata = {
          "user-data": {
            "@language": user.userLanguage || "en",
            "properties": user.properties ? Object.entries(user.properties).map(([key, value]) => ({
              "property": {
                "name": { "#text": [{ "value": key }] },
                "value": { "#text": [{ "value": value }] }
              }
            })) : []
          }
        };
      }

      const updates: any = {
        ntfupdatedat: new Date().toISOString(),
        isSyncDirty: true,
        lastSync: new Date().toISOString()
      };

      await updateUser(user.userId, updates);

      res.json(createResponse(1, "get user", responseData));
    } catch (error) {
      console.error('User get error:', error);
      res.status(500).json(createResponse(500, 'Internal server error', null, 'SYS_002'));
    }
  };

  export const userChangeNick = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { nickName } = req.body;

      if (!nickName || nickName.trim().length === 0) {
        res.status(400).json(createResponse(0, "Invalid nickname", null, 'USER_001'));
        return;
      }

      const newNickHash = Math.floor(Math.random() * 1000);

      await updateUser(user.userId, { 
        nickName: nickName.trim(),
        nickHash: newNickHash,
        lastSync: new Date().toISOString()
      });

      res.status(200).json(createResponse(1, "name changed", 
      {
        nick: nickName,
        nickhashnumber: `#${newNickHash}`,
        id: user.userId.toString(),
        lastsync: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Change nick error:', error);
      res.status(500).json(createResponse(500, 'Internal server error', null, 'SYS_003'));
    }
  };

  export const userReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { reportUserId, reportReason, tournamentId, tournamentMatchId, gameSessionId } = req.body;
      
      if (!reportUserId) {
        res.status(400).json(createResponse(0, "Invalid user ID", null, 'USER_004'));
        return;
      }

      const now = new Date();

      if (user.reportsResetAt <= now) {
        await updateUser(user.userId, {
          remainingReports: 3,
          lastReportedUsers: [],
          reportsResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
      }

      const currentUser = await findUserById(user.userId);
      
      if (currentUser.remainingReports <= 0) {
        res.status(400).json(createResponse(0, "No reports remaining", {
          reported: false,
          remainingReports: currentUser.remainingReports
        }));
        return;
      }

      if (currentUser.lastReportedUsers && currentUser.lastReportedUsers.includes(reportUserId)) {
        res.status(400).json(createResponse(0, "User already reported", {
          reported: false,
          remainingReports: currentUser.remainingReports
        }));
        return;
      }

      const updatedRemainingReports = currentUser.remainingReports - 1;
      const updatedLastReportedUsers = [...(currentUser.lastReportedUsers || []), reportUserId];

      await updateUser(user.userId, {
        remainingReports: updatedRemainingReports,
        lastReportedUsers: updatedLastReportedUsers,
        lastSync: new Date().toISOString()
      });

      res.json(createResponse(1, "user reported", {
        reportUserId,
        reportReason,
        reported: true,
        remainingReports: updatedRemainingReports,
        reportsResetAt: currentUser.reportsResetAt.toISOString()
      }));
    } catch (error) {
      console.error('Report error:', error);
      res.status(500).json(createResponse(500, 'Internal server error', null, 'USER_002'));
    }
  };

  export const userSync = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const syncData = req.body;

      if (syncData && syncData["user-data"]) {
        const userData = syncData["user-data"];
        
        const updates: any = {};
        
        if (userData["@language"]) {
          updates.userLanguage = userData["@language"];
        }

        if (userData.properties && userData.properties[0] && userData.properties[0].property) {
          const properties = userData.properties[0].property;
          if (Array.isArray(properties)) {
            updates.properties = {};
            properties.forEach((prop: any) => {
              if (prop.name && prop.name["#text"] && prop.name["#text"][0] && prop.value && prop.value["#text"] && prop.value["#text"][0]) {
                const key = prop.name["#text"][0].value;
                const value = prop.value["#text"][0].value;
                updates.properties[key] = value;
              }
            });
          }
        }

        await updateUser(user.userId, {
          ...updates,
          lastSync: new Date().toISOString(),
          isSyncDirty: false
        });

        res.json(createResponse(1, "user data synced", {
          id: user.userId.toString(),
          lastsync: new Date().toISOString()
        }));
      } else {
        res.status(400).json(createResponse(0, "Invalid sync data", null, 'USER_005'));
      }
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json(createResponse(500, 'Internal server error', null, 'USER_003'));
    }
  };
