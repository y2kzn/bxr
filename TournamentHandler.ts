import { Request, Response } from 'express';
import {  
  findTournamentById, 
  addTournamentMatch,
  updateTournamentMatch,
  addTournamentParticipant
} from '../Config/Database';
import { createResponse } from '../Utils/Response';
import { GenCaracters, GenIntCaracters  } from '../Utils/Cryptography';

const MatchStatus = {
  Unknown: -1,
  Created: 0,
  WaitingForOpponent: 1,
  GameReady: 2,
  GameInProgress: 3,
  GameFinished: 4,
  MatchFinished: 8,
};

const PhaseType = {
  SingleElimination: 2,
  Groups: 3
};

const getTeamSize = (tournament: any, phase: any) => {
  const p = parseInt(String(tournament.PartySize ?? 1));
  return Number.isNaN(p) ? 1 : Math.max(1, p);
};

const composeTeams = (players: any[], teamSize: number) => {
  const teams: any[] = [];
  let teamIdCounter = 1;

  for (let i = 0; i < players.length; i += teamSize) {
    const chunk = players.slice(i, i + teamSize);
    const users = chunk.map((pl) => createPlayerMatchData(pl));
    teams.push({ teamId: teamIdCounter++, users, score: 0, points: 0 });
  }

  return teams;
};

const shuffleArray = (array: any[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const createPlayerMatchData = (player: any) => {
  return {
    userId: player.userId,
    platformId: player.platformId || "",
    platformType: player.platformType || 0,
    nick: player.nickName || "",
    checkedIn: false,
    isReady: false,
    userScore: 0,
    teamScore: 0,
    userPoints: 0,
    teamPoints: 0,
    matchPoints: 0,
    isWinner: false
  };
};

const generateSecret = () => {
  return GenCaracters(64).toLowerCase();
};

export const initializeTournamentPhase = async (tournamentId: string, phase: any) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return;

  const players = tournament.Players || [];
  
  let matches = [];
  const teamSize = getTeamSize(tournament, phase);
  
  if (phase.Type === PhaseType.SingleElimination) {
    matches = generateRandomBracketMatches(players, phase, tournamentId, teamSize);
  } else if (phase.Type === PhaseType.Groups) {
    const groups = distributePlayersToGroups(players, phase.GroupCount || 1);
    matches = generateGroupMatches(groups, phase, tournamentId, teamSize);
  } else {
    matches = generateRandomBracketMatches(players, phase, tournamentId, teamSize);
  }
  
  for (const match of matches) {
    await addTournamentMatch(tournamentId, match);
  }
};

export const generateRandomBracketMatches = (players: any[], phase: any, tournamentId: string, teamSize: number) => {
  const matches: any[] = [];
  const playerCount = players.length;
  
  if (playerCount < 2) return matches;
  
  const shuffledPlayers = shuffleArray(players);
  const balancedTeams = composeTeams(shuffledPlayers, teamSize);
  const teamCount = balancedTeams.length;
  let roundId = 1;
  let matchSeq = 1;
  
  const now = new Date();
  
  for (let i = 0; i < teamCount; i += 2) {
    const t1 = balancedTeams[i];
    const t2 = balancedTeams[i + 1];
    
    if (t1 && !t2) {
      const deadline = new Date();
      deadline.setMinutes(deadline.getMinutes() + 30);
      
      const match = {
        matchId: GenIntCaracters(6),
        phaseId: phase.Id,
        groupId: "1",
        roundId: roundId.toString(),
        teams: [t1],
        status: MatchStatus.WaitingForOpponent,
        winScore: phase.WinScore || 1,
        maxGameCount: phase.MaxGameCount || 2,
        currentGameCount: 1,
        minCheckinsPerTeam: phase.MinCheckinsPerTeam || Math.max(1, teamSize),
        secret: generateSecret(),
        deadline: deadline,
        created: now,
        bracketPosition: matchSeq,
        winnerUserId: null
      };
      matches.push(match);
    } else if (t1 && t2) {
      const deadline = new Date();
      deadline.setMinutes(deadline.getMinutes() + 10);
      
      const match = {
        matchId: GenIntCaracters(6),
        phaseId: phase.Id,
        groupId: "1",
        roundId: roundId.toString(),
        teams: [t1, t2],
        status: MatchStatus.Created,
        winScore: phase.WinScore || 1,
        maxGameCount: phase.MaxGameCount || 2,
        currentGameCount: 1,
        minCheckinsPerTeam: phase.MinCheckinsPerTeam || Math.max(1, teamSize),
        secret: generateSecret(),
        deadline: deadline,
        created: now,
        bracketPosition: matchSeq,
        winnerUserId: null
      };
      matches.push(match);
    }
    matchSeq++;
  }
  
  return matches;
};

export const generateGroupMatches = (groups: any[], phase: any, tournamentId: string, teamSize: number) => {
  const matches: any[] = [];
  let matchId = 1;
  
  const now = new Date();
  
  groups.forEach((group, groupIndex) => {
    const groupPlayers = group;
    const groupId = (groupIndex + 1).toString();
    
    if (groupPlayers.length < 2) return;
    
    const shuffledPlayers = shuffleArray(groupPlayers);
    const teams = composeTeams(shuffledPlayers, teamSize);
    
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const t1 = teams[i];
        const t2 = teams[j];
        
        const deadline = new Date();
        deadline.setMinutes(deadline.getMinutes() + 10);
        
        const match = {
          matchId: `${tournamentId}_${phase.Id}_${matchId++}`,
          phaseId: phase.Id,
          groupId: groupId,
          roundId: "1",
          teams: [t1, t2],
          status: MatchStatus.Created,
          winScore: phase.WinScore || 1,
          maxGameCount: phase.MaxGameCount || 2,
          currentGameCount: 1,
          minCheckinsPerTeam: phase.MinCheckinsPerTeam || Math.max(1, teamSize),
          secret: generateSecret(),
          deadline: deadline,
          created: now
        };
        matches.push(match);
      }
    }
  });
  
  return matches;
};

