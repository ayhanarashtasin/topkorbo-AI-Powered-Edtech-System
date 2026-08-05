import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LiveKitRoom,
  useLocalParticipant,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { LogLevel, RoomEvent, Track, setLogLevel } from 'livekit-client';
import { HiArrowsExpand, HiDesktopComputer, HiMicrophone, HiPhoneMissedCall, HiSpeakerphone, HiVideoCamera } from 'react-icons/hi';
import './LiveClassRoom.css';

function RoomLayout({ mode, onEndClass, sessionTitle }) {
  const room = useRoomContext();
  const studentAudioMountRef = useRef(null);
  const participants = useParticipants();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const tracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
    { source: Track.Source.Camera, withPlaceholder: false },
  ]);
  const [cameraEnabled, setCameraEnabled] = useState(mode === 'mentor');
  const [micEnabled, setMicEnabled] = useState(mode === 'mentor');
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);

  const mentorTracks = tracks.filter((trackRef) => trackRef.participant.identity.startsWith('mentor:'));
  const mainMentorTrack = mentorTracks.find((trackRef) => trackRef.source === Track.Source.ScreenShare)
    || mentorTracks.find((trackRef) => trackRef.source === Track.Source.Camera)
    || null;

  const activeSpeakerIds = new Set((room?.activeSpeakers || []).map((participant) => participant.identity));
  const joinedStudents = participants
    .filter((participant) => (
      participant.identity.startsWith('student:')
      && participant.identity !== localParticipant?.identity
    ))
    .map((participant) => ({
      identity: participant.identity,
      name: participant.name || participant.identity,
      isSpeaking: participant.isSpeaking || activeSpeakerIds.has(participant.identity),
      hasMicrophone: Array.from(participant.audioTrackPublications?.values?.() || [])
        .some((publication) => publication.source === Track.Source.Microphone && !publication.isMuted),
    }));
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

  const studentsWithoutCamera = joinedStudents.filter((student) => (
    !featuredStudentTracks.some((trackRef) => trackRef.participant.identity === student.identity)
  ));

  const participantCount = participants.length;
  const mentorIdentity = mode === 'mentor'
    ? localParticipant?.identity
    : participants.find((participant) => participant.identity.startsWith('mentor:'))?.identity;

  const mainStageLabel = useMemo(() => {
    if (!mainMentorTrack) return 'Waiting for mentor video';
    return mainMentorTrack.source === Track.Source.ScreenShare ? 'Mentor screen share' : 'Mentor camera';
  }, [mainMentorTrack]);

  const fallbackName = useMemo(() => {
    if (mode === 'mentor') return localParticipant?.name || 'Mentor';
    return participants.find((participant) => participant.identity === mentorIdentity)?.name || 'Mentor';
  }, [localParticipant?.name, mentorIdentity, mode, participants]);

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

  const enableSpeakerAudio = async () => {
    await room?.startAudio();
  };

  const leaveClass = async () => {
    await room?.disconnect();
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

  useEffect(() => {
    if (mode !== 'mentor') return;

    const attachedAudio = new Map();

    const isStudentAudioPublication = (publication, participant) => (
      publication
      && !participant?.isLocal
      && participant?.identity?.startsWith('student:')
      && (publication.source === Track.Source.Microphone || publication.kind === Track.Kind.Audio)
    );

    const playAudioElement = async (element) => {
      if (!element) return;
      element.muted = false;
      element.volume = 1;
      try {
        await element.play();
      } catch {
        room.startAudio().catch(() => {});
      }
    };

    const attachStudentAudio = (track, publication, participant) => {
      if (!track || !isStudentAudioPublication(publication, participant)) return;
      const mount = studentAudioMountRef.current;
      if (!mount) return;

      const key = publication.trackSid || track.sid || participant.identity;
      if (attachedAudio.has(key)) {
        playAudioElement(attachedAudio.get(key).element);
        return;
      }

      const element = track.attach();
      element.autoplay = true;
      element.controls = false;
      element.muted = false;
      element.playsInline = true;
      element.dataset.studentAudio = participant.identity;
      mount.appendChild(element);
      attachedAudio.set(key, { element, track });
      playAudioElement(element);
    };

    const subscribeToStudentAudio = (publication, participant) => {
      if (!publication || participant?.isLocal) return;
      if (!participant?.identity?.startsWith('student:')) return;
      if (publication.source === Track.Source.Microphone || publication.kind === Track.Kind.Audio) {
        publication.setSubscribed?.(true);
        attachStudentAudio(publication.track, publication, participant);
      }
    };

    room.remoteParticipants?.forEach((participant) => {
      participant.audioTrackPublications?.forEach((publication) => {
        subscribeToStudentAudio(publication, participant);
      });
    });

    const handleTrackPublished = (publication, participant) => {
      subscribeToStudentAudio(publication, participant);
    };

    const handleTrackSubscribed = (track, publication, participant) => {
      subscribeToStudentAudio(publication, participant);
      if (track?.kind === Track.Kind.Audio) {
        attachStudentAudio(track, publication, participant);
      }
    };

    const handleTrackUnsubscribed = (track, publication) => {
      const key = publication?.trackSid || track?.sid;
      const attached = key ? attachedAudio.get(key) : null;
      if (!attached) return;
      attached.track.detach(attached.element);
      attached.element.remove();
      attachedAudio.delete(key);
    };

    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    return () => {
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      attachedAudio.forEach(({ element, track }) => {
        track.detach(element);
        element.remove();
      });
      attachedAudio.clear();
    };
  }, [mode, room]);

  return (
    <div className="live-room">
      <div className="live-room__header">
        <div>
          <h2>{sessionTitle}</h2>
          <p>{participantCount} participants connected</p>
        </div>
        <div className="live-room__controls">
          {mode === 'mentor' ? (
            <>
              <button type="button" className="live-room__control" onClick={toggleCamera}>
                <HiVideoCamera size={18} />
                {cameraEnabled ? 'Camera On' : 'Camera Off'}
              </button>
              <button type="button" className="live-room__control" onClick={toggleMic}>
                <HiMicrophone size={18} />
                {micEnabled ? 'Mic On' : 'Mic Off'}
              </button>
              <StartAudio className="live-room__control live-room__control--audio" label="Allow Audio" />
              <button type="button" className="live-room__control" onClick={enableSpeakerAudio}>
                <HiSpeakerphone size={18} />
                Speaker On
              </button>
              <button type="button" className="live-room__control" onClick={toggleScreen}>
                <HiDesktopComputer size={18} />
                {screenEnabled ? 'Stop Share' : 'Share Screen'}
              </button>
              <button type="button" className="live-room__control live-room__control--danger" onClick={onEndClass}>
                <HiPhoneMissedCall size={18} />
                End Class
              </button>
            </>
          ) : (
            <>
              <button type="button" className="live-room__control" onClick={toggleMic}>
                <HiMicrophone size={18} />
                {micEnabled ? 'Mute Mic' : 'Talk'}
              </button>
              <button type="button" className="live-room__control live-room__control--danger" onClick={leaveClass}>
                <HiPhoneMissedCall size={18} />
                Leave Class
              </button>
            </>
          )}
        </div>
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
            ) : null}
            <div className="live-room__compact-list">
              {studentsWithoutCamera.length ? studentsWithoutCamera.map((student) => (
                <div key={student.identity} className={`live-room__compact-item ${student.isSpeaking ? 'live-room__compact-item--speaking' : ''}`}>
                  <div className="live-room__avatar">{student.name.charAt(0).toUpperCase()}</div>
                  <span>{student.name}</span>
                  <span className={student.hasMicrophone ? 'live-room__mic-state live-room__mic-state--on' : 'live-room__mic-state'}>
                    {student.hasMicrophone ? 'Mic on' : 'Muted'}
                  </span>
                </div>
              )) : (
                <div className="live-room__compact-empty">No students have joined yet.</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {mode === 'student' ? <RoomAudioRenderer /> : null}
      <div ref={studentAudioMountRef} className="live-room__student-audio" />
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
      connectOptions={{ autoSubscribe: true }}
      onConnected={onConnected}
      onError={onError}
      onDisconnected={onDisconnected}
      className={`live-room-shell live-room-shell--${mode}`}
    >
      <RoomLayout mode={mode} onEndClass={onEndClass} sessionTitle={sessionTitle} />
    </LiveKitRoom>
  );
}
