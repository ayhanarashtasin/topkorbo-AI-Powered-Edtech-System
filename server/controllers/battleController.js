const crypto = require('crypto');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');

const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;
const BATTLE_MODE_CONFIG = {
  duel: {
    label: '1v1 Duel',
    maxPlayers: 2,
    minPlayers: 2,
    teamSize: 1
  },
  squad: {
    label: 'Squad 5v5',
    maxPlayers: 10,
    minPlayers: 10,
    teamSize: 5
  },
  'custom-squad': {
    label: 'Custom Squad',
    maxPlayers: 10,
    minPlayers: 10,
    teamSize: 5
  },
  raid: {
    label: 'Grand Raid',
    maxPlayers: 30,
    minPlayers: 1,
    teamSize: 0
  }
};

const getModeConfig = (mode, teamSize = null, maxPlayers = null) => {
  const baseConfig = BATTLE_MODE_CONFIG[mode] || BATTLE_MODE_CONFIG.duel;
  if (mode === 'raid') {
    const raidMaxPlayers = Math.max(2, Math.min(30, Number(maxPlayers) || 20));
    return {
      ...baseConfig,
      maxPlayers: raidMaxPlayers,
      minPlayers: raidMaxPlayers,
      label: `Grand Raid ${raidMaxPlayers}`
    };
  }
  if (mode !== 'custom-squad') return baseConfig;

  const size = Math.max(2, Math.min(10, Number(teamSize) || 5));
  return {
    ...baseConfig,
    label: `Custom Squad ${size}v${size}`,
    maxPlayers: size * 2,
    minPlayers: size * 2,
    teamSize: size
  };
};

const isSquadMode = (mode) => mode === 'squad' || mode === 'custom-squad';
const isRaidMode = (mode) => mode === 'raid';

const getBalancedTeam = (players, teamSize) => {
  const teamACount = players.filter((player) => player.team === 'A').length;
  const teamBCount = players.filter((player) => player.team === 'B').length;

  if (teamACount >= teamSize) return 'B';
  if (teamBCount >= teamSize) return 'A';
  return teamACount <= teamBCount ? 'A' : 'B';
};

const getRealJoinTeam = (players, teamSize) => {
  const teamARealCount = players.filter((player) => player.team === 'A' && !player.isTestPlayer).length;
  const teamBRealCount = players.filter((player) => player.team === 'B' && !player.isTestPlayer).length;
  const teamACount = players.filter((player) => player.team === 'A').length;
  const teamBCount = players.filter((player) => player.team === 'B').length;

  if (teamARealCount <= teamBRealCount && teamACount <= teamSize) return 'A';
  if (teamBCount <= teamSize) return 'B';
  return 'A';
};

const createSquadTestPlayers = (teamSize = 5) => {
  const teamANames = ['Nusrat J.', 'Mahin R.', 'Farhan S.', 'Rodela K.', 'Tuba W.', 'Samin V.', 'Jarin M.', 'Rifat Z.', 'Tania C.'];
  const teamBNames = ['Araf T.', 'Samia N.', 'Ayon D.', 'Mim F.', 'Shuvo P.', 'Sadia L.', 'Nabil Q.', 'Arif B.', 'Mehrab I.', 'Rafiq H.'];
  const testNames = [
    ...teamANames.slice(0, Math.max(0, teamSize - 1)).map((name, index) => [`squad-bot-a${index + 1}`, 'A', name]),
    ...teamBNames.slice(0, teamSize).map((name, index) => [`squad-bot-b${index + 1}`, 'B', name])
  ];

  return testNames.map(([id, team, name]) => ({
    id,
    name,
    avatar: '',
    role: 'student',
    team,
    score: 0,
    lastDelta: 0,
    answeredAt: null,
    isCorrect: null,
    ready: true,
    isTestPlayer: true,
    answers: {}
  }));
};

const normalizeTeamNames = (teamNames = {}) => ({
  A: String(teamNames.A || '').trim().slice(0, 24) || 'Team A',
  B: String(teamNames.B || '').trim().slice(0, 24) || 'Team B'
});

