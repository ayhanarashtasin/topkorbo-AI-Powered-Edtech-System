const crypto = require('crypto');
const mongoose = require('mongoose');
const { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } = require('livekit-server-sdk');
const LiveSession = require('../models/LiveSession');
const ClassAttendance = require('../models/ClassAttendance');
const MentorConnection = require('../models/MentorConnection');
const User = require('../models/User');

const MENTOR_ROLES = new Set(['tutor', 'teacher']);
const SESSION_TTL_SECONDS = 7200;
const WEEKLY_LIMIT = 4;
const RECONNECT_WINDOW_MS = 2 * 60 * 60 * 1000;

function getLiveKitConfig() {
  const host = process.env.LIVEKIT_HOST || process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!host || !apiKey || !apiSecret) {
    const err = new Error('LiveKit environment variables are missing. Set LIVEKIT_HOST (or LIVEKIT_URL), LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.');
    err.statusCode = 500;
    throw err;
  }

  return { host, apiKey, apiSecret };
}

function getWeekRange(baseDate = new Date()) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function buildRoomName(mentorId) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const nonce = crypto.randomBytes(3).toString('hex');
  return `live-${mentorId}-${stamp}-${nonce}`;
}

function isMentorRole(role) {
  return MENTOR_ROLES.has(role);
}

async function getWeeklyUsage(mentorId) {
  const { start, end } = getWeekRange();
  const mentor = await User.findById(mentorId).select('liveClassUsageResetAt').lean();
  const resetAt = mentor?.liveClassUsageResetAt || null;
  const effectiveStart = resetAt && resetAt > start ? resetAt : start;
  const count = await LiveSession.countDocuments({
    mentorId,
    actualStart: { $gte: effectiveStart, $lte: end },
  });

  return {
    count,
    limit: WEEKLY_LIMIT,
    weekStart: start,
    weekEnd: end,
    resetAt,
  };
}

function serializeSession(session) {
  return {
    _id: session._id,
    roomName: session.roomName,
    title: session.title,
    mentorId: session.mentorId,
    actualStart: session.actualStart,
    actualEnd: session.actualEnd,
    status: session.status,
  };
}

async function createToken({
  roomName,
  identity,
  name,
  metadata,
  apiKey,
  apiSecret,
  grants,
}) {
  // Use the SDK's AccessToken class — it produces a properly-signed JWT
  // with sane ttl / nbf / exp handling. Replaces the previous hand-rolled
  // jose.SignJWT call which emitted nbf=0 and exp=now+10y as a clock-skew
  // workaround. LiveKit Cloud accepts standard 2-hour tokens now.
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: SESSION_TTL_SECONDS,
    metadata: JSON.stringify(metadata),
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: !!grants.canPublish,
    ...(Array.isArray(grants.canPublishSources) ? { canPublishSources: grants.canPublishSources } : {}),
    canPublishData: true,
    canSubscribe: grants.canSubscribe !== false,
    canUpdateOwnMetadata: false,
  });

  const token = await at.toJwt();

  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    token,
    issuedAt: nowSeconds,
    notBefore: nowSeconds,
    expiresAt: nowSeconds + SESSION_TTL_SECONDS,
  };
}

