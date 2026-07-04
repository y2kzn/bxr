import { MongoClient, Db, ObjectId } from 'mongodb';
import { GenCaracters, GenIntCaracters  } from '../Utils/Cryptography';


let db: Db;

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.mongouri as string;
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db("TournamentSDK");
    
    await createCollections();
    console.log('mongodb conectado');
  } catch (error) {
    console.error('erro ao conectar ao mongiodb ', error);
    process.exit(1);
  }
};

const createCollections = async (): Promise<void> => {
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(col => col.name);

  if (!collectionNames.includes('Users')) {
    await db.createCollection('Users');
    await db.collection('Users').createIndex({ userId: 1 }, { unique: true });
    await db.collection('Users').createIndex({ deviceId: 1 }, { unique: true });
  }

  if (!collectionNames.includes('Tournaments')) {
    await db.createCollection('Tournaments');
    await db.collection('Tournaments').createIndex({ Id: 1 }, { unique: true });
  }

  if (!collectionNames.includes('GameSessions')) {
    await db.createCollection('GameSessions');
    await db.collection('GameSessions').createIndex({ gameSessionId: 1 }, { unique: true });
  }

  if (!collectionNames.includes('Notifications')) {
    await db.createCollection('Notifications');
  }

  if (!collectionNames.includes('Reports')) {
    await db.collection('Reports');
  }
};

export const getDatabase = (): Db => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const findUserById = async (userId: number) => {
  return await db.collection('Users').findOne({ userId: userId });
};

export const findByDeviceId = async (deviceId: string) => {
  return await db.collection("Users").findOne({ deviceId });
};

export const findByAcessToken = async (accessToken: string) => {
  return await db.collection('Users').findOne({ accessToken: accessToken });
}

export const createUser = async (userData: any) => {
  const user = {
    ...userData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await db.collection('Users').insertOne(user);
  return { ...user };
};

export const updateUser = async (userId: number, updateData: any) => {
  await db.collection('Users').updateOne(
    { userId: userId },
    { $set: { ...updateData, updatedAt: new Date() } }
  );
  return await findUserById(userId);
};

export const findTournamentById = async (tournamentId: string) => {
  return await db.collection('Tournaments').findOne({ Id: tournamentId });
};

export const updateTournamentData = async (tournamentId: string, tournamentData: any) => {
  return await db.collection("Tournaments").updateOne(
    { Id: tournamentId },
    { $set: { ...tournamentData } }
  );
};

export const findTournaments = async (limit: number = 10, page: number = 1) => {
return await db.collection('Tournaments')
    .find()
    .toArray();
};

export const findTournamentByInviteId = async (inviteId: string) => {
  return await db.collection('Tournaments').findOne({ 'Invites.inviteId': inviteId });
};

export const findTournamentByMatchId = async (matchId: string) => {
  return await db.collection('Tournaments').findOne({ 'AllMatches.matchId': matchId });
};

export const createTournament = async (tournamentData: any) => {
  const tournamentId = GenCaracters(5).toUpperCase();
  const tournament = await db.collection('Tournaments').insertOne(tournamentData);
  return tournament;
};

export const addTournamentParticipant = async (inviteId: string, tournamentId: string, userData: any) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) throw new Error('Tournament not found');

  const existingPlayer = tournament.Players?.find((player: any) => player.userId === userData.userId);
  if (existingPlayer) {
    return;
  }

  const platformInfo = userData.logins[0];
  const invite = {
    inviteId,
    inviteUserId: userData.userId,
    inviteUserPlatformId: platformInfo.platformId,
    inviteUserPlatformType: platformInfo.platformType,
    inviteUserNick: userData.nickName,
    status: 1,
    createdAt: new Date(),
    acceptedAt: new Date(),
    declinedAt: null,
    finalPlace: 0,
    prizeDelivered: false,
    isCheckedIn: false,
    partyCode: GenCaracters(6).toUpperCase()
  };

  const participant = {
    userId: userData.userId,
    nickName: userData.nickName,
    platformId: platformInfo.platformId,
    platformType: platformInfo.platformType,
    teamId: Math.floor(Math.random() * userData.userId),
    joinedAt: new Date(),
    status: 1,
    inviteId: inviteId,
    stats: {
      points: 0,
      wins: 0,
      losses: 0,
      playedRounds: 0
    }
  };

  await db.collection('Tournaments').updateOne(
    { Id: tournamentId },
    { 
      $push: { 
        Invites: invite,
        Players: participant 
      },
      $inc: { CurrentInvites: 1 }
    }
  );
  return participant;
};