const ensureSquadTestPlayers = (room) => {
  if (!room || !isSquadMode(room.settings?.mode) || room.status !== 'waiting') return;

  const modeConfig = getModeConfig(room.settings.mode, room.settings.teamSize, room.settings.maxPlayers);
  const existingIds = new Set(room.players.map((player) => player.id));
  createSquadTestPlayers(modeConfig.teamSize).forEach((testPlayer) => {
    const teamCount = room.players.filter((player) => player.team === testPlayer.team).length;
    if (existingIds.has(testPlayer.id) || room.players.length >= modeConfig.maxPlayers || teamCount >= modeConfig.teamSize) return;
    room.players.push(testPlayer);
    existingIds.add(testPlayer.id);
  });
};

const cleanExpiredRooms = () => {
  const now = Date.now();
  rooms.forEach((room, id) => {
    if (now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(id);
    }
  });
};

const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select('name avatar role');
  return {
    id: String(userId),
    name: user?.name || 'Student',
    avatar: user?.avatar || '',
    role: user?.role || 'student'
  };
};

const sanitizeQuestions = (questions = [], room = null, viewerId = '') => questions.map((question, index) => {
  const viewer = room?.players?.find((player) => player.id === String(viewerId));
  const viewerAnswer = viewer?.answers?.[index];
  const canRevealAnswer = viewerAnswer !== undefined || room?.status === 'finished';

  return {
    questionText: question.questionText,
    imageUrl: question.imageUrl || '',
    type: question.type || 'mcq',
    subject: question.subject || '',
    chapter: question.chapter || '',
    options: (question.options || []).map((option) => ({ text: option.text })),
    viewerAnswer: viewerAnswer ?? null,
    correctOptionIndex: canRevealAnswer
      ? (question.options || []).findIndex((option) => option.isCorrect)
      : null
  };
});

const sanitizeRoom = (room, viewerId = '') => ({
  id: room.id,
  status: room.status,
  hostId: room.hostId,
  settings: room.settings,
  currentIndex: room.currentIndex,
  questionStartedAt: room.questionStartedAt,
  createdAt: room.createdAt,
  questions: sanitizeQuestions(room.questions, room, viewerId),
  players: room.players.map((player) => ({
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    team: player.team,
    isTestPlayer: Boolean(player.isTestPlayer),
    score: player.score,
    lastDelta: player.lastDelta,
    answeredAt: player.answeredAt,
    isCorrect: player.isCorrect,
    ready: Boolean(player.ready),
    hasAnsweredCurrent: player.answers?.[room.currentIndex] !== undefined
  })),
  log: room.log.slice(0, 8)
});

const calculateBattlePoints = (seconds, isCorrect, hasNegativeMarking = false) => {
  if (!isCorrect) return hasNegativeMarking ? -1 : 0;
  if (seconds <= 5) return 5;
  return Math.max(0, Math.round(seconds - 5));
};

const resetRoundPlayers = (room) => {
  room.players = room.players.map((player) => ({
    ...player,
    lastDelta: 0,
    answeredAt: null,
    isCorrect: null
  }));
};

const advanceRoomIfNeeded = (room) => {
  if (!room || room.status !== 'active') return;

  const now = Date.now();
  const questionTimeMs = Math.max(5, Math.min(120, room.settings.questionTimeSeconds || 15)) * 1000;
  const timeExpired = room.questionStartedAt && now - room.questionStartedAt >= questionTimeMs;

  if (!timeExpired) return;

  if (room.currentIndex + 1 >= room.questions.length) {
    room.status = 'finished';
    return;
  }

  room.currentIndex += 1;
  room.questionStartedAt = now;
  resetRoundPlayers(room);
};