exports.getMentorLiveClassDashboard = async (req, res, next) => {
  try {
    if (!isMentorRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only mentors can access live classes.' });
    }

    const usage = await getWeeklyUsage(req.user.id);
    const activeSession = await LiveSession.findOne({
      mentorId: req.user.id,
      status: 'live',
      actualStart: { $gte: new Date(Date.now() - RECONNECT_WINDOW_MS) },
    }).sort({ actualStart: -1 }).lean();

    return res.json({
      success: true,
      data: {
        sessionsThisWeek: usage.count,
        weeklyLimit: usage.limit,
        activeSession,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.startMentorLiveClass = async (req, res, next) => {
  try {
    if (!isMentorRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only mentors can start live classes.' });
    }

    const { host, apiKey, apiSecret } = getLiveKitConfig();
    const roomService = new RoomServiceClient(host, apiKey, apiSecret);
    const mentor = await User.findById(req.user.id).select('name role');
    if (!mentor || !isMentorRole(mentor.role)) {
      return res.status(403).json({ success: false, message: 'Mentor account not found.' });
    }

    const requestedTitle = String(req.body?.title || 'Live Class').trim().slice(0, 140);
    const requestedRoomName = req.body?.roomName ? String(req.body.roomName).trim() : '';
    const reconnectThreshold = new Date(Date.now() - RECONNECT_WINDOW_MS);

    let session = null;
    let weeklyUsageIncremented = false;

    if (requestedRoomName) {
      session = await LiveSession.findOne({
        mentorId: req.user.id,
        roomName: requestedRoomName,
        status: 'live',
        actualStart: { $gte: reconnectThreshold },
      });

      if (session) {
        const activeRooms = await roomService.listRooms([requestedRoomName]);
        if (!activeRooms.length) {
          // The database still has a live session, but LiveKit has already
          // deleted the room (usually because the previous browser session
          // dropped and the room was cleaned up). Mark the stale row closed
          // so we can mint a fresh room instead of rejoining a dead one.
          session.status = 'completed';
          session.actualEnd = new Date();
          await session.save();
          session = null;
        }
      }
    }

    if (!session) {
      const usage = await getWeeklyUsage(req.user.id);
      if (usage.count >= WEEKLY_LIMIT) {
        return res.status(403).json({
          success: false,
          message: 'Weekly live class limit reached. You can run up to 4 sessions per week.',
          data: {
            sessionsThisWeek: usage.count,
            weeklyLimit: usage.limit,
          },
        });
      }

      try {
        session = await LiveSession.create({
          roomName: buildRoomName(req.user.id),
          mentorId: req.user.id,
          title: requestedTitle || 'Live Class',
          actualStart: new Date(),
          status: 'live',
        });
        weeklyUsageIncremented = true;
      } catch (createErr) {
        // E11000 on the partial unique index {mentorId:1, status:'live'}
        // means a concurrent request just created the live session. Fall
        // through to the reconnect path — a double-click / double-tab
        // scenario, which is exactly what we want to be idempotent for.
        if (createErr && createErr.code === 11000) {
          session = await LiveSession.findOne({
            mentorId: req.user.id,
            status: 'live',
            actualStart: { $gte: reconnectThreshold },
          });
          if (!session) {
            // Race produced a stale live row (>RECONNECT_WINDOW_MS old).
            // Surface a clear 409 so the client knows to end and restart.
            return res.status(409).json({
              success: false,
              message: 'A live session already exists for your account. Please end it first.',
            });
          }
        } else {
          throw createErr;
        }
      }
    }

    const tokenData = await createToken({
      roomName: session.roomName,
      identity: `mentor:${mentor._id}`,
      name: mentor.name,
      metadata: {
        classId: String(session._id),
        mentorId: String(mentor._id),
        role: 'mentor',
        userId: String(mentor._id),
      },
      apiKey,
      apiSecret,
      grants: {
        canPublish: true,
        canSubscribe: true,
      },
    });

    const usage = await getWeeklyUsage(req.user.id);
    return res.json({
      success: true,
      data: {
        token: tokenData.token,
        wsUrl: host,
        roomName: session.roomName,
        session: serializeSession(session),
        sessionsThisWeek: usage.count,
        weeklyLimit: usage.limit,
        weeklyUsageIncremented,
        reconnectWindowSeconds: SESSION_TTL_SECONDS,
        tokenDebug: {
          issuedAt: tokenData.issuedAt,
          notBefore: tokenData.notBefore,
          expiresAt: tokenData.expiresAt,
        },
      },
    });
  } catch (err) {
    console.error('Error starting mentor live class:', err);
    next(err);
  }
};

exports.endMentorLiveClass = async (req, res, next) => {
  try {
    if (!isMentorRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only mentors can end live classes.' });
    }

    const { host, apiKey, apiSecret } = getLiveKitConfig();
    const session = await LiveSession.findOne({
      _id: req.params.sessionId,
      mentorId: req.user.id,
      status: 'live',
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Active live class not found.' });
    }

    session.status = 'completed';
    session.actualEnd = new Date();
    await session.save();

    try {
      const roomService = new RoomServiceClient(host, apiKey, apiSecret);
      await roomService.deleteRoom(session.roomName);
    } catch (err) {
      // Ignore "room already gone" type failures so the DB stays authoritative.
    }

    return res.json({
      success: true,
      data: serializeSession(session),
      message: 'Live class ended.',
    });
  } catch (err) {
    next(err);
  }
};

exports.listStudentLiveClasses = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can view live class listings.' });
    }

    const acceptedMentors = await MentorConnection.find({
      student: req.user.id,
      status: 'accepted',
    }).select('mentor');

    const mentorIds = acceptedMentors.map((item) => item.mentor);
    if (!mentorIds.length) {
      return res.json({ success: true, data: [] });
    }

    const sessions = await LiveSession.find({
      mentorId: { $in: mentorIds },
      status: 'live',
    })
      .populate('mentorId', 'name avatar universityName department')
      .sort({ actualStart: -1 })
      .lean();

    return res.json({
      success: true,
      data: sessions.map((session) => ({
        _id: session._id,
        roomName: session.roomName,
        title: session.title,
        actualStart: session.actualStart,
        status: session.status,
        mentor: session.mentorId ? {
          _id: session.mentorId._id,
          name: session.mentorId.name,
          avatar: session.mentorId.avatar || '',
          universityName: session.mentorId.universityName || '',
          department: session.mentorId.department || '',
        } : null,
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.joinStudentLiveClass = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can join live classes.' });
    }

    const { host, apiKey, apiSecret } = getLiveKitConfig();
    const roomName = String(req.body?.roomName || '').trim();
    if (!roomName) {
      return res.status(400).json({ success: false, message: 'roomName is required.' });
    }

    const session = await LiveSession.findOne({
      roomName,
      status: 'live',
    }).populate('mentorId', 'name');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Live class not found.' });
    }

    const isConnected = await MentorConnection.exists({
      student: req.user.id,
      mentor: session.mentorId._id,
      status: 'accepted',
    });

    if (!isConnected) {
      return res.status(403).json({
        success: false,
        message: 'You can only join live classes from mentors who accepted your connection.',
      });
    }

    const student = await User.findById(req.user.id).select('name');
    const tokenData = await createToken({
      roomName: session.roomName,
      identity: `student:${req.user.id}`,
      name: student?.name || 'Student',
      metadata: {
        classId: String(session._id),
        mentorId: String(session.mentorId._id),
        role: 'student',
        userId: String(req.user.id),
      },
      apiKey,
      apiSecret,
      grants: {
        canPublish: true,
        canPublishSources: [TrackSource.MICROPHONE],
        canSubscribe: true,
      },
    });

    return res.json({
      success: true,
      data: {
        token: tokenData.token,
        wsUrl: host,
        roomName: session.roomName,
        session: serializeSession(session),
        tokenDebug: {
          issuedAt: tokenData.issuedAt,
          notBefore: tokenData.notBefore,
          expiresAt: tokenData.expiresAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.handleLiveKitWebhook = async (req, res, next) => {
  const { apiKey, apiSecret } = getLiveKitConfig();
  const authHeader = req.headers.authorization || '';

  // The raw-body capture middleware MUST run before express.json() so the
  // HMAC signature check sees the exact wire bytes. If we got here without
  // rawBody, the middleware order is wrong — fail closed.
  if (typeof req.rawBody !== 'string' || req.rawBody.length === 0) {
    console.error('[livekit-webhook] missing rawBody — middleware order is wrong');
    return res.status(400).json({ success: false, message: 'Raw body required.' });
  }

  const receiver = new WebhookReceiver(apiKey, apiSecret);
  let event;
  try {
    event = await receiver.receive(req.rawBody, authHeader);
  } catch (err) {
    // Signature failure → 401 (do NOT fall through to errorHandler / 500;
    // we want a clear signal that verification failed).
    console.warn('[livekit-webhook] signature verification failed:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
  }

  // Parse participant metadata. Verified against livekit-server-sdk@2.15.5:
  // event.participant.metadata is a string (not pre-parsed), so JSON.parse
  // is correct. The previous handler silently swallowed parse errors which
  // masked configuration drift — surface them as warnings now.
  let metadata = null;
  const rawMeta = event.participant?.metadata;
  if (rawMeta) {
    if (typeof rawMeta !== 'string') {
      console.warn('[livekit-webhook] participant.metadata is not a string:', typeof rawMeta);
    } else {
      try {
        metadata = JSON.parse(rawMeta);
      } catch (parseErr) {
        console.warn('[livekit-webhook] failed to parse participant.metadata as JSON:', {
          eventId: event.id,
          eventName: event.event,
          parseError: parseErr.message,
          metadataPreview: rawMeta.slice(0, 200),
        });
      }
    }
  }

  if (!metadata?.classId || !metadata?.userId || metadata.role !== 'student') {
    // Non-student event (mentor join/leave) or a non-class event. No-op is
    // correct; just acknowledge so LiveKit doesn't retry.
    return res.json({ success: true, received: true });
  }

  const classId = metadata.classId;
  const studentId = metadata.userId;

  if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(studentId)) {
    return res.json({ success: true, received: true });
  }

  try {
    if (event.event === 'participant_joined') {
      await ClassAttendance.create({
        classId,
        studentId,
        joinedAt: new Date(),
      });
    }

    if (event.event === 'participant_left') {
      await ClassAttendance.findOneAndUpdate(
        {
          classId,
          studentId,
          leftAt: null,
        },
        {
          $set: { leftAt: new Date() },
        },
        { new: true, sort: { joinedAt: -1 } },
      );
    }

    return res.json({ success: true, received: true });
  } catch (err) {
    next(err);
  }
};
