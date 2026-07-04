import { Router } from 'express';
import { 
  tournamentGetList, 
  tournamentGetData,
  tournamentGetScore,
  tournamentGetMatches,
  tournamentGetMatchesByIds,
  tournamentSignup,
  tournamentProcessInvite,
  tournamentPartyCreateCode,
  tournamentPartyJoinByCode,
  tournamentPartyRemoveUser
} from '../Controllers/TournamentController';
import { validateAppId, authenticateToken } from '../Middleware/Index';

const router = Router();

router.post('/tournamentGetList', validateAppId, authenticateToken, tournamentGetList);
router.post('/tournamentGetData', validateAppId, authenticateToken, tournamentGetData);
router.post('/tournamentGetScores', validateAppId, authenticateToken, tournamentGetScore);
router.post('/tournamentGetMatches', validateAppId, authenticateToken, tournamentGetMatches);
router.post('/tournamentGetMatchesByIds', validateAppId, authenticateToken, tournamentGetMatchesByIds);

router.post('/tournamentSignup', validateAppId, authenticateToken, tournamentSignup);
router.post('/tournamentProcessInvite', validateAppId, authenticateToken, tournamentProcessInvite);

router.post('/tournamentPartyCreateCode', validateAppId, authenticateToken, tournamentPartyCreateCode);
router.post('/tournamentPartyJoinByCode', validateAppId, authenticateToken, tournamentPartyJoinByCode);
router.post('/tournamentPartyRemoveUser', validateAppId, authenticateToken, tournamentPartyRemoveUser);
export default router;