export const distributePlayersToGroups = (players: any[], groupCount: number) => {
  if (!players || players.length === 0) return [];
  
  const groups: any[] = Array.from({ length: groupCount }, () => []);
  
  const shuffledPlayers = shuffleArray(players);
  
  for (let i = 0; i < shuffledPlayers.length; i++) {
    const groupIndex = i % groupCount;
    groups[groupIndex].push({
      ...shuffledPlayers[i],
      groupId: (groupIndex + 1).toString()
    });
  }
  
  return groups;
};

export const ensurePhaseMatches = async (tournamentId: string, phaseId?: any) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return;
  const phase = phaseId ? tournament.Phases?.find((p: any) => p.Id === phaseId) : (tournament.Phases?.find((p: any) => p.Id === tournament.CurrentPhaseId) || tournament.Phases?.[0]);
  if (!phase) return;
  const hasMatches = tournament.AllMatches?.some((m: any) => m.phaseId === phase.Id);
  if (!hasMatches) {
    await initializeTournamentPhase(tournamentId, phase);
  }
};

export const findOrCreatePlayerMatch = async (tournamentId: string, userId: string) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return null;
  
  await checkAllWalkovers(tournamentId);
  
  const currentPhase = tournament.Phases?.find((p: any) => p.Id === tournament.CurrentPhaseId) || tournament.Phases?.[0];
  if (!currentPhase) return null;
  
  await ensurePhaseMatches(tournamentId, currentPhase.Id);
  
  const updatedTournament = await findTournamentById(tournamentId);
  if (!updatedTournament) return null;
  
  const playerActiveMatch = await getPlayerActiveMatch(tournamentId, userId);
  if (playerActiveMatch) return playerActiveMatch;
  
  if (currentPhase.Type === PhaseType.SingleElimination) {
    return await handleBracketMatch(updatedTournament, currentPhase, userId);
  } else if (currentPhase.Type === PhaseType.Groups) {
    return await handleGroupMatch(updatedTournament, currentPhase, userId);
  } else {
    return await handleBracketMatch(updatedTournament, currentPhase, userId);
  }
};

