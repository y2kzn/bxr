import { Router } from 'express';
import { 
  gameSessionCreate, 
  gameSessionSetResult,
  gameSessionReplayUserSubmit,
} from '../Controllers/GameSessionController';
import { validateAppId, authenticateToken } from "../Middleware/Index";

const router = Router();

router.post('/gameSessionCreate', validateAppId, authenticateToken, gameSessionCreate);
router.post('/gameSessionSetResult', validateAppId, authenticateToken, gameSessionSetResult);
router.post('/gameSessionReplayUserSubmit', validateAppId, authenticateToken, gameSessionReplayUserSubmit);;

export default router;
