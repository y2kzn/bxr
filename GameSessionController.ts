import { Request, Response } from 'express';
import { 
  createGameSession, 
  findGameSessionById, 
  findTournamentByMatchId, 
  updateGameSession, 
  updateMatchUserStats, 
  updateTournamentMatch, 
  updateTournamentPlayerStats 
} from '../Config/Database';
import { createResponse } from '../Utils/Response';
import { parseStringPromise } from 'xml2js';
import { processGameResult } from '../Handlers/TournamentHandler';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const gameSessionCreate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameSessionData } = req.body;
    const user = (req as any).user;

    const gameSession = await createGameSession({
      participants: [{ id: user.userId, score: 0, position: 1 }],
      sessionData: gameSessionData,
      status: 'active'
    });

    res.json(createResponse(0, 'Game session created', {
      id: gameSession.gameSessionId
    }));
  } catch (error) { 
    res.status(500).json(createResponse(500, 'Internal server error', null, 'GS_001'));
  }
};

export const gameSessionSetResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameSessionId, gameSessionData } = req.body;
    const user = (req as any).user;

    if (!gameSessionId || !gameSessionData) {
      res.status(400).json(createResponse(400, 'Missing required fields', null, 'GS_001'));
      return;
    }

    const gameSession = await findGameSessionById(gameSessionId);
    const parsedData = await parseStringPromise(gameSessionData);
    const gameSessionArray = parsedData?.data?.['game-session'];
    
    if (!gameSessionArray || gameSessionArray.length === 0) {
      res.status(400).json(createResponse(400, 'Invalid game session data', null, 'GS_004'));
      return;
    }

    const gameSessionAttr = gameSessionArray[0]?.$ || {};
    const users = gameSessionArray[0]?.user || [];
    const matchId = gameSessionAttr['tournament-match-id'];

    const userResult = users.find((u: any) => u.$['user-id'] === user.userId.toString());
    
    if (!userResult) {
      res.status(400).json(createResponse(400, 'User not found in game session results', null, 'GS_007'));
      return;
    }

    const place = parseInt(userResult?.$?.place);
    const teamId = userResult?.$?.['team-id'];

    if (isNaN(place) || place < 1) {
      res.status(400).json(createResponse(400, 'Invalid place value', null, 'GS_008'));
      return;
    }

    const tournament = await findTournamentByMatchId(matchId);
    const userResults = users.map((u: any) => ({
      userId: u.$['user-id'],
      teamId: u.$['team-id'],
      place: parseInt(u.$.place)
    }));

    userResults.sort((a, b) => a.place - b.place);

    for (const result of userResults) {
      const isWinner = result.place === 1;
      
      await updateTournamentPlayerStats(tournament.Id, result.userId, {
        wins: isWinner ? +1 : 0,
        playedRounds: 1,
      });

      await updateMatchUserStats(tournament.Id, matchId, result.userId, {
        isWinner,
        userScore: isWinner ? 1 : 0,
      });
    }

    if (matchId) {
      await processGameResult(tournament.Id, matchId, {
        users: userResults,
        gameTime: parseFloat(gameSessionAttr.time),
        playDate: gameSessionAttr['play-date']
      });
    }

    const completedAt = new Date();
    const status = place === 1 ? 'won' : 'lost';
    
    await updateGameSession(gameSession.gameSessionId, {
      resultData: gameSessionData,
      status,
      completedAt,
      matchId,
      place
    });

    await updateTournamentMatch(tournament.Id, matchId, {
      status: 8
    });

    res.json(createResponse(0, 'Result saved successfully', { 
      gameSessionId, 
      status, 
      completedAt,
      place,
      matchId,
      teamId
    }));
  } catch (error) {
    console.error('gameSessionSetResult error:', error);
    res.status(500).json(createResponse(500, 'Internal server error', null, 'GS_003'));
  }
};

export const gameSessionReplayUserSubmit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameSessionId, gameSessionReplayData} = req.body;

    const dir = path.join(__dirname, '../../storage/replays');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const rawPath = path.join(dir, `${gameSessionId}_raw`);
    const mp4Path = path.join(dir, `${gameSessionId}.mp4`);

    const writeStream = fs.createWriteStream(rawPath);

    writeStream.write(Buffer.from(gameSessionReplayData, 'base64'));
    writeStream.end();

    ffmpeg(rawPath)
      .outputOptions('-movflags faststart')
      .toFormat('mp4')
      .save(mp4Path)
      .on('end', () => {
        fs.unlinkSync(rawPath);

        res.json(createResponse(0, 'Replay submitted successfully', {
          id: gameSessionId,
        }));
        return;
      })
      .on('error', () => {
        res.status(500).json(createResponse(500, 'Replay conversion failed', null, 'GS_009'));
        return;
      });

  } catch (error) {
    res.status(500).json(createResponse(500, 'Internal server error', null, 'GS_004'));
  }
};
