import { Request, Response } from 'express';
import { findUserNotifications, markNotificationAsRead } from '../Config/Database';
import { createResponse } from '../Utils/Response';

export const notificationGetActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const notifications = await findUserNotifications(user.userId);

    const payload = notifications.map((notif: any) => ({
      id: String(notif.notificationId || ''),
      groupId: String(notif.groupId || '0'),
      type: Number(notif.type || 2),
      message: String(notif.message || ''),
      isDismissed: Boolean(notif.read || false),
      created: new Date(notif.createdAt || new Date()).toISOString()
    }));

    res.json(payload);
  } catch (error) {
    res.status(500).json(createResponse(500, 'Internal server error', null, 'NOTIF_001'));
  }
};

export const notificationDismiss = async (req: Request, res: Response): Promise<void> => {
  try {
    const { notificationId } = req.body;
    const user = (req as any).user;

    await markNotificationAsRead(notificationId);

    res.json(createResponse(0, 'Notification dismissed', {
      notificationId,
      dismissed: true
    }));
  } catch (error) {
    res.status(500).json(createResponse(500, 'Internal server error', null, 'NOTIF_003'));
  }
};

export const statsGetUserSeasonProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, userPlatformType, userPlatformId, season } = req.body;
    
    res.json(createResponse(0, 'User season profile retrieved', {
      season,
      profile: {
        wins: 15,
        losses: 5,
        rank: 'Gold',
        points: 1250,
        gamesPlayed: 20
      }
    }));
  } catch (error) {
    res.status(500).json(createResponse(500, 'Internal server error', null, 'STATS_001'));
  }
};
