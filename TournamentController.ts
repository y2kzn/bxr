      import { Request, Response } from 'express';
      import {  
        findTournamentById, 
        findTournaments, 
        addTournamentParticipant, 
        addTournamentMatch,
        getTournamentMatches,
        getTournamentMatchesByIds,
        getTournamentScores,
        addTournamentInvite,
        updateTournamentInvite,
        addTournamentParty,
        findTournamentPartyByCode,
        addUserToTournamentParty,
        removeUserFromTournamentParty,
        findTournamentByInviteId,
        checkInToMatch,
        updateMatchUserStats,
        findTournamentByMatchId,
        updateTournamentMatch,
        createTournamentTeam,
        addUserToTournamentTeam,
        removeUserFromTournamentTeam, 
        updateTournamentPlayerStats,
        getTournamentPlayer,
        updateTournamentPhase,
        getDatabase,
        updateTournamentData,
        setUserReady,
        updateTournamentStatus
      } from '../Config/Database';
      import { createResponse } from '../Utils/Response';
      import { 
        calculateTournamentScores, 
        findOrCreatePlayerMatch, 
        updateMatchStatus, 
        checkAllPlayersReady, 
        processGameResult,
        checkAllWalkovers,
        handleWalkover,
        handleMatchCompletion,
        initializeTournamentPhase
      } from '../Handlers/TournamentHandler';
      import { GenCaracters, GenIntCaracters } from '../Utils/Cryptography';

      const MatchStatus = {
        Unknown: -1,
        Created: 0,
        WaitingForOpponent: 1,
        GameReady: 2,
        GameInProgress: 3,
        GameFinished: 4,
        MatchFinished: 5,
        Closed: 8
      };

 export const tournamentGetList = async (req: Request, res: Response): Promise<void> => {
   const { sinceDate, untilDate, maxResults, page } = req.body;
   const user = (req as any).user;

  const tours = await findTournaments(maxResults, page);

  if (!tours) {
    res.status(404).json(createResponse(1, "nenhum torneio encontrado", {}));
    return;
  }

  const now = new Date();

  const filteredTours = tours.filter((tournament: any) => {
    if (!tournament.Convidados.includes(user.userId) && tournament.onlyInviteds) {
      return false;
    }
    return true;
  }).map((tournament: any) => {
    const invitationOpenTime = tournament.InvitationOpenTime 
      ? new Date(tournament.InvitationOpenTime)
      : null;

    const invitationCloseTime = tournament.InvitationCloseTime 
      ? new Date(tournament.InvitationCloseTime)
      : null;

    const registrationOpenTime = tournament.RegistrationOpenTime 
      ? new Date(tournament.RegistrationOpenTime)
      : null;

    let automaticStatus = -1;

    const allPlayersPlayed = tournament.Players && tournament.Players.length > 0 && tournament.Players.every((player: any) => player.playedRounds >= tournament.RoundCount);
        

    if (allPlayersPlayed) {
      automaticStatus = 3;
    } else if (invitationOpenTime && now < invitationOpenTime) {
      automaticStatus = 0;
    } else if (invitationOpenTime && registrationOpenTime && now >= invitationOpenTime && now < registrationOpenTime) {
      automaticStatus = 1;
    } else if (registrationOpenTime && invitationCloseTime && now >= registrationOpenTime && now < invitationCloseTime) {
      automaticStatus = 2;
    } else if (invitationCloseTime && now >= invitationCloseTime) {
      automaticStatus = 3;
    }

    if (
      registrationOpenTime &&
      invitationCloseTime &&
      now >= registrationOpenTime &&
      now < invitationCloseTime &&
      tournament.Players &&
      tournament.Players.length > 0 &&
      !allPlayersPlayed
    ) {
      automaticStatus = 5;
    }

    updateTournamentStatus(tournament.id, automaticStatus);

    const tournamentScores = calculateTournamentScores(tournament);

    let registrationOpensValue = "";
    if (invitationOpenTime && invitationCloseTime) {
      const diffHours = (invitationCloseTime.getTime() - invitationOpenTime.getTime()) / (1000 * 60 * 60);
      registrationOpensValue = diffHours.toString();
    }

    const userInvite = tournament.Invites?.find((invite: any) => 
      invite.inviteUserId === user.userId
    );

    const partyCode = userInvite?.partyCode ? userInvite.partyCode : GenCaracters(6).toUpperCase();
    const partyId = userInvite?.inviteId ? userInvite.inviteId.toString() : GenIntCaracters(3).toString();

    const invitationOpenTimeResponse = tournament.InvitationOpenTime 
      ? new Date(new Date(tournament.InvitationOpenTime).getTime() + 3 * 60 * 60 * 1000)
      : null;
    
    const invitationCloseTimeResponse = tournament.InvitationCloseTime 
      ? new Date(new Date(tournament.InvitationCloseTime).getTime() + 3 * 60 * 60 * 1000)
      : null;

    const registrationOpenTimeResponse = tournament.RegistrationOpenTime 
      ? new Date(new Date(tournament.RegistrationOpenTime).getTime() + 3 * 60 * 60 * 1000)
      : null;

    const tournamentData = {
      cashStatus: 0,
      cashTournament: false,
      checkIn: userInvite?.isCheckedIn || false,
      currentinvites: tournament.CurrentInvites ? parseInt(tournament.CurrentInvites) : 1,
      currentphaseid: tournament.CurrentPhaseId ? parseInt(tournament.CurrentPhaseId) : 1,
      currentphasestarted: tournament.CurrentPhaseStarted ? new Date(new Date(tournament.CurrentPhaseStarted).getTime() + 3 * 60 * 60 * 1000).toISOString() : new Date().toISOString(),
      data: {
        "tournament-data": {
          "description-data": [
            {
              language: [
                {
                  "@code": "en",
                  general: [
                    {
                      "@main-icon": tournament.IconUrl || "",
                      "@theme-color": tournament.ThemeColor || "#9d9d9dff"
                    }
                  ],
                  name: [
                    {
                      "#text": [
                        {
                          value: tournament.TournamentName || ""
                        }
                      ]
                    }
                  ],
                  policy: [
                    {
                      "@url": ""
                    }
                  ]
                }
              ]
            }
          ],
          "invitation-setting": [
            {
              requirements: [
                {
                  "custom-requirement": Object.keys(tournament.Requirements?.CustomRequirements || {}).length > 0 ? 
                    Object.entries(tournament.Requirements.CustomRequirements).map(([name, value]: [string, any]) => ({
                      "@name": name,
                      "@value": value || ""
                    })) : 
                    [{
                      "@name": "server_region",
                      "@value": "sa"
                    }]
                }
              ]
            }
          ],
          "prize-setting": [
            {
              reward: tournament.Prizes?.map((prize: any) => ({
                "@position": prize.ToPlace?.toString() || "1",
                "item": prize.Items?.map((item: any) => ({
                  "@amount": item.Amount?.toString() || "1",
                  "@external-id": item.ExternalId?.toString() || "10",
                  "@id": item.Id?.toString() || "0",
                  "@type": item.Type?.toString() || "10"
                })) || []
              })) || []
            }
          ],
          "property-setting": [
            {
              properties: [
                {
                  property: Object.entries(tournament.CustomProperties || {}).map(([key, value]) => ({
                    "@name": key,
                    "@value": value
                  }))
                }
              ]
            }
          ],
          "rules-setting": [
            {
              phase: tournament.Phases?.map((phase: any) => ({
                "@allow-skip": phase.IsSkipAllowed ? "1" : "0",
                "@allow-tiebreakers": "1",
                "@game-point-distribution": phase.GamePointDistribution || "1",
                "@id": phase.Id?.toString() || "1",
                "@match-point-distribution": phase.MatchPointDistribution || "1",
                "@max-loses": phase.MaxLoses?.toString() || "1",
                "@max-players": phase.MaxPlayers?.toString() || "128",
                "@max-teams-per-match": phase.MaxTeamsPerMatch?.toString() || "2",
                "@min-checkins-per-team": phase.MinCheckinsPerTeam?.toString() || "1",
                "@min-teams-per-match": phase.MinTeamsPerMatch?.toString() || "2",
                "@type": phase.Type?.toString() || "2",
                round: phase.Rounds?.map((round: any) => ({
                  "@id": round.Id?.toString() || "1",
                  "@max-game-count": round.MaxGameCount?.toString() || "1",
                  "@max-length": round.MaxLength?.toString() || "12",
                  "@min-length": round.MinGameLength?.toString() || "8",
                  "@win-score": round.WinScore?.toString() || "1"
                })) || []
              })) || []
            }
          ],
          "sponsor-data": [
            {
              "@image": tournament.SponsorImageUrl || "",
              "@name": tournament.SponsorName || ""
            }
          ],
          "stream-data": [
            {
              "@stream-link": tournament.StreamUrl || ""
            }
          ]
        }
      },
      icon: tournament.IconUrl || "",
      id: tournament.Id.toString(),
      image: tournament.ImageUrl || null,
      invitationcloses: invitationCloseTimeResponse ? invitationCloseTimeResponse.toISOString() : "",
      invitationopens: invitationOpenTimeResponse ? invitationOpenTimeResponse.toISOString() : "",
      inviteAceptedAt: userInvite?.acceptedAt ? new Date(new Date(userInvite.acceptedAt).getTime() + 3 * 60 * 60 * 1000).toISOString() : null,
      inviteDeclinedAt: userInvite?.declinedAt ? new Date(new Date(userInvite.declinedAt).getTime() + 3 * 60 * 60 * 1000).toISOString() : null,
      inviteId: userInvite?.inviteId?.toString() || null,
      inviteIsPartyLeader: true,
      invitePartyCode: null,
      invitePartyId: partyId,
      inviteStatus: userInvite?.status || 1,
      isAdministrator: user.isAdministrator,
      maxinvites: tournament.MaxInvites ? parseInt(tournament.MaxInvites) : 128,
      name: tournament.TournamentName || "",
      nextphase: tournament.NextPhase ? new Date(new Date(tournament.NextPhase).getTime() + 3 * 60 * 60 * 1000).toISOString() : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      openregistration: parseFloat(registrationOpensValue),
      partysize: tournament.PartySize ? parseInt(tournament.PartySize) : 1,
      phasecount: tournament.PhaseCount ? parseInt(tournament.PhaseCount) : 1,
      privateCode: null,
      prizeDelivered: userInvite?.prizeDelivered || null,
      roundcount: tournament.RoundCount ? parseInt(tournament.RoundCount) : 7,
      season: 1,
      seasonpart: 1,
      sponsorimage: tournament.SponsorImageUrl || "",
      sponsorname: tournament.SponsorName || "",
      status: parseInt(tournament.Status.toString()),
      "theme-color": tournament.ThemeColor || "#9d9d9dff",
      tournamenttime: invitationCloseTimeResponse ? new Date(invitationCloseTimeResponse).toISOString() : "",
      type: tournament.Type ? parseInt(tournament.Type) : 1,
      userPlace: userInvite?.finalPlace || 0
    };

    return tournamentData;
  });

  res.status(200).json(
    createResponse(1, "torneios encontrados", {
      tournaments: filteredTours,
      pagination: {
        totalResultCount: filteredTours.length,
        maxResults: parseInt(maxResults),
        currentPage: parseInt(page)
      }
    })
  );
};

    export const tournamentGetData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tournamentId, readyForNextMatch, getAllData } = req.body;
    const tournament = await findTournamentById(tournamentId);

    if (!tournament) {
      res.status(200).json(createResponse(-1, "Tournament not found", {}));
      return;
    }

    if (tournament.Status === 5 && !tournament.bracketGerada) {
      await updateTournamentData(tournamentId, { bracketGerada: true });
      await initializeTournamentPhase(tournamentId, tournament.Phases[0]);
    }

    const user = (req as any).user;

    const now = new Date();

    const invitationOpenTime = tournament.InvitationOpenTime 
      ? new Date(tournament.InvitationOpenTime)
      : null;

    const invitationCloseTime = tournament.InvitationCloseTime 
      ? new Date(tournament.InvitationCloseTime)
      : null;

    const registrationOpenTime = tournament.RegistrationOpenTime 
      ? new Date(tournament.RegistrationOpenTime)
      : null;

    let automaticStatus = -1;

    const allPlayersPlayed = tournament.Players && tournament.Players.length > 0 && tournament.Players.every((player: any) => player.playedRounds >= tournament.RoundCount);
        

    if (allPlayersPlayed) {
      automaticStatus = 3;
    } else if (invitationOpenTime && now < invitationOpenTime) {
      automaticStatus = 0;
    } else if (invitationOpenTime && registrationOpenTime && now >= invitationOpenTime && now < registrationOpenTime) {
      automaticStatus = 1;
    } else if (registrationOpenTime && invitationCloseTime && now >= registrationOpenTime && now < invitationCloseTime) {
      automaticStatus = 2;
    } else if (invitationCloseTime && now >= invitationCloseTime) {
      automaticStatus = 3;
    }

    if (
      registrationOpenTime &&
      invitationCloseTime &&
      now >= registrationOpenTime &&
      now < invitationCloseTime &&
      tournament.Players &&
      tournament.Players.length > 0 &&
      !allPlayersPlayed
    ) {
      automaticStatus = 5;
    }

    updateTournamentStatus(tournament.id, automaticStatus);

    const tournamentScores = calculateTournamentScores(tournament, user.userId);

    let registrationOpensValue = "";
    if (invitationOpenTime && invitationCloseTime) {
      const diffHours = (invitationCloseTime.getTime() - invitationOpenTime.getTime()) / (1000 * 60 * 60);
      registrationOpensValue = diffHours.toString();
    }

    const userInvite = tournament.Invites?.find((invite: any) => 
      invite.inviteUserId === user.userId
    );
  
    const invite = !userInvite
      ? null
      : {
          inviteId: userInvite.inviteId?.toString() || null,
          inviteStatus: userInvite.status?.toString() || "0",
          inviteAceptedAt: userInvite.acceptedAt
            ? new Date(userInvite.acceptedAt).toISOString()
            : "",
          inviteDeclinedAt: userInvite.declinedAt
            ? new Date(userInvite.declinedAt).toISOString()
            : "",
          checkIn: userInvite.isCheckedIn || false,
          prizeDelivered: userInvite.prizeDelivered || false,
          userPlace: userInvite.finalPlace?.toString() || "0",
          partyCode: userInvite.partyCode?.toString() || "0"
        };

    const partyCode = invite?.partyCode ? invite.partyCode : GenCaracters(6).toUpperCase();
    const partyId = GenIntCaracters(3);

    const readyFlag = readyForNextMatch === "1";
    
    let activeMatch = null;
    if (readyFlag) {
      activeMatch = await findOrCreatePlayerMatch(tournamentId, user.userId);
    } else {
      const tournamentData = await findTournamentById(tournamentId);
      if (tournamentData) {
        activeMatch = tournamentData.AllMatches?.find((match: any) => 
          match.teams?.some((team: any) => 
            team.users?.some((u: any) => u.userId === user.userId)
          ) && 
          (match.status === MatchStatus.Created || 
          match.status === MatchStatus.WaitingForOpponent || 
          match.status === MatchStatus.GameReady || 
          match.status === MatchStatus.GameInProgress)
        ) || null;
      }
    }

    if (readyFlag && activeMatch) {
      const { players, allReady } = await checkAllPlayersReady(tournamentId, activeMatch.matchId);

      let newStatus = activeMatch.status;

      if (players.length === 1) {
        newStatus = MatchStatus.WaitingForOpponent;
      } else if (players.length > 1) {
        newStatus = MatchStatus.GameReady;
      }

      await updateTournamentMatch(tournamentId, activeMatch.matchId, { 
        status: newStatus 
      });
      activeMatch.status = newStatus;
    } else if (!readyFlag) {
      await setUserReady(tournamentId, user.userId, false);
    }

    const buildMatchData = (match: any) => {
      const teams = match.teams || [];

      let users = teams.flatMap((team: any) => {
        const teamUsers = team.users || [];
        return teamUsers.map((uu: any) => ({
          "@checked-in": uu.checkedIn ? "1" : "0",
          "@match-points": uu.matchPoints?.toString() || "0",
          "@match-winner": uu.isWinner ? "1" : "0",
          "@nick": uu.nick || "",
          "@team-id": team.teamId?.toString() || "0",
          "@team-points": team.points?.toString() || "0",
          "@team-score": team.score?.toString() || "0",
          "@user-id": uu.userId?.toString() || "0",
          "@user-points": uu.userPoints?.toString() || "0",
          "@user-score": uu.userScore?.toString() || "0"
        }));
      });

      const deadlineDate = match.deadline ? new Date(match.deadline) : new Date();

      return {
        deadline: deadlineDate.toISOString(),
        groupid: match.groupId ? parseInt(match.groupId) : 1,
        id: match.matchId?.toString() || "1",
        matchid: match.matchId ? parseInt(match.matchId) : 1,
        phaseid: match.phaseId ? parseInt(match.phaseId) : 1,
        playedgamecount: match.currentGameCount ? parseInt(match.currentGameCount) : 0,
        roundid: match.roundId ? parseInt(match.roundId) : 1,
        secret: match.secret || GenCaracters(64).toLowerCase(),
        status: match.status ? parseInt(match.status) : 1,
        tournamentid: tournament.Id.toString(),
        users,
      };
    };

    const allUserMatches = tournament.AllMatches?.filter((match: any) => 
      match.teams?.some((team: any) => 
        team.users?.some((u: any) => u.userId === user.userId)
      )
    ) || [];

    const userMatches = allUserMatches.map(buildMatchData);
    const userMatch = activeMatch ? buildMatchData(activeMatch) : (userMatches[0] || buildMatchData({}));

    const userPosition = tournament.Phases?.flatMap((phase: any) => {
    const userPhaseData = tournamentScores.find((score: any) =>
    score.phaseid === phase.Id?.toString() &&
    score.users?.some((u: any) => u["@user-id"] === user.userId.toString())
  );

  return phase.Rounds?.map((round: any) => {
    if (userPhaseData) {
      return {
        groupid: parseInt(userPhaseData.groupid) || 0,
        matchloses: parseInt(userPhaseData.matchloses) || 0,
        phaseid: parseInt(userPhaseData.phaseid) || 0,
        roundid: parseInt(round.Id) || 0,  
        rankposition: parseInt(userPhaseData.position) || 0,
        sameposition: 0,
        totalpoints: parseInt(userPhaseData.totalpoints) || 0,
        totalrounds: parseInt(userPhaseData.totalrounds) || 0
      };
    }

    return {
      groupid: 1,
      matchloses: 0,
      phaseid: parseInt(phase.Id) || 1,
      roundid: parseInt(round.Id) || 1,
      rankposition: 1,
      sameposition: 1,
      totalpoints: 0,
      totalrounds: 0
    };
  });
}) || [];


    const customProperties = tournament.CustomProperties || {};
    const propertyArray = Object.entries(customProperties).map(([key, value]: [string, any]) => ({
      "@name": key,
      "@value": value
    }));

    const invitationOpenTimeResponse = tournament.InvitationOpenTime 
      ? new Date(new Date(tournament.InvitationOpenTime).getTime() + 3 * 60 * 60 * 1000)
      : null;
    
    const invitationCloseTimeResponse = tournament.InvitationCloseTime 
      ? new Date(new Date(tournament.InvitationCloseTime).getTime() + 3 * 60 * 60 * 1000)
      : null;

    const registrationOpenTimeResponse = tournament.RegistrationOpenTime 
      ? new Date(new Date(tournament.RegistrationOpenTime).getTime() + 3 * 60 * 60 * 1000)
      : null;

    const tournamentData = {
      cashStatus: 0,
      cashTournament: false,
      checkIn: userInvite?.isCheckedIn || false,
      currentinvites: tournament.CurrentInvites ? parseInt(tournament.CurrentInvites) : 1,
      currentphaseid: tournament.CurrentPhaseId ? parseInt(tournament.CurrentPhaseId) : 1,
      currentphasestarted: tournament.CurrentPhaseStarted ? new Date(new Date(tournament.CurrentPhaseStarted).getTime() + 3 * 60 * 60 * 1000).toISOString() : new Date().toISOString(),
      data: {
        "tournament-data": {
          "description-data": [
            {
              language: [
                {
                  "@code": "en",
                  general: [
                    {
                      "@main-icon": tournament.IconUrl || "",
                      "@theme-color": tournament.ThemeColor || "#9d9d9dff"
                    }
                  ],
                  name: [
                    {
                      "#text": [
                        {
                          value: tournament.TournamentName || ""
                        }
                      ]
                    }
                  ],
                  policy: [
                    {
                      "@url": ""
                    }
                  ]
                }
              ]
            }
          ],
          "invitation-setting": [
            {
              requirements: [
                {
                  "custom-requirement": Object.keys(tournament.Requirements?.CustomRequirements || {}).length > 0 ? 
                    Object.entries(tournament.Requirements.CustomRequirements).map(([name, value]: [string, any]) => ({
                      "@name": name,
                      "@value": value || ""
                    })) : 
                    [{
                      "@name": "server_region",
                      "@value": "sa"
                    }]
                }
              ]
            }
          ],
          "prize-setting": [
            {
              reward: tournament.Prizes?.map((prize: any) => ({
                "@position": prize.ToPlace?.toString() || "1",
                "item": prize.Items?.map((item: any) => ({
                  "@amount": item.Amount?.toString() || "1",
                  "@external-id": item.ExternalId?.toString() || "10",
                  "@id": item.Id?.toString() || "0",
                  "@type": item.Type?.toString() || "10"
                })) || []
              })) || []
            }
          ],
          "property-setting": [
            {
              properties: [
                {
                  property: propertyArray
                    }
                  ]
                }
              ],
              "rules-setting": [
                {
                  phase: tournament.Phases?.map((phase: any) => ({
                    "@allow-skip": phase.IsSkipAllowed ? "1" : "0",
                    "@allow-tiebreakers": "1",
                    "@game-point-distribution": phase.GamePointDistribution || "1",
                    "@id": phase.Id?.toString() || "1",
                    "@match-point-distribution": phase.MatchPointDistribution || "1",
                    "@max-loses": phase.MaxLoses?.toString() || "1",
                    "@max-players": phase.MaxPlayers?.toString(),
                    "@max-teams-per-match": phase.MaxTeamsPerMatch?.toString() || "2",
                    "@min-checkins-per-team": phase.MinCheckinsPerTeam?.toString() || "1",
                    "@min-teams-per-match": phase.MinTeamsPerMatch?.toString() || "2",
                    "@type": phase.Type?.toString() || "2",
                    round: phase.Rounds?.map((round: any) => ({
                      "@id": round.Id?.toString() || "1",
                      "@max-game-count": round.MaxGameCount?.toString() || "1",
                      "@max-length": round.MaxLength?.toString() || "12",
                      "@min-length": round.MinGameLength?.toString() || "8",
                      "@win-score": round.WinScore?.toString() || "1"
                    })) || []
                  })) || []
                }
              ],
              "sponsor-data": [
                {
                  "@image": tournament.SponsorImageUrl || "",
                  "@name": tournament.SponsorName || ""
                }
              ],
              "stream-data": [
                {
                  "@stream-link": tournament.StreamUrl || ""
                }
              ]
            }
          },
          icon: tournament.IconUrl || "",
          id: tournament.Id.toString(),
          image: tournament.ImageUrl || null,
          invitationcloses: invitationCloseTimeResponse ? invitationCloseTimeResponse.toISOString() : "",
          invitationopens: invitationOpenTimeResponse ? invitationOpenTimeResponse.toISOString() : "",
          inviteAceptedAt: userInvite?.acceptedAt ? new Date(new Date(userInvite.acceptedAt).getTime() + 3 * 60 * 60 * 1000).toISOString() : null,
          inviteDeclinedAt: userInvite?.declinedAt ? new Date(new Date(userInvite.declinedAt).getTime() + 3 * 60 * 60 * 1000).toISOString() : null,
          inviteId: userInvite?.inviteId?.toString() || null,
          inviteIsPartyLeader: true,
          invitePartyCode: null,
          invitePartyId: userInvite?.inviteId?.toString() || partyId.toString(),
          inviteStatus: userInvite?.status || 1,
          isAdministrator: user.isAdministrator,
          maxinvites: tournament.MaxInvites ? parseInt(tournament.MaxInvites) : 128,
          name: tournament.TournamentName || "",
          nextphase: tournament.NextPhase ? new Date(new Date(tournament.NextPhase).getTime() + 3 * 60 * 60 * 1000).toISOString() : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          openregistration: parseFloat(registrationOpensValue),
          partysize: tournament.PartySize ? parseInt(tournament.PartySize) : 1,
          phasecount: tournament.PhaseCount ? parseInt(tournament.PhaseCount) : 1,
          privateCode: null,
          prizeDelivered: userInvite?.prizeDelivered || null,
          roundcount: tournament.RoundCount ? parseInt(tournament.RoundCount) : 7,
          season: 1,
          seasonpart: 1,
          sponsorimage: tournament.SponsorImageUrl || "",
          sponsorname: tournament.SponsorName || "",
          status: parseInt(tournament.Status.toString()),
          "theme-color": tournament.ThemeColor || "#9d9d9dff",
          tournamenttime: invitationCloseTimeResponse ? new Date(invitationCloseTimeResponse).toISOString() : "",
          type: tournament.Type ? parseInt(tournament.Type) : 1,
          userPlace: userInvite?.finalPlace || 0
        };

        let responseData = {};
        if (getAllData === "0" && readyForNextMatch === "1") {
          responseData = {
            party: [],
            tournamentData: [],
            userMatch: activeMatch ? buildMatchData(activeMatch) : userMatch,
            userMatches,
            userPosition,   
          };
        } else {  
          responseData = {
            party: [
              {
                checkIn: userInvite?.isCheckedIn,
                isPartyLeader: userInvite?.isPartyLeader,
                nick: userInvite?.inviteUserNick || "",
                status: userInvite?.status,
                userId: userInvite?.inviteUserId
              }
            ],
            tournamentData: [tournamentData],
            userMatch: tournament.Status >= 3 ? userMatch : {},
            userMatches: tournament.Status >= 3 ? userMatches : [],
            userPosition: invite != null && tournament.Status >= 3 ? userPosition : []
          };      
        }

        res.json(createResponse(1, "Tournament data retrieved successfully", responseData));
      } catch (error) {
        res.status(200).json(createResponse(500, 'Internal server error', null, 'TOUR_003'));
      }
    };

    export const tournamentGetScore = async (req: Request, res: Response): Promise<void> => {
      try {
        const { tournamentId, phaseId, maxResults, page, groupId } = req.body;
        
        const scores = await getTournamentScores(tournamentId, phaseId, groupId);
        
        const formattedScores = scores.map((score: any) => {
          const users = (score.users || []).map((user: any) => ({
            "@user-id": user.userId?.toString() || "0",
            "@checked-in": user.checkedIn ? "1" : "0",
            "@is-party-leader": user.isPartyLeader ? "1" : "0",
            "@status": user.status?.toString() || "0",
            "@nick": user.nick || ""
          }));

          return {
            partyid: score.partyId?.toString() || "0",
            phaseid: score.phaseId?.toString() || "0",
            groupid: score.groupId?.toString() || "0",
            checkin: score.isCheckedIn?.toString() || "0",
            position: score.position?.toString() || "0",
            totalpoints: score.totalPoints?.toString() || "0",
            matchwins: score.matchWins?.toString() || "0",
            matchloses: score.matchLoses?.toString() || "0",
            gamewins: score.gameWins?.toString() || "0",
            gameloses: score.gameLoses?.toString() || "0",
            stat1sum: score.stat1Summed?.toString() || "0",
            stat2sum: score.stat2Summed?.toString() || "0",
            seed: score.seed?.toString() || "0",
            loseweight: score.loseWeight?.toString() || "0",
            totalrounds: score.totalRounds?.toString() || "0",
            users,
          };
        });

        res.json(createResponse(1, "Tournament scores retrieved successfully", {
          scores: formattedScores,
          pagination: {
            totalResultCount: formattedScores.length,
            maxResults: parseInt(maxResults),
            currentPage: parseInt(page)
          }
        }));
      } catch (error) {
        res.status(500).json(createResponse(500, 'Internal server error', null, 'TOUR_004'));
      }
    };


    export const tournamentGetMatches = async (req: Request, res: Response): Promise<void> => {
      try {
        const { tournamentId, phaseId, fromRoundId, toRoundId, maxResults, page, onlyInProgress, groupId } = req.body;
        
        const tournament = await findTournamentById(tournamentId);
        const matches = tournament.AllMatches || [];

        if (matches.lenght === 0)
        {
           res.status(200).json(createResponse(0, "n tem match", {
            matches: []
          }));
          return;
        }
        
        const formattedMatches = matches.map((match: any) => {
          const users = (match.teams || []).flatMap((team: any) =>
            (team.users || []).map((user: any) => ({
              "@checked-in": user.checkedIn ? "1" : "0",
              "@match-points": user.matchPoints?.toString() || "0",
              "@match-winner": user.isWinner ? "1" : "0",
              "@nick": user.nick || "",
              "@team-id": team.teamId?.toString() || "0",
              "@team-points": team.points?.toString() || "0",
              "@team-score": team.score?.toString() || "0",
              "@user-id": user.userId?.toString() || "0",
              "@user-points": user.userPoints?.toString() || "0",
              "@user-score": user.userScore?.toString() || "0"
            }))
          );

          const id = `${match.phaseId?.toString()}${match.roundId?.toString()}`;

          return {
            deadline: (match.deadline ? match.deadline.toISOString() : new Date().toISOString()),
            groupid: (parseInt(match.groupId?.toString()) || "0"),
            id,
            matchid: (parseInt(match.matchId?.toString()) || 0),
            phaseid: (parseInt(match.phaseId?.toString()) || 0),
            playedgamecount: (parseInt(match.playedGameCount?.toString()) || 0),
            roundid: (parseInt(match.roundId?.toString()) || 0),
            secret: null,
            status: (parseInt(match.status?.toString()) || 0),
            tournamentid: tournamentId,
            users,
          };
        });

        let filteredMatches = formattedMatches;

        if (onlyInProgress) {
          filteredMatches = filteredMatches.filter((match: any) => match.status === 2);
        }

        const response = {
          matches: formattedMatches,
          pagination: {
            currentPage: parseInt(page),
            maxResults: parseInt(maxResults),
            totalResultCount: formattedMatches.length
          }
        };

        res.status(200).json(createResponse(1, "aaaa", response));
      } catch (error) {
        console.error('Error in tournamentGetMatches:', error);
        res.status(500).json(createResponse(500, 'Internal server error', null, 'TOUR_005'));
      }
    };

      export const tournamentGetMatchesByIds = async (req: Request, res: Response): Promise<void> => {
        try {
          const { tournamentId, matchIds } = req.body;
          
          const matches = await getTournamentMatchesByIds(tournamentId, matchIds);
          
          const formattedMatches = matches.map((match: any) => {
            const users = (match.teams || []).flatMap((team: any) =>
              (team.users || []).map((user: any) => ({
                "@checked-in": user.checkedIn ? "1" : "0",
                "@match-points": user.matchPoints?.toString() || "0",
                "@match-winner": user.isWinner ? "1" : "0",
                "@nick": user.nick || "",
                "@team-id": team.teamId?.toString() || "0",
                "@team-points": team.points?.toString() || "0",
                "@team-score": team.score?.toString() || "0",
                "@user-id": user.userId?.toString() || "0",
                "@user-points": user.userPoints?.toString() || "0",
                "@user-score": user.userScore?.toString() || "0"
              }))
            );
            const teamGroups = (match.teams || []).map((team: any) => ({ teamId: team.teamId, users: team.users || [] }));
            const fullyCheckedInTeamCount = teamGroups.filter((t: any) => t.users.length > 0 && t.users.every((u: any) => u.checkedIn)).length;
            const partiallyCheckedInTeamCount = teamGroups.filter((t: any) => (t.users.filter((u: any) => u.checkedIn).length >= (match.minCheckinsPerTeam || 1))).length;
            const checkedInUserCount = teamGroups.reduce((acc: number, t: any) => acc + t.users.filter((u: any) => u.checkedIn).length, 0);
            return {
              id: match.matchId.toString(),
              secret: match.secret || "",
              deadline: match.deadline ? new Date(match.deadline).toISOString() : "",
              matchid: match.matchId?.toString() || "0",
              phaseid: match.phaseId?.toString() || "0",
              groupid: match.groupId?.toString() || "0",
              roundid: match.roundId?.toString() || "0",
              status: match.status?.toString() || "0",
              winscore: match.winScore?.toString() || "0",
              playedgamecount: match.currentGameCount?.toString() || "0",
              users,
            };
          });

          res.json(createResponse(1, "Tournament matches by IDs retrieved successfully", {
            matches: formattedMatches,
            tournamentid: tournamentId.toString()
          }));
        } catch (error) {
          res.status(500).json(createResponse(500, 'Internal server error', null, 'TOUR_006'));
        }
      };



      export const tournamentSignup = async (req: Request, res: Response): Promise<void> => {
        try {
          const { tournamentId } = req.body;
          const user = (req as any).user;

          const tournament = await findTournamentById(tournamentId);

          const inviteId = GenIntCaracters(3);
          await addTournamentParticipant(inviteId, tournamentId, user);

          let signStatus = 0;

          if (tournament.CurrentInvites >= tournament.MaxInvites)
          {
            signStatus = 6;
          }
          else {
            signStatus = 1;
          }

          res.status(200).json(createResponse(0, "Successfully signed up for tournament", {
            status: signStatus.toString(),
            inviteId: inviteId.toString(),
            inviteStatus: "1"
          }));
        } catch (error) {
          console.log("sigup error: " + error)
          res.status(500).json(createResponse(500, 'Internal server error', null, 'TOUR_007'));
        }
      };

      export const tournamentProcessInvite = async (req: Request, res: Response): Promise<void> => {
        try {
          const { inviteId, action } = req.body;
          const user = (req as any).user;

          const tournament = await findTournamentByInviteId(inviteId);
          if (!tournament) {
            res.status(404).json(createResponse(404, 'Invite not found', null, 'TOUR_008'));
            return;
          }

          await updateTournamentInvite(tournament.Id, inviteId, {
            status: action === 1 ? 1 : 0,
          });

          if (action === 1) {
            await addTournamentParticipant(inviteId, tournament.Id, user);
          }

          res.json(createResponse(1, "Tournament invite processed successfully", {
            inviteId: inviteId.toString(),
            status: action.toString(),
            inviteStatus: "1"
          }));
        } catch (error) {
          res.status(500).json(createResponse(500, 'Internal server error', null, 'TOUR_008'));
        }
      };


      export const tournamentPartyCreateCode = async (req: Request, res: Response): Promise<void> => {
        try {
          const { tournamentId, getAllData, readyForNextMatch } = req.body;
          const user = (req as any).user;

          const tournament = await findTournamentById(tournamentId);
          if (!tournament) {
            res.status(404).json(createResponse(404, 'Tournament not found', null, 'TOUR_002'));
            return;
          }

          const party = await addTournamentParty(tournamentId, {
            creatorId: user.userId,
            tournamentId
          });

          res.json(createResponse(1, "Tournament party code created successfully", {
            partycode: party.partyCode,
            tournamentid: tournamentId.toString()
          }));
        } catch (error) {
          res.status(500).json(createResponse(500, 'Internal server error', null, 'TOUR_011'));
        }
      };

      export const tournamentPartyJoinByCode = async (req: Request, res: Response): Promise<void> => {
        try {
          const { tournamentId, partyCode } = req.body;
          const user = (req as any).user;

          const party = await findTournamentPartyByCode(tournamentId, partyCode);
          if (!party) {
            res.status(404).json(createResponse(404, 'Invalid party code', null, 'TOUR_012'));
            return;
          }

          await addUserToTournamentParty(tournamentId, partyCode, user.userId);

          res.json(createResponse(1, "Successfully joined tournament party", {
            partyInviteId: tournamentId.toString(),
            status: "1"
          }));
        } catch (error) {
          res.status(500).json(createResponse(500, 'Internal server error', null, 'TOUR_012'));
        }
      };

      export const tournamentPartyRemoveUser = async (req: Request, res: Response): Promise<void> => {
        try {
          const { tournamentId, removeUserId } = req.body;
          const user = (req as any).user;

          const tournament = await findTournamentById(tournamentId);
          if (!tournament) {
            res.status(404).json(createResponse(404, 'Tournament not found', null, 'TOUR_002'));
            return;
          }

          const userParty = tournament.Invites.find((party: any) => 
            party.includes(user.userId)
          );

          if (!userParty || userParty.creatorId !== user.userId) {
            res.status(403).json(createResponse(403, 'Not authorized to remove users', null, 'TOUR_013'));
            return;
          }

          await removeUserFromTournamentParty(tournamentId, userParty.partyCode, removeUserId);

          res.json(createResponse(1, "User removed from tournament party successfully", {
            tournamentid: tournamentId.toString(),
            removeuserid: removeUserId.toString(),
            removed: true
          }));
        } catch (error) {
          res.status(500).json(createResponse(500, 'Internal server error', null, 'TOUR_013'));
        }
      };