exports.createRoom = async (req, res, next) => {
  try {
    cleanExpiredRooms();

    const { questions, settings } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return ApiResponse.error(res, 'At least one battle question is required', 400);
    }

    const questionTimeSeconds = Number(settings?.questionTimeSeconds || 15);
    if (questionTimeSeconds < 5 || questionTimeSeconds > 120) {
      return ApiResponse.error(res, 'Question time must be between 5 seconds and 120 seconds', 400);
    }

    const requestedMode = settings?.mode === 'squad' || settings?.mode === 'custom-squad' || settings?.mode === 'raid' ? settings.mode : 'duel';
    const modeConfig = getModeConfig(requestedMode, settings?.teamSize, settings?.maxPlayers);
    const mode = isSquadMode(requestedMode) || isRaidMode(requestedMode) ? requestedMode : 'duel';
    const teamNames = normalizeTeamNames(settings?.teamNames);
    const host = await getUserProfile(req.user.id);
    const roomId = crypto.randomBytes(4).toString('hex');
    const roomQuestions = questions.slice(0, Math.max(1, Math.min(Number(settings?.totalQuestions || 10), 50)));

    const room = {
      id: roomId,
      hostId: host.id,
      status: 'waiting',
      createdAt: Date.now(),
      currentIndex: 0,
      questionStartedAt: null,
      settings: {
        mode,
        modeLabel: modeConfig.label,
        maxPlayers: modeConfig.maxPlayers,
        minPlayers: modeConfig.minPlayers,
        teamSize: modeConfig.teamSize,
        teamNames,
        questionTimeSeconds,
        totalQuestions: roomQuestions.length,
        questionType: settings?.questionType || 'mcq',
        negativeMarking: Boolean(settings?.negativeMarking)
      },
      questions: roomQuestions,
      players: [{
        ...host,
        team: isRaidMode(mode) ? null : 'A',
        score: 0,
        lastDelta: 0,
        answeredAt: null,
        isCorrect: null,
        ready: false,
        answers: {}
      }, ...(isSquadMode(mode) ? createSquadTestPlayers(modeConfig.teamSize) : [])],
      log: [
        ...(isSquadMode(mode) ? [`Test squad players are ready for ${modeConfig.teamSize}v${modeConfig.teamSize} local testing.`] : []),
        `${host.name} created the ${modeConfig.label} room.`
      ]
    };

    ensureSquadTestPlayers(room);

    rooms.set(roomId, room);
    return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Battle room created', 201);
  } catch (err) {
    next(err);
  }
};

exports.getRoom = async (req, res, next) => {
  try {
    cleanExpiredRooms();
    const room = rooms.get(req.params.roomId);
    if (!room) return ApiResponse.error(res, 'Battle room not found', 404);

    ensureSquadTestPlayers(room);
    advanceRoomIfNeeded(room);
    return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Battle room fetched');
  } catch (err) {
    next(err);
  }
};

exports.joinRoom = async (req, res, next) => {
  try {
    cleanExpiredRooms();
    const room = rooms.get(req.params.roomId);
    if (!room) return ApiResponse.error(res, 'Battle room not found', 404);
    if (room.status !== 'waiting') return ApiResponse.error(res, 'This battle has already started', 409);

    ensureSquadTestPlayers(room);
    const profile = await getUserProfile(req.user.id);
    const alreadyJoined = room.players.some((player) => player.id === profile.id);
      if (!alreadyJoined) {
      const modeConfig = getModeConfig(room.settings?.mode, room.settings?.teamSize, room.settings?.maxPlayers);
      let team = isSquadMode(room.settings?.mode) ? getBalancedTeam(room.players, modeConfig.teamSize) : null;
      let replacedTestPlayer = false;
      if (room.players.length >= modeConfig.maxPlayers) {
        if (!isSquadMode(room.settings?.mode)) return ApiResponse.error(res, `This ${modeConfig.label} room is full`, 409);
        team = getRealJoinTeam(room.players, modeConfig.teamSize);
        const replaceableIndex = room.players.findIndex((player) => player.isTestPlayer && player.team === team);
        if (replaceableIndex === -1) return ApiResponse.error(res, `This ${modeConfig.label} room is full`, 409);
        const replacedPlayer = room.players.splice(replaceableIndex, 1)[0];
        room.log.unshift(`${profile.name} replaced ${replacedPlayer.name} on Team ${team}.`);
        replacedTestPlayer = true;
      }
      room.players.push({
        ...profile,
        team,
        score: 0,
        lastDelta: 0,
        answeredAt: null,
        isCorrect: null,
        ready: false,
        answers: {}
      });
      if (!replacedTestPlayer) {
        room.log.unshift(isRaidMode(room.settings?.mode) ? `${profile.name} joined the raid.` : `${profile.name} joined Team ${team}.`);
      }
    }

    return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Joined battle room');
  } catch (err) {
    next(err);
  }
};