export const addTournamentMatch = async (tournamentId: string, matchData: any) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) throw new Error('Tournament not found');
  
  const matchId = GenIntCaracters(8).toUpperCase();
  
  const match = {
    matchId: matchId.toString(),
    secret: matchData.secret,
    deadline: matchData.deadline,
    phaseId: matchData.phaseId || 0,
    groupId: matchData.groupId || 0,
    roundId: matchData.roundId || 0,
    status: 0,
    teams: matchData.teams || [],
    winScore: matchData.winScore || 1,  
    maxGameCount: matchData.maxGameCount || 1,
    currentGameCount: 0,
    gameSessions: [],
    minCheckinsPerTeam: 1,
    createdAt: new Date()
  };
  
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId },
    { $push: { AllMatches: match } }
  );
  return match;
};

export const getTournamentMatches = async (tournamentId: string,  phaseId?: string, fromRoundId?: string, toRoundId?: string, onlyInProgress?: string, groupId?: string
) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) return [];

  let matches = tournament.AllMatches || [];

  if (phaseId !== undefined) {
    matches = matches.filter((match: any) => String(match.phaseId) === phaseId);
  }

  if (fromRoundId !== undefined && toRoundId !== undefined) {
    matches = matches.filter((match: any) => {
      const round = Number(match.roundId);
      return round >= Number(fromRoundId) && round <= Number(toRoundId);
    });
  }

  if (onlyInProgress === "1") {
    matches = matches.filter((match: any) => String(match.status) === "1");
  }

  if (groupId !== undefined) {
    matches = matches.filter((match: any) => String(match.groupId) === groupId);
  }

  return matches;
};


export const getTournamentMatchesByIds = async (tournamentId: string, matchIds: string[]) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) return [];
  
  return (tournament.AllMatches || []).filter((match: any) => matchIds.includes(match.matchId));
};

export const getTournamentScores = async (
  tournamentId: string,
  phaseId?: number,
  groupId?: number
) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) return [];

  const scores = tournament.Players.map((player: any) => {
    return {
      partyId: player.partyId || "0",
      phaseId: phaseId || 0,
      groupId: groupId || 0,
      isCheckedIn: player.checkedIn || false,
      position: player.stats?.position || 0,
      totalPoints: player.stats?.points || 0,
      matchWins: player.stats?.matchWins || 0,
      matchLoses: player.stats?.matchLoses || 0,
      gameWins: player.stats?.gameWins || 0,
      gameLoses: player.stats?.gameLoses || 0,
      stat1Summed: player.stats?.stat1Summed || 0,
      stat2Summed: player.stats?.stat2Summed || 0,
      seed: player.stats?.seed || 0,
      loseWeight: player.stats?.loseWeight || 0,
      totalRounds: player.stats?.playedRounds || 0,
      users: [
        {
          userId: player.userId,
          checkedIn: player.checkedIn || false,
          isPartyLeader: player.isPartyLeader || false,
          status: player.status || 0,
          nick: player.nick || ""
        }
      ]
    };
  });

  return scores.sort((a, b) => b.totalPoints - a.totalPoints);
};

export const setUserReady = async (tournamentId: string, userId: number, isReady: boolean): Promise<void> => {
  const tournament = await db.collection("Tournaments").findOne({ Id: tournamentId });
  if (!tournament) return;

  const matches = tournament.AllMatches || [];

  const matchFound = matches.find((match: any) =>
    match.status !== 8 &&
    match.teams?.some((team: any) =>
      team.users?.some((u: any) => u.userId === userId)
    )
  );

  if (!matchFound) return;

  const matchId = matchFound.matchId;

  await db.collection("Tournaments").updateOne(
    { Id: tournamentId, "AllMatches.matchId": matchId },
    {
      $set: {
        "AllMatches.$[match].teams.$[].users.$[user].isReady": isReady,
        "AllMatches.$[match].teams.$[].users.$[user].checkedIn": true
      }
    },
    {
      arrayFilters: [
        { "match.matchId": matchId },
        { "user.userId": userId }
      ]
    }
  );
};


export const addTournamentInvite = async (tournamentId: string, inviteData: any) => {
    const inviteId = GenCaracters(5).toUpperCase();
    const invite = {
        inviteId,
        ...inviteData,
        status: 0,
        createdAt: new Date(),
        acceptedAt: null,
        declinedAt: null,
        finalPlace: 0,
        prizeDelivered: false,
        isCheckedIn: false,
        partyCode: GenIntCaracters(6),
        isPartyLeader: true
    };
    await db.collection('Tournaments').updateOne(
        { Id: tournamentId },
        { $push: { Invites: invite } }
    );
    return invite;
};