const handleBracketMatch = async (tournament: any, phase: any, userId: string) => {
  const allPhaseMatches = tournament.AllMatches?.filter((match: any) => 
    match.phaseId === phase.Id
  ) || [];
  
  const playerCurrentMatch = allPhaseMatches.find((match: any) => 
    match.status !== MatchStatus.MatchFinished &&
    match.teams?.some((team: any) => 
      team.users?.some((user: any) => user.userId === userId)
    )
  );
  
  if (playerCurrentMatch) return playerCurrentMatch;
  
  const waitingMatches = allPhaseMatches.filter((match: any) => 
    (match.status === MatchStatus.Created || match.status === MatchStatus.WaitingForOpponent) &&
    match.teams.length === 1
  );
  
  if (waitingMatches.length > 0) {
    const player = tournament.Players.find((p: any) => p.userId === userId);
    if (!player) return null;
    
    const matchToJoin = waitingMatches[0];
    const newTeam = {
      teamId: 2,
      users: [createPlayerMatchData(player)],
      score: 0,
      points: 0
    };
    
    matchToJoin.teams.push(newTeam);
    matchToJoin.status = MatchStatus.Created;
    
    await updateTournamentMatch(tournament.Id, matchToJoin.matchId, matchToJoin);
    return matchToJoin;
  }
  
  const completedMatches = allPhaseMatches.filter((match: any) =>
    match.status === MatchStatus.MatchFinished &&
    match.teams?.some((team: any) => 
      team.users?.some((user: any) => user.userId === userId && user.isWinner)
    )
  );
  
  if (completedMatches.length > 0) {
    const lastMatch = completedMatches[completedMatches.length - 1];
    const nextRoundId = parseInt(lastMatch.roundId) + 1;
    
    const nextRoundMatches = allPhaseMatches.filter((match: any) => 
      match.phaseId === phase.Id &&
      parseInt(match.roundId) === nextRoundId
    );
    
    const playerNextMatch = nextRoundMatches.find((match: any) =>
      match.teams?.some((team: any) => 
        team.users?.some((user: any) => user.userId === userId)
      )
    );
    
    if (playerNextMatch) return playerNextMatch;
    
    const nextRoundWaitingMatches = nextRoundMatches.filter((match: any) => 
      match.status === MatchStatus.Created &&
      match.teams.length === 1
    );
    
    if (nextRoundWaitingMatches.length > 0) {
      const player = tournament.Players.find((p: any) => p.userId === userId);
      if (!player) return null;
      
      const matchToJoin = nextRoundWaitingMatches[0];
      const newTeam = {
        teamId: 2,
        users: [createPlayerMatchData(player)],
        score: 0,
        points: 0
      };
      
      matchToJoin.teams.push(newTeam);
      await updateTournamentMatch(tournament.Id, matchToJoin.matchId, matchToJoin);
      return matchToJoin;
    }
  }
  
  const emptyMatches = allPhaseMatches.filter((match: any) => 
    match.status === MatchStatus.Created &&
    match.teams.length === 0
  );
  
  if (emptyMatches.length > 0) {
    const player = tournament.Players.find((p: any) => p.userId === userId);
    if (!player) return null;
    
    const matchToJoin = emptyMatches[0];
    const newTeam = {
      teamId: 1,
      users: [createPlayerMatchData(player)],
      score: 0,
      points: 0
    };
    
    matchToJoin.teams.push(newTeam);
    matchToJoin.status = MatchStatus.WaitingForOpponent;
    
    await updateTournamentMatch(tournament.Id, matchToJoin.matchId, matchToJoin);
    return matchToJoin;
  }
  
  return null;
};

const handleGroupMatch = async (tournament: any, phase: any, userId: string) => {
  const allPhaseMatches = tournament.AllMatches?.filter((match: any) => 
    match.phaseId === phase.Id
  ) || [];
  
  const playerCurrentMatch = allPhaseMatches.find((match: any) => 
    match.status !== MatchStatus.MatchFinished &&
    match.teams?.some((team: any) => 
      team.users?.some((user: any) => user.userId === userId)
    )
  );
  
  if (playerCurrentMatch) return playerCurrentMatch;
  
  const playerGroupMatch = allPhaseMatches.find((match: any) =>
    match.teams?.some((team: any) => 
      team.users?.some((user: any) => user.userId === userId)
    )
  );
  
  const userGroupId = playerGroupMatch?.groupId || "1";
  
  const availableMatches = allPhaseMatches.filter((match: any) => 
    match.groupId === userGroupId &&
    match.status === MatchStatus.Created &&
    !match.teams?.some((team: any) => 
      team.users?.some((user: any) => user.userId === userId)
    )
  );
  
  if (availableMatches.length > 0) {
    return availableMatches[0];
  }
  
  return null;
};