exports.startRoom = async (req, res, next) => {
  try {
    const room = rooms.get(req.params.roomId);
    if (!room) return ApiResponse.error(res, 'Battle room not found', 404);
    ensureSquadTestPlayers(room);
    const modeConfig = getModeConfig(room.settings?.mode, room.settings?.teamSize, room.settings?.maxPlayers);
    if (room.players.length < modeConfig.minPlayers) {
      return ApiResponse.error(res, `Waiting for ${modeConfig.minPlayers - room.players.length} more player${modeConfig.minPlayers - room.players.length === 1 ? '' : 's'}`, 400);
    }
    const realPlayerCount = room.players.filter((player) => !player.isTestPlayer).length;
    if (isSquadMode(room.settings?.mode) && realPlayerCount < 2) {
      return ApiResponse.error(res, 'Waiting for one more real student', 400);
    }
    if (room.status === 'finished') return ApiResponse.error(res, 'This battle already finished', 409);
    if (room.status !== 'waiting') return ApiResponse.error(res, 'This battle has already started', 409);

    const player = room.players.find((item) => item.id === String(req.user.id));
    if (!player) return ApiResponse.error(res, 'You are not in this battle room', 403);

    player.ready = true;
    room.log.unshift(`${player.name} is ready.`);

    const allReady = room.players.length >= modeConfig.minPlayers && room.players.every((item) => item.ready);
    if (!allReady) {
      return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Waiting for all players to start');
    }

    room.status = 'active';
    room.currentIndex = 0;
    room.questionStartedAt = Date.now();
    room.log.unshift(`The ${modeConfig.label} started.`);
    resetRoundPlayers(room);

    return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Battle started');
  } catch (err) {
    next(err);
  }
};

exports.submitAnswer = async (req, res, next) => {
  try {
    const room = rooms.get(req.params.roomId);
    if (!room) return ApiResponse.error(res, 'Battle room not found', 404);
    if (room.status !== 'active') return ApiResponse.error(res, 'Battle is not active', 400);

    advanceRoomIfNeeded(room);
    if (room.status !== 'active') {
      return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Battle finished');
    }

    const player = room.players.find((item) => item.id === String(req.user.id));
    if (!player) return ApiResponse.error(res, 'You are not in this battle room', 403);
    if (player.answers?.[room.currentIndex] !== undefined) {
      return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Answer already submitted');
    }

    const question = room.questions[room.currentIndex];
    const optionIndex = Number(req.body.optionIndex);
    const selectedOption = question?.options?.[optionIndex];
    const isCorrect = Boolean(selectedOption?.isCorrect);
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - room.questionStartedAt) / 1000));
    const cappedSeconds = Math.min(elapsedSeconds, room.settings.questionTimeSeconds);
    const points = calculateBattlePoints(cappedSeconds, isCorrect, room.settings.negativeMarking);

    player.answers = {
      ...(player.answers || {}),
      [room.currentIndex]: optionIndex
    };
    player.answeredAt = cappedSeconds;
    player.isCorrect = isCorrect;
    player.lastDelta = points;
    player.score = Math.max(0, player.score + points);
    room.log.unshift(`${player.name}: ${points > 0 ? '+' : ''}${points} pts at ${cappedSeconds}s`);

    advanceRoomIfNeeded(room);
    return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Answer submitted');
  } catch (err) {
    next(err);
  }
};
