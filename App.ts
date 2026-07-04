import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, findTournaments } from './Config/Database';
import { serverConfig } from './Config/Server';
import { createTour } from './Utils/TournamentData';

import authRoutes from './Routes/AuthRoutes';
import userRoutes from './Routes/UserRoutes';
import tournamentRoutes from './Routes/TournamentRoutes';
import gameSessionRoutes from './Routes/GameSessionRoutes';
import notificationRoutes from './Routes/NotificationRoutes';
import { validateAppId, authenticateToken } from './Middleware/Index';
import { checkAllWalkovers } from './Handlers/TournamentHandler';
import { GenIntCaracters } from './Utils/Cryptography';

const app = express();
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

const isOpen = true;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (!isOpen) {
    return res.status(503).json({
      code: -1,
      message: "Servers OFF, Await for news....",
      reference: "XD"
    });
  }

  next();
});

app.use(helmet());
app.use(cors());

// TUTTE LE ROUTE SONO PUBBLICHE
app.use('/api/v1', authRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1', tournamentRoutes);
app.use('/api/v2', tournamentRoutes);
app.use('/api/v1', gameSessionRoutes);
app.use('/api/v1', notificationRoutes);



app.use((err, req, res, next) => {
  console.error('Express error:', err);
  if (res.headersSent) return next(err);
  try {
    res.status(200).json({ code: 0, message: 'ok' });
  } catch {}
});

const startServer = async () => {
  try {
    await connectDatabase();
      await createTour({
      id: GenIntCaracters(12),
      type: 1,
      status: 1,
      tournamentDate: new Date('2025-12-21T12:30:00.000Z'),
      startHour: 12,
      startMinute: 30,
      invitationOffsetHours: 0,
      invitationOffsetMinutes: -1,
      registrationOffsetHours: 0,
      registrationOffsetMinutes: -1, 
      invitationCloseOffsetHours: 0,
      invitationCloseOffsetMinutes: -1,
      tournamentName: "StumbleKriv 1v1 ~ EU",
      maxInvites: 32,
      partySize: 1,
      currentInvites: 0,
      phaseCount: 1,
      roundCount: 5,
      themeColor: "#0973ecff",
      entryFeeAmount: 1,
      prizeAmount: 500,
      sponsorName: "EU",
      sponsorImageUrl: "",
      imageUrl: null,
      iconUrl: "https://i.imgur.com/KuAfYTi.png",
      highlightsUrl: "https://discord.gg/beastsg",
      streamUrl: "https://discord.gg/beastsg",
      serverRegion: "sa",
      entryFeeType: 10,
      entryFeeId: "1019395748292202883",
      entryFeeItemAmount: 1000,
      disableEmotes: "6,8,124,13,123,55,122,156,174,217,218,234,239,240,254",
      phaseOverrideLevel: "level19_block",
      requiredVersion: "0.64",
      minimumVersion: "0.64",
      overrideMaxQualified: "1",
      maxWaitTime: "120",
      gameRoundCount: "1",
      phaseType: 2,
      maxPlayers: 1,
      maxTeams: 1,
      minTeamsPerMatch: 2,
      maxTeamsPerMatch: 2,
      minCheckinsPerTeam: 1,
      groupCount: 1,
      isLoserBracketSeeded: true,
      isSkipAllowed: false,
      maxLoses: 1,
      allowedRebuyCount: 0,
      allowedRebuyUntilRoundId: 0,
      rebuyPrice: 0,
      roundMaxLength: 12,
      roundMinGameLength: 8,
      winScore: "1",
      matchPointDistribution: "1",
      prizeToPlace: 1,
      prizeType: 1,
      prizeId: 1,
      onlyInviteds: false,
      Convidados: ["0", "1",]
    }); 
    setInterval(() => {
   findTournaments(5, 1).then(tournaments => {
    tournaments.reduce((p, t) => {
      return p.then(() => {
        if (t.Status === 5 && t.AllMatches) {
          return checkAllWalkovers(t.Id);
        }
      });
    }, Promise.resolve());
  });
}, 12000);

  } catch (error) {
    console.error('Database connection failed:', error);
  }
  app.listen(serverConfig.port, () => {
    console.log(`backbone rodando em ${serverConfig.port}`);
    console.log(`Environment: ${serverConfig.nodeEnv}`);
  });
};

process.on('unhandledRejection', err => console.error('Unhandled Promise Rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));

startServer();

export default app;