export const handleWalkover = async (tournamentId: string, matchId: string) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return;
  
  const match = tournament.AllMatches.find((m: any) => m.matchId === matchId);
  if (!match) return;
  
  const now = new Date();
  const deadline = new Date(match.deadline);
  
  if (now > deadline) {
    const checkedInTeams = match.teams.filter((team: any) => 
      team.users.some((user: any) => user.checkedIn)
    );
    
    if (checkedInTeams.length === 1) {
      const checkedInTeam = checkedInTeams[0];
      const notCheckedInTeam = match.teams.find((team: any) => 
        !team.users.some((user: any) => user.checkedIn)
      );
      
      checkedInTeam.users.forEach((user: any) => {
        user.isWinner = true;
        user.userPoints = 3;
      });
      
      if (notCheckedInTeam) {
        notCheckedInTeam.users.forEach((user: any) => {
          user.isWinner = false;
          user.userScore = 0;
          user.userPoints = 0;
        });
      }
      
      match.status = MatchStatus.MatchFinished;
      match.currentGameCount = match.maxGameCount || 1;
      match.winnerUserId = checkedInTeam.users[0].userId;
      
      await updateTournamentMatch(tournamentId, matchId, match);
      await handleMatchCompletion(tournamentId, matchId);
    }
  }
};

export const checkAllWalkovers = async (tournamentId: string) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return;
  
  const now = new Date();
  
  for (const match of tournament.AllMatches) {
    if (
      match.status === MatchStatus.Created ||
      match.status === MatchStatus.WaitingForOpponent ||
      match.status === MatchStatus.GameReady
    ) {
      const deadline = new Date(match.deadline);
      deadline.setHours(deadline.getHours() - 3);
      if (now > deadline) {
        await handleWalkover(tournamentId, match.matchId);
      }
    }
  }
};

export const updateMatchStatus = async (tournamentId: string, matchId: string, newStatus: number) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return;
  
  const match = tournament.AllMatches.find((m: any) => m.matchId === matchId);
  if (!match) return;
  
  match.status = newStatus;
  
  if (newStatus === MatchStatus.GameReady) {
    match.gameStartTime = new Date();
  } else if (newStatus === MatchStatus.MatchFinished) {
    match.gameEndTime = new Date();
  }
  
  await updateTournamentMatch(tournamentId, matchId, match);
};

export const handleMatchCompletion = async (tournamentId: string, matchId: string) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return;
  
  const match = tournament.AllMatches.find((m: any) => m.matchId === matchId);
  if (!match) return;
  
  const phase = tournament.Phases.find((p: any) => p.Id === match.phaseId);
  if (!phase) return;
  
  if (phase.Type === PhaseType.SingleElimination) {
    await autoAdvanceWinners(tournament, phase);
  }
  
  const allPhaseMatches = tournament.AllMatches.filter((m: any) => 
    m.phaseId === phase.Id
  );
  
  const completedMatches = allPhaseMatches.filter((m: any) => m.status === MatchStatus.MatchFinished);
  
  if (completedMatches.length === allPhaseMatches.length) {
    if (phase.Type === PhaseType.Groups) {
      const groupWinners = calculateGroupWinners(tournament, phase);
      
      const nextPhase = tournament.Phases.find((p: any) => p.Id === phase.Id + 1);
      if (nextPhase && groupWinners.length > 0) {
        const teamSize = getTeamSize(tournament, nextPhase);
        const nextPhaseMatches = generateRandomBracketMatches(groupWinners, nextPhase, tournament.Id, teamSize);
        
        for (const nextMatch of nextPhaseMatches) {
          await addTournamentMatch(tournament.Id, nextMatch);
        }
      }
    }
  }
};