export const updateTournamentInvite = async (tournamentId: string, inviteId: string, updateData: any
) => {
  const updateFields: Record<string, any> = {};

  for (const key in updateData) {
    updateFields[`Invites.$.${key}`] = updateData[key];
  }

  await db.collection("Tournaments").updateOne(
    { Id: tournamentId, "Invites.inviteId": inviteId },
    { $set: updateFields }
  );
};


export const addTournamentParty = async (tournamentId: string, partyData: any) => {
  const partyCode = Math.floor(Math.random() * 999999).toString();
  const party = {
    partyCode,
    ...partyData,
    members: [partyData.creatorId],
    createdAt: new Date()
  };
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId },
    { $push: { Party: party } }
  );
  return party;
};

export const findTournamentPartyByCode = async (tournamentId: string, partyCode: string) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) return null;
  
  return (tournament.Party || []).find((party: any) => party.partyCode === partyCode);
};

export const addUserToTournamentParty = async (tournamentId: string, partyCode: string, userId: string) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'Party.partyCode': partyCode },
    { $push: { 'Party.$.members': userId } }
  );
};

export const removeUserFromTournamentParty = async (tournamentId: string, partyCode: string, userId: string) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'Party.partyCode': partyCode },
    { $pull: { 'Party.$.members': userId } }
  );
};

export const checkInToMatch = async (tournamentId: string, matchId: string, userId: string) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'AllMatches.matchId': matchId },
    { $set: { 'AllMatches.$[match].teams.$[].users.$[user].checkedIn': true } },
    { arrayFilters: [{ 'match.matchId': matchId }, { 'user.userId': userId }] }
  );
};

export const updateMatchUserStats = async (tournamentId: string, matchId: string, userId: string, stats: any) => {
  const setFields: any = {};
  if (Object.prototype.hasOwnProperty.call(stats, 'isReady')) setFields['AllMatches.$[match].teams.$[].users.$[user].isReady'] = stats.isReady;
  if (Object.prototype.hasOwnProperty.call(stats, 'checkedIn')) setFields['AllMatches.$[match].teams.$[].users.$[user].checkedIn'] = stats.checkedIn;
  if (Object.prototype.hasOwnProperty.call(stats, 'userScore')) setFields['AllMatches.$[match].teams.$[].users.$[user].userScore'] = stats.userScore;
  if (Object.prototype.hasOwnProperty.call(stats, 'teamScore')) setFields['AllMatches.$[match].teams.$[].users.$[user].teamScore'] = stats.teamScore;
  if (Object.prototype.hasOwnProperty.call(stats, 'userPoints')) setFields['AllMatches.$[match].teams.$[].users.$[user].userPoints'] = stats.userPoints;
  if (Object.prototype.hasOwnProperty.call(stats, 'teamPoints')) setFields['AllMatches.$[match].teams.$[].users.$[user].teamPoints'] = stats.teamPoints;
  if (Object.prototype.hasOwnProperty.call(stats, 'matchPoints')) setFields['AllMatches.$[match].teams.$[].users.$[user].matchPoints'] = stats.matchPoints;
  if (Object.prototype.hasOwnProperty.call(stats, 'isWinner')) setFields['AllMatches.$[match].teams.$[].users.$[user].isWinner'] = stats.isWinner;

  if (Object.keys(setFields).length === 0) return;

  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'AllMatches.matchId': matchId },
    { $set: setFields },
    { arrayFilters: [{ 'match.matchId': matchId }, { 'user.userId': userId }] }
  );
};

export const updateTournamentMatch = async (tournamentId: string, matchId: string, updateData: any) => {
  const updateFields: any = {};

  for (const key in updateData) {
    updateFields[`AllMatches.$.${key}`] = updateData[key];
  }

  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'AllMatches.matchId': matchId },
    { $set: updateFields }
  );
};

export const createTournamentTeam = async (tournamentId: string, teamData: any) => {
  const teamId = `TM${GenCaracters(5).toUpperCase()}`;
  const team = {
    teamId,
    ...teamData,
    members: [],
    createdAt: new Date()
  };
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId },
    { $push: { Teams: team } }
  );
  return team;
};

