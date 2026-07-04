import { Router } from 'express';
import { 
  notificationGetActive, 
  notificationDismiss, 
  statsGetUserSeasonProfile 
} from '../Controllers/NotificationController';
import { validateAppId, authenticateToken } from '../Middleware/Index';

const router = Router();

router.post('/notificationGetActive', validateAppId, authenticateToken, notificationGetActive);
router.post('/notificationDismiss', validateAppId, authenticateToken, notificationDismiss);
router.post('/statsGetUserSeasonProfile', validateAppId, authenticateToken, statsGetUserSeasonProfile);

export default router;