const calculateGroupWinners = (tournament: any, phase: any) => {
  const winners: any[] = [];
  const groupCount = phase.GroupCount || 1;
  
  for (let groupId = 1; groupId <= groupCount; groupId++) {
    const groupMatches = tournament.AllMatches.filter((match: any) => 
      match.phaseId === phase.Id && match.groupId === groupId.toString()
    );
    
    const playerStats: { [key: string]: any } = {};
    
    groupMatches.forEach((match: any) => {
      match.teams.forEach((team: any) => {
        team.users.forEach((user: any) => {
          if (!playerStats[user.userId]) {
            playerStats[user.userId] = {
              userId: user.userId,
              platformId: user.platformId,
              platformType: user.platformType,
              nickName: user.nick,
              wins: 0,
              points: 0,
              gamesWon: 0
            };
          }
          
          if (user.isWinner) {
            playerStats[user.userId].wins++;
          }
          
          playerStats[user.userId].points += user.userPoints || 0;
          playerStats[user.userId].gamesWon += user.userScore || 0;
        });
      });
    });
    
    const groupPlayers = Object.values(playerStats).sort((a: any, b: any) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.points !== a.points) return b.points - a.points;
      return b.gamesWon - a.gamesWon;
    });
    
    if (groupPlayers.length > 0) {
      winners.push({
        ...groupPlayers[0],
        seed: winners.length + 1
      });
    }
  }
  
  return winners;
};

export const checkAllPlayersReady = async (tournamentId: string, matchId: string) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return { allReady: false, players: [] };
  
  const match = tournament.AllMatches.find((m: any) => m.matchId === matchId);
  if (!match) return { allReady: false, players: [] };

  const players = match.teams.flatMap((team: any) => team.users);

  const allReady = players.every((user: any) => user.isReady === true);

  return {
    allReady,
    players,
  };
};

const generateNextRoundMatches = (winners: any[], phase: any, tournamentId: string, roundId: number, teamSize: number) => {
  const matches: any[] = [];
  
  if (winners.length < 1) {
    return matches;
  }
  
  const shuffledWinners = shuffleArray(winners);
  const balancedTeams = composeTeams(shuffledWinners, teamSize);
  const teamCount = balancedTeams.length;
  
  const now = new Date();
  
  for (let i = 0; i < teamCount; i += 2) {
    const t1 = balancedTeams[i];
    const t2 = balancedTeams[i + 1];
    
    if (t1 && !t2) {
      const team1 = { 
        teamId: 1, 
        users: t1.users, 
        score: 0, 
        points: 0 
      };
      
      const deadline = new Date();
      deadline.setMinutes(deadline.getMinutes() + 20);
      
      const match = {
        matchId: GenIntCaracters(6),
        phaseId: phase.Id,
        groupId: "1",
        roundId: roundId.toString(),
        teams: [team1],
        status: MatchStatus.Created,
        winScore: phase.WinScore || 1,
        maxGameCount: phase.MaxGameCount || 2,
        currentGameCount: 1,
        minCheckinsPerTeam: phase.MinCheckinsPerTeam || Math.max(1, teamSize),
        secret: generateSecret(),
        deadline: deadline,
        created: now,
        bracketPosition: matches.length + 1,
        winnerUserId: null
      };
      matches.push(match);
    } else if (t1 && t2) {
      const team1 = { 
        teamId: 1, 
        users: t1.users, 
        score: 0, 
        points: 0 
      };
      
      const team2 = { 
        teamId: 2, 
        users: t2.users, 
        score: 0, 
        points: 0 
      };
      
      const deadline = new Date();
      deadline.setMinutes(deadline.getMinutes() + 5);
      
      const match = {
        matchId: GenIntCaracters(6),
        phaseId: phase.Id,
        groupId: "1",
        roundId: roundId.toString(),
        teams: [team1, team2],
        status: MatchStatus.Created,
        winScore: phase.WinScore || 1,
        maxGameCount: phase.MaxGameCount || 2,
        currentGameCount: 1,
        minCheckinsPerTeam: phase.MinCheckinsPerTeam || Math.max(1, teamSize),
        secret: generateSecret(),
        deadline: deadline,
        created: now,
        bracketPosition: matches.length + 1,
        winnerUserId: null
      };
      matches.push(match);
    }
  }
  
  return matches;
};