export const addUserToTournamentTeam = async (tournamentId: string, teamId: string, userId: string) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'Teams.teamId': teamId },
    { $push: { 'Teams.$.members': userId } }
  );
};

export const removeUserFromTournamentTeam = async (tournamentId: string, teamId: string, userId: string) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'Teams.teamId': teamId },
    { $pull: { 'Teams.$.members': userId } }
  );
};

export const updateTournamentPlayerStats = async (tournamentId: string, userId: string, stats: any) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'Players.userId': userId },
    { $set: { 'Players.$.stats': { ...stats } } }
  );
};

export const getTournamentPlayer = async (tournamentId: string, userId: string) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) return null;
  
  return (tournament.Players || []).find((player: any) => player.userId === userId);
};

export const updateTournamentPhase = async (tournamentId: string, phaseId: string, updateData: any) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'Phases.phaseId': phaseId },
    { $set: { 'Phases.$': { ...updateData } } }
  );
};

export const findTournamentByType = async (type: number) => {
  return await db.collection('Tournaments').findOne({ Type: type });
};

export const findActiveTournaments = async () => {
  return await db.collection('Tournaments')
    .find({ Status: { $in: [0, 1] } })
    .toArray();
};

export const updateTournamentStatus = async (tournamentId: string, status: number) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId },
    { $set: { Status: status } }
  );
};

export const addPlayerToTournament = async (tournamentId: string, playerData: any) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId },
    { 
      $push: { Players: playerData },
      $inc: { CurrentInvites: 1 }
    }
  );
};

export const removePlayerFromTournament = async (tournamentId: string, userId: string) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId },
    { 
      $pull: { Players: { userId: userId } },
      $inc: { CurrentInvites: -1 }
    }
  );
};

export const getTournamentLeaderboard = async (tournamentId: string) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) return [];
  
  return tournament.Players?.sort((a: any, b: any) => b.stats?.points - a.stats?.points) || [];
};

export const updateTournamentMatchResult = async (tournamentId: string, matchId: string, results: any) => {
  await db.collection('Tournaments').updateOne(
    { Id: tournamentId, 'AllMatches.matchId': matchId },
    { $set: { 'AllMatches.$.results': results, 'AllMatches.$.status': 2 } }
  );
};

export const findTournamentMatchesByStatus = async (tournamentId: string, status: number) => {
  const tournament = await db.collection('Tournaments').findOne({ Id: tournamentId });
  if (!tournament) return [];
  
  return (tournament.AllMatches || []).filter((match: any) => match.status === status);
};

export const deleteTournament = async (tournamentId: string) => {
  await db.collection('Tournaments').deleteOne({ Id: tournamentId });
};

export const bulkUpdateTournamentPlayers = async (tournamentId: string, updates: any[]) => {
  const bulkOps = updates.map(update => ({
    updateOne: {
      filter: { Id: tournamentId, 'Players.userId': update.userId },
      update: { $set: { 'Players.$': update } }
    }
  }));
  
  await db.collection('Tournaments').bulkWrite(bulkOps);
};

export const findGameSessionById = async (gameSessionId: string) => {
  return await db.collection('GameSessions').findOne({ gameSessionId });
};

export const createGameSession = async (sessionData: any) => {
  const gameSessionId = `${GenIntCaracters(6)}`;
  const session = {
    gameSessionId,
    ...sessionData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await db.collection('GameSessions').insertOne(session);
  return session;
};

export const updateGameSession = async (gameSessionId: string, updateData: any) => {
  await db.collection('GameSessions').updateOne(
    { gameSessionId },
    { $set: { ...updateData, updatedAt: new Date() } }
  );
};

export const createNotification = async (notificationData: any) => {
  const notificationId = `N${Date.now()}`;
  const notification = {
    notificationId,
    ...notificationData,
    read: false,
    createdAt: new Date()
  };
  await db.collection('Notifications').insertOne(notification);
  return notification;
};

export const findUserNotifications = async (userId: string) => {
  return await db.collection('Notifications')
    .find({ userId, read: false })
    .sort({ createdAt: -1 })
    .toArray();
};

export const markNotificationAsRead = async (notificationId: string) => {
  await db.collection('Notifications').updateOne(
    { notificationId },
    { $set: { read: true, readAt: new Date() } }
  );
};

export const createReport = async (reportData: any) => {
  const reportId = `${GenIntCaracters(5).toUpperCase()}`
  const report = {
    reportId,
    ...reportData,
    createdAt: new Date()
  };
  await db.collection('Reports').insertOne(report);
  return report;
};