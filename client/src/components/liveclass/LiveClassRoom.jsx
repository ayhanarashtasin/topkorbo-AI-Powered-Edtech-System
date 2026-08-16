import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import {
  HiArrowsExpand,
  HiDesktopComputer,
  HiMicrophone,
  HiPhoneMissedCall,
  HiSpeakerphone,
  HiVideoCamera,
  HiUserGroup,
  HiChatAlt2,
  HiPaperAirplane,
  HiClock,
  HiX,
} from 'react-icons/hi';
import './LiveClassRoom.css';

function formatElapsedSeconds(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function RoomLayout({ mode, onEndClass, sessionTitle }) {
  const room = useRoomContext();
  const studentAudioMountRef = useRef(null);
  const chatBottomRef = useRef(null);
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
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'chat'
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  // Timer interval for live duration
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for LiveKit Data Messages (In-Room Live Chat)
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        if (data && data.type === 'chat_message') {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              senderName: participant?.name || data.senderName || 'Participant',
              senderIdentity: participant?.identity || data.senderIdentity,
              text: data.text,
              time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isSelf: false,
            },
          ]);
          if (!drawerOpen || activeTab !== 'chat') {
            setUnreadChatCount((count) => count + 1);
          }
        }
      } catch (e) {
        console.warn('Error parsing incoming live class message', e);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, drawerOpen, activeTab]);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (activeTab === 'chat' && drawerOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, drawerOpen]);

  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !room?.localParticipant) return;
    const msgText = chatInput.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = {
      type: 'chat_message',
      text: msgText,
      senderName: localParticipant?.name || (mode === 'mentor' ? 'Mentor' : 'Student'),
      senderIdentity: localParticipant?.identity,
      time: timeStr,
    };

    try {
      const encoded = new TextEncoder().encode(JSON.stringify(payload));
      room.localParticipant.publishData(encoded, { reliable: true });
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          senderName: localParticipant?.name || (mode === 'mentor' ? 'Mentor' : 'Student'),
          senderIdentity: localParticipant?.identity,
          text: msgText,
          time: timeStr,
          isSelf: true,
        },
      ]);
      setChatInput('');
    } catch (err) {
      console.error('Failed to send in-room chat message:', err);
    }
  }, [chatInput, localParticipant?.identity, localParticipant?.name, mode, room]);

  const mentorTracks = tracks.filter((trackRef) => trackRef.participant.identity.startsWith('mentor:'));
  const mentorScreenShareTrack = mentorTracks.find((trackRef) => trackRef.source === Track.Source.ScreenShare) || null;
  const mentorCameraTrack = mentorTracks.find((trackRef) => trackRef.source === Track.Source.Camera) || null;
  const mainMentorTrack = mentorScreenShareTrack || mentorCameraTrack;
  const showMentorCameraTile = Boolean(mentorScreenShareTrack && mentorCameraTrack);

  const activeSpeakerIds = new Set((room?.activeSpeakers || []).map((participant) => participant.identity));
  const isMentorSpeaking = activeSpeakerIds.has(
    mode === 'mentor'
      ? localParticipant?.identity
      : participants.find((p) => p.identity.startsWith('mentor:'))?.identity
  );

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
    if (!mainMentorTrack) return 'Waiting for mentor video broadcast';
    return mainMentorTrack.source === Track.Source.ScreenShare ? 'Mentor Screen Presentation' : 'Mentor Video Broadcast';
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
      await stageEl.requestFullscreen().catch(() => {});
      setIsStageFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
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

  // Student Audio listener for Mentor Mode
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
      {/* Glassmorphic Header */}
      <header className="live-room__header">
        <div className="live-room__header-left">
          <span className="live-room__live-tag">
            <span className="live-room__live-pulse" />
            Live Classroom
          </span>
          <div className="live-room__header-titles">
            <h2>{sessionTitle}</h2>
            <div className="live-room__header-meta">
              <span className="live-room__timer">
                <HiClock size={13} />
                {formatElapsedSeconds(elapsedSeconds)}
              </span>
              <span>•</span>
              <span>{participantCount} {participantCount === 1 ? 'member' : 'members'} online</span>
            </div>
          </div>
        </div>

        <div className="live-room__header-right">
          <button
            type="button"
            className={`live-room__header-btn ${drawerOpen && activeTab === 'roster' ? 'live-room__header-btn--active' : ''}`}
            onClick={() => {
              if (drawerOpen && activeTab === 'roster') {
                setDrawerOpen(false);
              } else {
                setDrawerOpen(true);
                setActiveTab('roster');
              }
            }}
          >
            <HiUserGroup size={16} />
            <span>Roster ({participantCount})</span>
          </button>
          <button
            type="button"
            className={`live-room__header-btn ${drawerOpen && activeTab === 'chat' ? 'live-room__header-btn--active' : ''}`}
            onClick={() => {
              if (drawerOpen && activeTab === 'chat') {
                setDrawerOpen(false);
              } else {
                setDrawerOpen(true);
                setActiveTab('chat');
                setUnreadChatCount(0);
              }
            }}
          >
            <HiChatAlt2 size={16} />
            <span>Chat {unreadChatCount > 0 ? `(${unreadChatCount})` : ''}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={`live-room__content ${!drawerOpen ? 'live-room__content--drawer-closed' : ''}`}>
        {/* Cinema Video Stage */}
        <section className="live-room__stage">
          <div className="live-room__stage-topbar">
            <div className="live-room__stage-badge">
              <span className="live-room__stage-badge-dot" />
              {mainStageLabel}
            </div>
            <div className="live-room__stage-actions">
              <button
                type="button"
                className="live-room__stage-action-btn"
                onClick={toggleStageFullscreen}
                aria-label="Toggle Fullscreen"
              >
                <HiArrowsExpand size={15} />
                <span>{isStageFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>
            </div>
          </div>

          <div className="live-room__stage-video">
            {mainMentorTrack ? (
              <>
                <VideoTrack trackRef={mainMentorTrack} />
                {showMentorCameraTile ? (
                  <div className="live-room__mentor-pip">
                    <VideoTrack trackRef={mentorCameraTrack} />
                    <span className="live-room__mentor-pip-label">Mentor Camera</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="live-room__placeholder-card">
                <div className="live-room__avatar-wrapper">
                  <div className="live-room__fallback-avatar">{fallbackInitial}</div>
                  {isMentorSpeaking ? <div className="live-room__speaking-aura" /> : null}
                </div>
                <div className="live-room__placeholder-info">
                  <h3>{fallbackName}</h3>
                  {mode === 'mentor' ? (
                    <p>
                      {isScreenShareEnabled
                        ? 'Screen share is streaming to students.'
                        : (isCameraEnabled
                          ? 'Camera track is loading...'
                          : 'Camera is currently muted. You are broadcasting audio and screen presentation.')}
                    </p>
                  ) : (
                    <p>Mentor camera is not published right now. Live audio and screen sharing are active.</p>
                  )}
                </div>
                <div className="live-room__mic-pill">
                  <span className={`live-room__mic-dot ${(mode === 'mentor' ? isMicrophoneEnabled : isMentorSpeaking) ? 'live-room__mic-dot--active' : ''}`} />
                  <span>
                    {mode === 'mentor'
                      ? (isMicrophoneEnabled ? 'Microphone Active' : 'Microphone Muted')
                      : (isMentorSpeaking ? 'Mentor is speaking' : 'Mentor Microphone Ready')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* In-Room Collapsible Sidebar */}
        {drawerOpen ? (
          <aside className="live-room__sidebar" aria-label="Classroom Sidebar">
            <div className="live-room__tabs">
              <button
                type="button"
                className={`live-room__tab ${activeTab === 'roster' ? 'live-room__tab--active' : ''}`}
                onClick={() => setActiveTab('roster')}
              >
                <HiUserGroup size={15} />
                <span>Participants</span>
                <span className="live-room__tab-badge">{participantCount}</span>
              </button>
              <button
                type="button"
                className={`live-room__tab ${activeTab === 'chat' ? 'live-room__tab--active' : ''}`}
                onClick={() => {
                  setActiveTab('chat');
                  setUnreadChatCount(0);
                }}
              >
                <HiChatAlt2 size={15} />
                <span>Live Chat</span>
                {unreadChatCount > 0 ? (
                  <span className="live-room__tab-badge">{unreadChatCount}</span>
                ) : null}
              </button>
            </div>

            <div className="live-room__drawer-body">
              {activeTab === 'roster' ? (
                <>
                  {/* Featured student camera tiles */}
                  {featuredStudentTracks.length ? (
                    <div className="live-room__participants-grid">
                      {featuredStudentTracks.map((trackRef) => (
                        <div key={`${trackRef.participant.identity}-${trackRef.source}`} className="live-room__student-video-tile">
                          <VideoTrack trackRef={trackRef} />
                          <span>{trackRef.participant.name || trackRef.participant.identity}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Student roster list */}
                  <div className="live-room__roster-list">
                    {/* Mentor entry */}
                    <div className={`live-room__roster-item ${isMentorSpeaking ? 'live-room__roster-item--speaking' : ''}`}>
                      <div className="live-room__roster-avatar">M</div>
                      <div className="live-room__roster-info">
                        <div className="live-room__roster-name">{fallbackName}</div>
                        <div className="live-room__roster-role">Host / Mentor</div>
                      </div>
                      <div className={`live-room__roster-status ${isMentorSpeaking ? 'live-room__roster-status--speaking' : ''}`}>
                        {isMentorSpeaking ? (
                          <div className="live-room__soundwave">
                            <span /><span /><span />
                          </div>
                        ) : (
                          <HiMicrophone size={14} />
                        )}
                      </div>
                    </div>

                    {/* Students list */}
                    {studentsWithoutCamera.length ? (
                      studentsWithoutCamera.map((student) => (
                        <div
                          key={student.identity}
                          className={`live-room__roster-item ${student.isSpeaking ? 'live-room__roster-item--speaking' : ''}`}
                        >
                          <div className="live-room__roster-avatar">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="live-room__roster-info">
                            <div className="live-room__roster-name">{student.name}</div>
                            <div className="live-room__roster-role">Student</div>
                          </div>
                          <div className={`live-room__roster-status ${student.isSpeaking ? 'live-room__roster-status--speaking' : ''}`}>
                            {student.isSpeaking ? (
                              <div className="live-room__soundwave">
                                <span /><span /><span />
                              </div>
                            ) : (
                              student.hasMicrophone ? <HiMicrophone size={14} /> : <span>Muted</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      joinedStudents.length === 0 && (
                        <div className="live-room__chat-empty">
                          No other students connected yet.
                        </div>
                      )
                    )}
                  </div>
                </>
              ) : (
                /* Live In-Room Chat */
                <>
                  <div className="live-room__chat-thread">
                    {chatMessages.length === 0 ? (
                      <div className="live-room__chat-empty">
                        No in-room messages yet. Start a discussion or ask questions!
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`live-room__chat-bubble ${msg.isSelf ? 'live-room__chat-bubble--self' : 'live-room__chat-bubble--other'}`}
                        >
                          {!msg.isSelf && <span className="live-room__chat-sender">{msg.senderName}</span>}
                          <span>{msg.text}</span>
                          <span className="live-room__chat-time">{msg.time}</span>
                        </div>
                      ))
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <form
                    className="live-room__chat-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendChatMessage();
                    }}
                  >
                    <input
                      type="text"
                      className="live-room__chat-input"
                      placeholder="Type a message or question..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="live-room__chat-send-btn"
                      disabled={!chatInput.trim()}
                      aria-label="Send message"
                    >
                      <HiPaperAirplane size={16} />
                    </button>
                  </form>
                </>
              )}
            </div>
          </aside>
        ) : null}
      </div>

      {/* Floating Glassmorphic Control Dock */}
      <nav className="live-room__dock" aria-label="Classroom Controls">
        {mode === 'mentor' ? (
          <>
            <button
              type="button"
              className={`live-room__dock-btn ${cameraEnabled ? 'live-room__dock-btn--active' : 'live-room__dock-btn--off'}`}
              onClick={toggleCamera}
              title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              <HiVideoCamera />
              <span>{cameraEnabled ? 'Cam On' : 'Cam Off'}</span>
            </button>

            <button
              type="button"
              className={`live-room__dock-btn ${micEnabled ? 'live-room__dock-btn--active' : 'live-room__dock-btn--off'}`}
              onClick={toggleMic}
              title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              <HiMicrophone />
              <span>{micEnabled ? 'Mic On' : 'Muted'}</span>
            </button>

            <StartAudio className="live-room__dock-btn" label="Audio" />

            <button
              type="button"
              className="live-room__dock-btn"
              onClick={enableSpeakerAudio}
              title="Ensure incoming student sound is active"
            >
              <HiSpeakerphone />
              <span>Speaker</span>
            </button>

            <button
              type="button"
              className={`live-room__dock-btn ${screenEnabled ? 'live-room__dock-btn--active' : ''}`}
              onClick={toggleScreen}
              title={screenEnabled ? 'Stop Sharing Screen' : 'Share Screen'}
            >
              <HiDesktopComputer />
              <span>{screenEnabled ? 'Sharing' : 'Share'}</span>
            </button>

            <button
              type="button"
              className="live-room__dock-btn live-room__dock-btn--danger"
              onClick={() => setShowConfirmEnd(true)}
              title="End session for all participants"
            >
              <HiPhoneMissedCall />
              <span>End Class</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`live-room__dock-btn ${micEnabled ? 'live-room__dock-btn--active' : 'live-room__dock-btn--off'}`}
              onClick={toggleMic}
              title={micEnabled ? 'Mute Mic' : 'Speak'}
            >
              <HiMicrophone />
              <span>{micEnabled ? 'Mic On' : 'Muted'}</span>
            </button>

            <button
              type="button"
              className="live-room__dock-btn"
              onClick={enableSpeakerAudio}
              title="Enable speaker audio"
            >
              <HiSpeakerphone />
              <span>Speaker</span>
            </button>

            <button
              type="button"
              className="live-room__dock-btn live-room__dock-btn--danger"
              onClick={leaveClass}
              title="Leave this class"
            >
              <HiPhoneMissedCall />
              <span>Leave</span>
            </button>
          </>
        )}
      </nav>

      {/* Confirmation Modal for Ending Class */}
      {showConfirmEnd ? (
        <div className="live-page__modal-backdrop" role="presentation" onClick={() => setShowConfirmEnd(false)}>
          <div
            className="live-page__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-end-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="confirm-end-title" style={{ margin: 0 }}>End Live Session?</h2>
              <button
                type="button"
                onClick={() => setShowConfirmEnd(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                aria-label="Close"
              >
                <HiX size={20} />
              </button>
            </div>
            <p style={{ marginTop: '12px' }}>
              Are you sure you want to end <strong>{sessionTitle}</strong>? All connected students will be disconnected and the session will be marked completed.
            </p>
            <div className="live-page__modal-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmEnd(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary live-page__danger-btn"
                onClick={() => {
                  setShowConfirmEnd(false);
                  onEndClass?.();
                }}
              >
                End Class
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