export const autoAdvanceWinners = async (tournament: any, phase: any) => {
  if (!tournament.AllMatches) return;
  
  const phaseMatches = tournament.AllMatches.filter((match: any) => 
    match.phaseId === phase.Id && match.status === MatchStatus.MatchFinished
  );
  
  const winnersByRound: { [roundId: number]: any[] } = {};
  
  phaseMatches.forEach((match: any) => {
    const roundId = parseInt(match.roundId);
    if (!winnersByRound[roundId]) {
      winnersByRound[roundId] = [];
    }
    
    match.teams.forEach((team: any) => {
      team.users.forEach((user: any) => {
        if (user.isWinner) {
          const existingPlayer = winnersByRound[roundId].find(w => w.userId === user.userId);
          if (!existingPlayer) {
            const player = tournament.Players.find((p: any) => p.userId === user.userId);
            if (player) {
              winnersByRound[roundId].push({
                userId: player.userId,
                platformId: player.platformId,
                platformType: player.platformType,
                nickName: player.nickName,
                seed: player.seed || winnersByRound[roundId].length + 1
              });
            }
          }
        }
      });
    });
  });
  
  const rounds = Object.keys(winnersByRound).map(Number).sort((a, b) => a - b);
  
  for (const roundId of rounds) {
    const winners = winnersByRound[roundId];
    const nextRoundId = roundId + 1;

    if (roundId > tournament.RoundCount)
    {
       continue;
    }
    
    const freshTournament = await findTournamentById(tournament.Id);
    const existingNextRoundMatches = freshTournament.AllMatches.filter((match: any) =>
    match.phaseId === phase.Id &&
    parseInt(match.roundId) === nextRoundId
   );
    
    const playersWithoutNextMatch: any[] = [];
    
    winners.forEach((winner: any) => {
      const playerHasMatch = existingNextRoundMatches.some((match: any) =>
        match.teams?.some((team: any) =>
          team.users?.some((user: any) => user.userId === winner.userId)
        )
      );
      
      if (!playerHasMatch) {
        playersWithoutNextMatch.push(winner);
      }
    });
    
    if (playersWithoutNextMatch.length > 0) {
      const teamSize = getTeamSize(tournament, phase);
      
      const waitingMatches = existingNextRoundMatches.filter(m =>
         m.status !== MatchStatus.MatchFinished &&
        m.teams.length === 1
        );

      
      let currentWaitingMatchIndex = 0;
      
      for (const player of playersWithoutNextMatch) {
        if (currentWaitingMatchIndex < waitingMatches.length) {
          const waitingMatch = waitingMatches[currentWaitingMatchIndex];
          const playerData = createPlayerMatchData(player);
          
          const newTeam = {
            teamId: waitingMatch.teams.length + 1,
            users: [playerData],
            score: 0,
            points: 0
          };
          
          waitingMatch.teams.push(newTeam);
          await updateTournamentMatch(tournament.Id, waitingMatch.matchId, waitingMatch);
          currentWaitingMatchIndex++;
        } else {
          break;
        }
      }
      
      const remainingPlayers = playersWithoutNextMatch.slice(currentWaitingMatchIndex);
      
      if (remainingPlayers.length === 1) {
          const lonelyPlayer = remainingPlayers[0];

          const waitingMatch = existingNextRoundMatches.find(m =>
           m.status !== MatchStatus.MatchFinished &&
          m.teams.length === 1
    );

  if (waitingMatch) {
    waitingMatch.teams.push({
      teamId: 2,
      users: [createPlayerMatchData(lonelyPlayer)],
      score: 0,
      points: 0
    });

    await updateTournamentMatch(tournament.Id, waitingMatch.matchId, waitingMatch);
  }

  continue;
}

      if (remainingPlayers.length >= 2) {
       const nextRoundMatches = generateNextRoundMatches(
        remainingPlayers,
        phase,
        tournament.Id,
        nextRoundId,
        teamSize
       );

     for (const match of nextRoundMatches) {
        await addTournamentMatch(tournament.Id, match);
       }
     }  
   }
 }
};

