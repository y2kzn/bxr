import { getDatabase } from '../Config/Database';
import axios from 'axios';

export const createTour = async (data: any) => {
  const now = new Date();

  const invitationOpenTime = new Date(data.tournamentDate);
  invitationOpenTime.setHours(
    data.startHour + (data.invitationOffsetHours || 0),
    data.startMinute + (data.invitationOffsetMinutes || 0),
    0, 0
  );

  const registrationOpenTime = new Date(data.tournamentDate);
  registrationOpenTime.setHours(
    data.startHour + (data.registrationOffsetHours || 0),
    data.startMinute + (data.registrationOffsetMinutes || 0),
    0, 0
  );

  const invitationCloseTime = new Date(data.tournamentDate);
  invitationCloseTime.setHours(
    data.startHour + (data.invitationCloseOffsetHours || 0),
    data.startMinute + (data.invitationCloseOffsetMinutes || 0),
    0, 0
  );

  const tournamentTime = new Date(data.tournamentDate);
  tournamentTime.setHours(data.startHour, data.startMinute, 0, 0);

  const currentPhaseStarted = new Date(data.tournamentDate);
  currentPhaseStarted.setHours(data.startHour, data.startMinute, 0, 0);

  const phases = [];
  const phaseCount = data.phaseCount || 1;
  const roundCount = data.roundCount || 1;

  for (let i = 0; i < phaseCount; i++) {
    const phaseId = i + 1;
    const isLastPhase = phaseId === phaseCount;

    const phase = {
      Id: phaseId,
      Type: isLastPhase ? 2 : 3,
      MaxPlayers: data.maxPlayers,
      MaxTeams: data.maxTeams,
      MinTeamsPerMatch: data.minTeamsPerMatch,
      MaxTeamsPerMatch: data.maxTeamsPerMatch,
      MinCheckinsPerTeam: data.minCheckinsPerTeam,
      GroupCount: data.groupCount || 2,
      IsLoserBracketSeeded: data.isLoserBracketSeeded,
      IsSkipAllowed: data.isSkipAllowed,
      MaxLoses: data.maxLoses,
      AllowedRebuyCount: data.allowedRebuyCount,
      AllowedRebuyUntilRoundId: data.allowedRebuyUntilRoundId,
      RebuyPrice: data.rebuyPrice,
      Rounds: Array.from({ length: roundCount }, (_, j) => ({
        Id: j + 1,
        MaxLength: data.roundMaxLength,
        MinGameLength: data.roundMinGameLength,
        WinScore: data.winScore,
        MaxGameCount: data.maxGameCount,
        MatchPointDistribution: data.matchPointDistribution
      }))
    };

    phases.push(phase);
  }

  const tournamentData = {
    Id: data.id,
    Type: data.type,
    Status: data.status,
    Time: tournamentTime.toISOString(),
    InvitationOpenTime: invitationOpenTime.toISOString(),
    RegistrationOpenTime: registrationOpenTime.toISOString(),
    InvitationCloseTime: invitationCloseTime.toISOString(),
    MaxInvites: data.maxInvites,
    PartySize: data.partySize,
    CurrentInvites: data.currentInvites,
    PhaseCount: phaseCount,
    RoundCount: roundCount,
    SponsorName: data.sponsorName,
    SponsorImageUrl: data.sponsorImageUrl,
    TournamentName: data.tournamentName,
    CurrentPhaseId: 1,
    CurrentPhaseStarted: currentPhaseStarted.toISOString(),
    ImageUrl: data.imageUrl,
    IconUrl: data.iconUrl,
    ThemeColor: data.themeColor,
    HighlightsUrl: data.highlightsUrl,
    StreamUrl: data.streamUrl,
    LastUpdate: now.toISOString(),
    Requirements: {
      CustomRequirements: {
        server_region: data.serverRegion
      }
    },
    OnlyInviteds: data.onlyInviteds,
    EntryFee: {
      Amount: data.entryFeeAmount,
      Items: [
        {
          Type: data.entryFeeType,
          Id: data.entryFeeId,
          Amount: data.entryFeeItemAmount
        }
      ]
    },
    Phases: phases,
    Prizes: [
      {
        ToPlace: data.prizeToPlace,
        Items: [
          {
            Type: data.prizeType,
            Id: data.prizeId,
            Amount: data.prizeAmount
          }
        ]
      }
    ],
    CustomProperties: {
      disable_emotes: data.disableEmotes,
      phase1_override_level: data.phaseOverrideLevel,
      required_version: data.requiredVersion,
      minimum_version: data.minimumVersion,
      override_max_qualified: data.overrideMaxQualified,
      max_wait_time: data.maxWaitTime,
      game_round_count: data.gameRoundCount
    },
    Invites: [],
    Convidados: data.Convidados || [],
    Players: []
  };

  const createdTournament = await getDatabase()
    .collection('Tournaments')
    .insertOne(tournamentData);

  const regionMap = {
    sa: 'South America (SA)',
    na: 'North America (NA)',
    eu: 'Europe (EU)',
    asia: 'Asia',
    br: 'Brazil (BR)'
  };

  const levelMap = {
    level19_block: 'Block Dash',
    level15_laser: 'Laser Tracer',
    eventlevel1_dash: 'Laser Dash',
    eventlevel13_block_legendary: 'Block Dash Legendary',
    level21_pillar: 'Lava Land'
  };

  const tournamentTimeSeconds = Math.floor(new Date(tournamentData.Time).getTime() / 1000);
  const regionLabel = regionMap[data.serverRegion?.toLowerCase()] || data.serverRegion;
  const mapLabel = levelMap[data.phaseOverrideLevel] || data.phaseOverrideLevel;
  const phaseDescription = `${phaseCount} ${phaseCount === 1 ? 'Phase' : 'Phases'} & ${roundCount} ${roundCount === 1 ? 'Round' : 'Rounds'}`;
  const thumbnailUrl = data.iconUrl || 'https://i.imgur.com/KuAfYTi.png';
  const accentColor = typeof data.themeColor === 'number' ? data.themeColor : 24831;

  const componentsV2 = [
    {
      type: 17,
      accent_color: accentColor,
      spoiler: false,
      components: [
        {
          type: 9,
          accessory: {
            type: 11,
            media: { url: thumbnailUrl },
            description: null,
            spoiler: false
          },
          components: [
            {
              type: 10,
              content:
                `**- New tournament scheduled to <t:${tournamentTimeSeconds}:f> (Only for <@&1432423855137357824>)!**\n` +
                `**- ${data.tournamentName} ~ <:stumble_beast:1421843055627079861>**`
            }
          ]
        },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: `**- Region:\n- ${regionLabel}**` },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: `**- Phases:\n- ${phaseDescription}**` },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: `**- Max Players:\n- ${data.maxPlayers} Players**` },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: `**- Map:\n- ${mapLabel}**` },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: `**- Emotes:\n- <:soco_fogo:1423359915199561822><:soco:1423359898804289751>**` }
      ]
    }
  ];

  const messagePayload = {
    components: componentsV2,
    allowed_mentions: { parse: [] },
  };

  const webhookUrl = process.env.webhookUrl || '';

  if (webhookUrl) {
    try {
      await axios.post(webhookUrl, messagePayload, {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error(error);
    }
  }

  return createdTournament;
};
