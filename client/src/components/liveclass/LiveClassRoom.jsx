import { useEffect, useMemo, useState } from 'react';
import {
  LiveKitRoom,
  useLocalParticipant,
  RoomAudioRenderer,
  VideoTrack,
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { LogLevel, Track, setLogLevel } from 'livekit-client';
import { HiArrowsExpand, HiDesktopComputer, HiMicrophone, HiPhoneMissedCall, HiVideoCamera } from 'react-icons/hi';
import './LiveClassRoom.css';

function RoomLayout({ mode, onEndClass, sessionTitle }) {
  const room = useRoomContext();
  const participantSnapshot = useParticipants();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const tracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
    { source: Track.Source.Camera, withPlaceholder: false },
  ]);
  const [cameraEnabled, setCameraEnabled] = useState(mode === 'mentor');
  const [micEnabled, setMicEnabled] = useState(mode === 'mentor');
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const remoteParticipants = useMemo(
    () => Array.from(room?.remoteParticipants?.values() || []),
    [room, participantSnapshot]
  );

  const mentorTracks = tracks.filter((trackRef) => trackRef.participant.identity.startsWith('mentor:'));
  const mainMentorTrack = mentorTracks.find((trackRef) => trackRef.source === Track.Source.ScreenShare)
    || mentorTracks.find((trackRef) => trackRef.source === Track.Source.Camera)
    || null;

  const activeSpeakerIds = new Set((room?.activeSpeakers || []).map((participant) => participant.identity));
  const studentTracks = tracks.filter((trackRef) => (
    trackRef.participant.identity.startsWith('student:')
    && trackRef.source === Track.Source.Camera
  ));

  const featuredStudentTracks = [...studentTracks]
    .sort((a, b) => {
      const aActive = activeSpeakerIds.has(a.participant.identity) ? 1 : 0;
      const bActive = activeSpeakerIds.has(b.participant.identity) ? 1 : 0;
      return bActive - aActive;
    })
    .slice(0, 6);

  const studentParticipants = remoteParticipants
    .filter((participant) => (
      participant.identity.startsWith('student:')
    ))
    .map((participant) => ({
      identity: participant.identity,
      name: participant.name || participant.identity,
      isSpeaking: participant.isSpeaking,
    }));
  const fallbackActiveStudents = featuredStudentTracks.length
    ? []
    : studentParticipants.slice(0, 6);
  const featuredIds = new Set([
    ...featuredStudentTracks.map((trackRef) => trackRef.participant.identity),
    ...fallbackActiveStudents.map((participant) => participant.identity),
  ]);
  const compactParticipants = studentParticipants.filter((participant) => !featuredIds.has(participant.identity));

  const participantCount = remoteParticipants.length + (localParticipant ? 1 : 0);
  const mentorIdentity = mode === 'mentor'
    ? localParticipant?.identity
    : remoteParticipants.find((participant) => participant.identity.startsWith('mentor:'))?.identity;

  const mainStageLabel = useMemo(() => {
    if (!mainMentorTrack) return 'Waiting for mentor video';
    return mainMentorTrack.source === Track.Source.ScreenShare ? 'Mentor screen share' : 'Mentor camera';
  }, [mainMentorTrack]);

  const fallbackName = useMemo(() => {
    if (mode === 'mentor') return localParticipant?.name || 'Mentor';
    return remoteParticipants.find((participant) => participant.identity === mentorIdentity)?.name || 'Mentor';
  }, [localParticipant?.name, mentorIdentity, mode, remoteParticipants]);

  const fallbackInitial = (fallbackName || 'M').charAt(0).toUpperCase();

  const toggleCamera = async () => {
    if (!room?.localParticipant) return;
    const next = !cameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
  };

  const toggleMic = async () => {
    if (!room?.localParticipant) return;
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  };

  const toggleScreen = async () => {
    if (!room?.localParticipant) return;
    const next = !screenEnabled;
    await room.localParticipant.setScreenShareEnabled(next);
    setScreenEnabled(next);
  };

  const toggleStageFullscreen = async () => {
    const stageEl = document.querySelector('.live-room__stage-video');
    if (!stageEl) return;

    if (!document.fullscreenElement) {
      await stageEl.requestFullscreen();
      setIsStageFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsStageFullscreen(false);
    }
  };

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsStageFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  return (
    <div className="live-room">
      <div className="live-room__header">
        <div>
          <h2>{sessionTitle}</h2>
          <p>{participantCount} participants connected</p>
        </div>
        {mode === 'mentor' ? (
          <div className="live-room__controls">
            <button type="button" className="live-room__control" onClick={toggleCamera}>
              <HiVideoCamera size={18} />
              {cameraEnabled ? 'Camera On' : 'Camera Off'}
            </button>
            <button type="button" className="live-room__control" onClick={toggleMic}>
              <HiMicrophone size={18} />
              {micEnabled ? 'Mic On' : 'Mic Off'}
            </button>
            <button type="button" className="live-room__control" onClick={toggleScreen}>
              <HiDesktopComputer size={18} />
              {screenEnabled ? 'Stop Share' : 'Share Screen'}
            </button>
            <button type="button" className="live-room__control live-room__control--danger" onClick={onEndClass}>
              <HiPhoneMissedCall size={18} />
              End Class
            </button>
          </div>
        ) : (
          <div className="live-room__badge">Mic & camera join muted for performance</div>
        )}
      </div>

      <div className="live-room__content">
        <section className="live-room__stage">
          <div className="live-room__stage-topbar">
            <div className="live-room__stage-label">{mainStageLabel}</div>
            <button type="button" className="live-room__stage-fullscreen" onClick={toggleStageFullscreen}>
              <HiArrowsExpand size={18} />
              {isStageFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>
          <div className="live-room__stage-video">
            {mainMentorTrack ? (
              <VideoTrack trackRef={mainMentorTrack} />
            ) : (
              <div className="live-room__placeholder live-room__placeholder--card">
                <div className="live-room__fallback-avatar">{fallbackInitial}</div>
                <h3>{fallbackName}</h3>
                {mode === 'mentor' ? (
                  <p>
                    {isScreenShareEnabled
                      ? 'Screen share is starting...'
                      : (isCameraEnabled
                        ? 'Camera is enabled. Waiting for video track...'
                        : 'No camera video is being published. You can still teach with mic and screen share.')}
                  </p>
                ) : (
                  <p>Mentor video is not being published right now. Audio and screen share can still be live.</p>
                )}
                <div className="live-room__fallback-status">
                  <span className={isMicrophoneEnabled ? 'live-room__status-dot live-room__status-dot--on' : 'live-room__status-dot'} />
                  {mode === 'mentor'
                    ? (isMicrophoneEnabled ? 'Microphone active' : 'Microphone muted')
                    : 'Waiting for mentor media'}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="live-room__sidebar">
          {mode === 'mentor' ? (
            <div className="live-room__sidebar-block">
              <h3>Active students</h3>
              <div className="live-room__compact-list">
                {studentParticipants.length ? studentParticipants.map((participant) => (
                  <div key={participant.identity} className={`live-room__compact-item ${participant.isSpeaking ? 'live-room__compact-item--speaking' : ''}`}>
                    <div className="live-room__avatar">{participant.name.charAt(0).toUpperCase()}</div>
                    <span>{participant.name}</span>
                  </div>
                )) : (
                  <div className="live-room__compact-empty">No students have joined this class yet.</div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="live-room__sidebar-block">
                <h3>Active students</h3>
                {featuredStudentTracks.length ? (
                  <div className="live-room__active-grid">
                    {featuredStudentTracks.map((trackRef) => (
                      <div key={`${trackRef.participant.identity}-${trackRef.source}`} className="live-room__active-tile">
                        <VideoTrack trackRef={trackRef} />
                        <span>{trackRef.participant.name || trackRef.participant.identity}</span>
                      </div>
                    ))}
                  </div>
                ) : fallbackActiveStudents.length ? (
                  <div className="live-room__compact-list">
                    {fallbackActiveStudents.map((participant) => (
                      <div key={participant.identity} className={`live-room__compact-item ${participant.isSpeaking ? 'live-room__compact-item--speaking' : ''}`}>
                        <div className="live-room__avatar">{participant.name.charAt(0).toUpperCase()}</div>
                        <span>{participant.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="live-room__compact-empty">No classmates have joined yet.</div>
                )}
              </div>

              <div className="live-room__sidebar-block">
                <h3>Other classmates</h3>
                <div className="live-room__compact-list">
                  {compactParticipants.length ? compactParticipants.map((participant) => (
                    <div key={participant.identity} className={`live-room__compact-item ${participant.isSpeaking ? 'live-room__compact-item--speaking' : ''}`}>
                      <div className="live-room__avatar">{participant.name.charAt(0).toUpperCase()}</div>
                      <span>{participant.name}</span>
                    </div>
                  )) : (
                    <div className="live-room__compact-empty">No additional student tiles are being rendered.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function LiveClassRoom({
  token,
  wsUrl,
  mode,
  connect,
  sessionTitle,
  onDisconnected,
  onError,
  onConnected,
  onEndClass,
}) {
  useEffect(() => {
    setLogLevel(LogLevel.error);
  }, []);

  const roomOptions = useMemo(() => ({
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: {
      simulcast: true,
      videoSimulcastLayers: [180, 360, 720],
      videoCodec: 'vp8',
      videoEncoding: {
        maxBitrate: 1_200_000,
        maxFramerate: 24,
      },
      screenShareEncoding: {
        maxBitrate: 2_000_000,
        maxFramerate: 12,
      },
    },
  }), []);

  return (
    <LiveKitRoom
      token={token}
      serverUrl={wsUrl}
      connect={connect}
      audio={mode === 'mentor'}
      video={mode === 'mentor'}
      options={roomOptions}
      onConnected={onConnected}
      onError={onError}
      onDisconnected={onDisconnected}
      className={`live-room-shell live-room-shell--${mode}`}
    >
      <RoomLayout mode={mode} onEndClass={onEndClass} sessionTitle={sessionTitle} />
    </LiveKitRoom>
  );
}