export const processGameResult = async (tournamentId: string, matchId: string, gameResults: any) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return;
  
  const match = tournament.AllMatches.find((m: any) => m.matchId === matchId);
  if (!match) return;
  
  match.currentGameCount = (match.currentGameCount || 0) + 1;
  
  gameResults.users.forEach((result: any) => {
    const team = match.teams.find((t: any) => t.teamId === result.teamId);
    if (team) {
      const user = team.users.find((u: any) => u.userId === result.userId);
      if (user) {
        user.userScore = (user.userScore || 0) + (result.place === 1 ? 1 : 0);
        user.matchPoints = (user.matchPoints || 0) + (result.points || 0);
        user.userPoints = (user.userPoints || 0) + (result.points || 0);
      }
    }
  });
  
  const teamScores = match.teams.map((team: any) => ({
    teamId: team.teamId,
    score: team.users.reduce((sum: number, user: any) => sum + (user.userScore || 0), 0)
  }));
  
  const maxScore = Math.max(...teamScores.map((t: any) => t.score));
  const winningTeam = match.teams.find((team: any) => 
    team.users.reduce((sum: number, user: any) => sum + (user.userScore || 0), 0) === maxScore
  );
  
  if (winningTeam) {
    const winScore = match.winScore || 1;
    const teamWins = winningTeam.score || 0;
    winningTeam.score = teamWins + 1;
    
    if (teamWins + 1 >= winScore) {
      winningTeam.users.forEach((user: any) => {
        user.isWinner = true;
        user.userPoints = (user.userPoints || 0) + 3;
      });
      
      if (match.teams.length > 1) {
        match.teams.forEach((team: any) => {
          if (team.teamId !== winningTeam.teamId) {
            team.users.forEach((user: any) => {
              user.isWinner = false;
            });
          }
        });
      }
      
      match.status = MatchStatus.MatchFinished;
      match.winnerTeamId = winningTeam.teamId;
      match.winnerUserId = winningTeam.users[0]?.userId;
      
      await updateTournamentMatch(tournamentId, matchId, match);
      await handleMatchCompletion(tournamentId, matchId);
      
    } else if (match.currentGameCount >= (match.maxGameCount || 3)) {
      const sortedTeams = [...match.teams].sort((a, b) => 
        (b.score || 0) - (a.score || 0)
      );
      
      sortedTeams[0].users.forEach((user: any) => {
        user.isWinner = true;
        user.userPoints = (user.userPoints || 0) + 3;
      });
      
      sortedTeams.slice(1).forEach((team: any, index: number) => {
        team.users.forEach((user: any) => {
          user.isWinner = false;
          user.userPoints = (user.userPoints || 0) + (index === 0 ? 1 : 0);
        });
      });
      
      match.status = MatchStatus.MatchFinished;
      match.winnerTeamId = sortedTeams[0].teamId;
      match.winnerUserId = sortedTeams[0].users[0]?.userId;
      
      await updateTournamentMatch(tournamentId, matchId, match);
      await handleMatchCompletion(tournamentId, matchId);
      
    } else {
      match.status = MatchStatus.GameReady;
      await updateTournamentMatch(tournamentId, matchId, match);
    }
  }
  
  await updateTournamentMatch(tournamentId, matchId, match);
};

export const getPlayerActiveMatch = async (tournamentId: string, userId: string) => {
  const tournament = await findTournamentById(tournamentId);
  if (!tournament) return null;
  
  return tournament.AllMatches.find((match: any) => 
    match.teams?.some((team: any) => 
      team.users?.some((user: any) => user.userId === userId)
    ) && 
    (match.status === MatchStatus.Created || 
     match.status === MatchStatus.WaitingForOpponent || 
     match.status === MatchStatus.GameReady || 
     match.status === MatchStatus.GameInProgress)
  );
};

