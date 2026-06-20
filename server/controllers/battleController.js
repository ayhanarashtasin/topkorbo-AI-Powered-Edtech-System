const crypto = require('crypto');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');

const rooms = new Map();
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;

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
        mode: 'duel',
        questionTimeSeconds,
        totalQuestions: roomQuestions.length,
        questionType: settings?.questionType || 'mcq',
        negativeMarking: Boolean(settings?.negativeMarking)
      },
      questions: roomQuestions,
      players: [{
        ...host,
        score: 0,
        lastDelta: 0,
        answeredAt: null,
        isCorrect: null,
        ready: false,
        answers: {}
      }],
      log: [`${host.name} created the duel room.`]
    };

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

    const profile = await getUserProfile(req.user.id);
    const alreadyJoined = room.players.some((player) => player.id === profile.id);
    if (!alreadyJoined) {
      if (room.players.length >= 2) return ApiResponse.error(res, 'This 1v1 room is full', 409);
      room.players.push({
        ...profile,
        score: 0,
        lastDelta: 0,
        answeredAt: null,
        isCorrect: null,
        ready: false,
        answers: {}
      });
      room.log.unshift(`${profile.name} joined the duel.`);
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
    if (room.players.length < 2) return ApiResponse.error(res, 'Waiting for the second player', 400);
    if (room.status === 'finished') return ApiResponse.error(res, 'This battle already finished', 409);
    if (room.status !== 'waiting') return ApiResponse.error(res, 'This battle has already started', 409);

    const player = room.players.find((item) => item.id === String(req.user.id));
    if (!player) return ApiResponse.error(res, 'You are not in this battle room', 403);

    player.ready = true;
    room.log.unshift(`${player.name} is ready.`);

    const allReady = room.players.length === 2 && room.players.every((item) => item.ready);
    if (!allReady) {
      return ApiResponse.success(res, sanitizeRoom(room, req.user.id), 'Waiting for both players to start');
    }

    room.status = 'active';
    room.currentIndex = 0;
    room.questionStartedAt = Date.now();
    room.log.unshift('The duel started.');
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