export const calculateTournamentScores = (tournament: any, userId?: string) => {
  const scores: any[] = [];
  
  if (!tournament.Players || !tournament.AllMatches) {
    return scores;
  }

  tournament.Players.forEach((player: any) => {
    const userMatches = tournament.AllMatches.filter((match: any) =>
      match.teams?.some((team: any) => 
        team.users?.some((user: any) => user.userId === player.userId)
      )
    );

    let totalPoints = 0;
    let matchWins = 0;
    let matchLoses = 0;
    let gameWins = 0;
    let gameLoses = 0;
    let stat1Summed = 0;
    let stat2Summed = 0;
    let playedRounds = 0;
    let isCheckedIn = false;

    userMatches.forEach((match: any) => {
      if (match.status === MatchStatus.MatchFinished) {
        match.teams?.forEach((team: any) => {
          const userInTeam = team.users?.find((user: any) => user.userId === player.userId);
          if (userInTeam) {
            totalPoints += userInTeam.userPoints || 0;
            gameWins += userInTeam.userScore || 0;
            
            const opponentTeam = match.teams.find((t: any) => t.teamId !== team.teamId);
            const opponentGameWins = opponentTeam?.users?.reduce((sum: number, u: any) => sum + (u.userScore || 0), 0) || 0;
            gameLoses += opponentGameWins;
            
            stat1Summed += userInTeam.matchPoints || 0;
            
            if (userInTeam.isWinner) {
              matchWins++;
            } else {
              matchLoses++;
            }
            
            playedRounds++;
            isCheckedIn = isCheckedIn || userInTeam.checkedIn;
          }
        });
      }
    });

    const position = calculatePlayerPosition(tournament, player.userId);
    
    const score = {
      partyid: player.partyId?.toString() || "0",
      phaseid: tournament.CurrentPhaseId?.toString() || "1",
      groupid: player.groupId?.toString() || "1",
      checkin: isCheckedIn ? "1" : "0",
      position: position.toString(),
      totalpoints: totalPoints.toString(),
      matchwins: matchWins.toString(),
      matchloses: matchLoses.toString(),
      gamewins: gameWins.toString(),
      gameloses: gameLoses.toString(),
      stat1sum: stat1Summed.toString(),
      stat2sum: stat2Summed.toString(),
      loseweight: matchLoses.toString(),
      totalrounds: playedRounds.toString(),
      seed: player.seed?.toString() || "1",
      users: [
        {
          "@user-id": player.userId.toString(),
          "@status": player.status?.toString() || "1",
          "@checked-in": isCheckedIn ? "1" : "0",
          "@is-party-leader": player.isPartyLeader ? "1" : "0",
          "@nick": player.nickName || "Player"
        }
      ]
    };

    scores.push(score);
  });

  return scores.sort((a, b) => parseInt(b.totalpoints) - parseInt(a.totalpoints));
};

const calculatePlayerPosition = (tournament: any, userId: string): number => {
  if (!tournament.Players || tournament.Players.length === 0) return 1;
  
  const playersWithStats = tournament.Players.map(player => {
    let totalPoints = 0;
    let matchWins = 0;
    let gameWins = 0;
    let playedRounds = 0;
    
    const userMatches = tournament.AllMatches.filter((match: any) =>
      match.teams?.some((team: any) => 
        team.users?.some((user: any) => user.userId === player.userId)
      )
    );
    
    userMatches.forEach((match: any) => {
      if (match.status === MatchStatus.MatchFinished) {
        match.teams?.forEach((team: any) => {
          const userInTeam = team.users?.find((user: any) => user.userId === player.userId);
          if (userInTeam) {
            totalPoints += userInTeam.userPoints || 0;
            gameWins += userInTeam.userScore || 0;
            
            if (userInTeam.isWinner) {
              matchWins++;
            }
            
            playedRounds++;
          }
        });
      }
    });
    
    return { 
      userId: player.userId, 
      totalPoints,
      matchWins,
      gameWins,
      playedRounds
    };
  });
  
  playersWithStats.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;
    if (b.gameWins !== a.gameWins) return b.gameWins - a.gameWins;
    return b.playedRounds - a.playedRounds;
  });
  
  const position = playersWithStats.findIndex(p => p.userId === userId) + 1;
  return position > 0 ? position : 1;
}; 
