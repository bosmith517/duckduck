import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { showToast } from '../../utils/toast';
import * as SignalWire from '@signalwire/js';
import { User } from '@supabase/supabase-js';

const SignalWireVideo = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roomSession, setRoomSession] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showPreJoin, setShowPreJoin] = useState(false);
    const [roomName, setRoomName] = useState<string | null>(null);
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [hasAudio, setHasAudio] = useState(false);
    const [hasVideo, setHasVideo] = useState(false);
    const [eventLog, setEventLog] = useState<string[]>([]);
    const mediaContainerRef = useRef<HTMLDivElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (roomSession) {
                try {
                    // Only try to leave if the room session is in a valid state
                    if (roomSession.state === 'connected' || roomSession.state === 'joined') {
                        roomSession.leave();
                    }
                } catch (error) {
                    console.log('Room session cleanup error (safe to ignore):', error);
                }
            }
            if (previewStream) {
                previewStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [roomSession, previewStream]);

    const logEvent = (message: string) => {
        console.log(`[SignalWire Event] ${message}`);
        setEventLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const handleCreateMeeting = async () => {
        setIsLoading(true);
        setError(null);
        setRoomSession(null);
        setEventLog([]);
        
        try {
            const { data, error: functionError } = await supabase.functions.invoke('create-signalwire-video-room', { 
                body: { jobId: null } 
            });
            
            if (functionError) throw new Error(functionError.message);
            if (data.error) throw new Error(data.error);
            
            if (data.roomName) {
                setRoomName(data.roomName);
                logEvent(`Room created: ${data.roomName}`);
                await setupPreJoinScreen();
            } else {
                throw new Error('Could not retrieve room name from server.');
            }
        } catch (err: any) {
            console.error('Error creating meeting:', err);
            setError(err.message || 'An unknown error occurred.');
            setIsLoading(false);
        }
    };

    const setupPreJoinScreen = async () => {
        try {
            const finalStream = new MediaStream();
            
            // Try to get audio
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioStream.getTracks().forEach(track => finalStream.addTrack(track));
                setHasAudio(true);
                logEvent('Audio device acquired');
            } catch (error) { 
                setHasAudio(false); 
                setAudioEnabled(false);
                logEvent('No audio device available');
            }
            
            // Try to get video
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoStream.getTracks().forEach(track => finalStream.addTrack(track));
                setHasVideo(true);
                if (previewVideoRef.current) { 
                    previewVideoRef.current.srcObject = videoStream; 
                }
                logEvent('Video device acquired');
            } catch (error) { 
                setHasVideo(false); 
                setVideoEnabled(false);
                logEvent('No video device available');
            }
            
            setPreviewStream(finalStream);
            setShowPreJoin(true);
            setIsLoading(false);
        } catch (err: any) {
            console.error('Error setting up pre-join screen:', err);
            setError(err.message || 'Could not access media devices.');
            setIsLoading(false);
        }
    };

    const joinRoom = async () => {
        if (!currentUser || !roomName) {
            showToast.error("Cannot join room: User or Room Name is missing.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            // Get token from backend
            logEvent('Requesting video token...');
            const { data, error: tokenError } = await supabase.functions.invoke('generate-signalwire-token', { 
                body: { 
                    clientIdentity: `video-user-${currentUser.id.substring(0, 8)}`, 
                    room_name: roomName 
                } 
            });
            
            if (tokenError) throw new Error(`Failed to get video token: ${tokenError.message}`);
            
            const token = data.token;
            if (!token) throw new Error("Received an empty token from server.");
            
            logEvent('Token received, creating room session...');
            
            // Create room session with appropriate media constraints
            const roomSessionConfig: any = {
                token,
                rootElement: mediaContainerRef.current!,
            };

            // Only add media constraints if we have devices available
            if (hasAudio || hasVideo) {
                roomSessionConfig.audio = hasAudio && audioEnabled;
                roomSessionConfig.video = hasVideo && videoEnabled;
            } else {
                // Audio-only mode if no video device
                roomSessionConfig.audio = true;
                roomSessionConfig.video = false;
            }

            const roomSession = new SignalWire.Video.RoomSession(roomSessionConfig);

            roomSession.on('room.joined', () => logEvent('You joined the room.'));
            roomSession.on('member.joined', (e) => logEvent(`${e.member.name} joined the room.`));
            roomSession.on('member.left', (e) => logEvent(`${e.member.name} left the room.`));

            await roomSession.join();

            setRoomSession(roomSession);
            setShowPreJoin(false);
            
            // Clean up preview stream
            if (previewStream) { 
                previewStream.getTracks().forEach(track => track.stop()); 
                setPreviewStream(null);
            }
            
        } catch (err: any) {
            console.error('Error joining room:', err);
            logEvent(`Error: ${err.message}`);
            setError(err.message || 'Could not join video session.');
            setIsLoading(false);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleAudio = () => { 
        if (hasAudio) { 
            setAudioEnabled(!audioEnabled);
            if (previewStream) {
                previewStream.getAudioTracks().forEach(track => {
                    track.enabled = !audioEnabled;
                });
            }
        } 
    };
    
    const toggleVideo = () => { 
        if (hasVideo) { 
            setVideoEnabled(!videoEnabled);
            if (previewStream) {
                previewStream.getVideoTracks().forEach(track => {
                    track.enabled = !videoEnabled;
                });
            }
        } 
    };
    
    const cancelPreJoin = () => {
        setShowPreJoin(false);
        setRoomName(null);
        if (previewStream) { 
            previewStream.getTracks().forEach(track => track.stop()); 
            setPreviewStream(null);
        }
    };
    
    const handleLeaveMeeting = async () => { 
        if (roomSession) { 
            logEvent('Leaving room...');
            await roomSession.leave(); 
            setRoomSession(null);
            setEventLog([]);
        } 
    };

    return (
        <div style={{ padding: '2rem', background: '#fff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                <h2 style={{margin: 0}}>Video Meeting</h2>
                {!roomSession && !showPreJoin && ( 
                    <button onClick={handleCreateMeeting} disabled={isLoading} className="btn btn-primary">
                        {isLoading ? 'Creating...' : '➕ Create & Join Meeting'}
                    </button> 
                )}
                {roomSession && ( 
                    <button onClick={handleLeaveMeeting} className="btn btn-danger">
                        Leave Meeting
                    </button> 
                )}
            </div>
            
            {error && <div className="alert alert-danger">{error}</div>}
            
            {/* Event Log (for debugging) */}
            {eventLog.length > 0 && (
                <div className="alert alert-info mb-3" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <h6>Event Log:</h6>
                    {eventLog.map((log, index) => (
                        <div key={index} style={{ fontSize: '0.85rem' }}>{log}</div>
                    ))}
                </div>
            )}
            
            {showPreJoin && (
                <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '2rem', border: '1px solid #dee2e6' }}>
                    <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Ready to join the meeting?</h3>
                    <div className="row">
                        <div className="col-md-8">
                            <div style={{ position: 'relative', background: '#2c2c2c', borderRadius: '8px', overflow: 'hidden', minHeight: '300px' }}>
                                {hasVideo && videoEnabled ? ( 
                                    <video ref={previewVideoRef} autoPlay muted style={{ width: '100%', height: '300px', objectFit: 'cover' }} /> 
                                ) : ( 
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#fff', flexDirection: 'column' }}>
                                        <i className="ki-duotone ki-user fs-3x mb-3">
                                            <span className="path1"></span>
                                            <span className="path2"></span>
                                        </i>
                                        <span>{!hasVideo ? 'No camera detected' : 'Camera is off'}</span>
                                    </div> 
                                )}
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="d-flex flex-column gap-3">
                                <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded border">
                                    <div className="d-flex align-items-center">
                                        <i className={`ki-duotone ${audioEnabled ? 'ki-microphone-2' : 'ki-microphone-2-slash'} fs-2 me-3 ${audioEnabled ? 'text-success' : 'text-danger'}`}>
                                            <span className="path1"></span>
                                            <span className="path2"></span>
                                        </i>
                                        <div>
                                            <div className="fw-bold">Microphone</div>
                                            <div className="text-muted fs-7">{!hasAudio ? 'Not detected' : audioEnabled ? 'On' : 'Off'}</div>
                                        </div>
                                    </div>
                                    <button className={`btn btn-sm ${audioEnabled ? 'btn-success' : 'btn-light-danger'}`} onClick={toggleAudio} disabled={!hasAudio}>
                                        {audioEnabled ? 'Mute' : 'Unmute'}
                                    </button>
                                </div>
                                <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded border">
                                    <div className="d-flex align-items-center">
                                        <i className={`ki-duotone ${videoEnabled ? 'ki-video' : 'ki-video-slash'} fs-2 me-3 ${videoEnabled ? 'text-success' : 'text-danger'}`}>
                                            <span className="path1"></span>
                                            <span className="path2"></span>
                                        </i>
                                        <div>
                                            <div className="fw-bold">Camera</div>
                                            <div className="text-muted fs-7">{!hasVideo ? 'Not detected' : videoEnabled ? 'On' : 'Off'}</div>
                                        </div>
                                    </div>
                                    <button className={`btn btn-sm ${videoEnabled ? 'btn-success' : 'btn-light-danger'}`} onClick={toggleVideo} disabled={!hasVideo}>
                                        {videoEnabled ? 'Turn Off' : 'Turn On'}
                                    </button>
                                </div>
                                <div className="d-flex flex-column gap-2 mt-3">
                                    <button className="btn btn-primary btn-lg" onClick={joinRoom} disabled={isLoading}>
                                        {isLoading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Joining...
                                            </>
                                        ) : (
                                            <>
                                                <i className="ki-duotone ki-entrance-right fs-2 me-2">
                                                    <span className="path1"></span>
                                                    <span className="path2"></span>
                                                </i>
                                                Join Now
                                            </>
                                        )}
                                    </button>
                                    <button className="btn btn-light btn-sm" onClick={cancelPreJoin} disabled={isLoading}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <div ref={mediaContainerRef} style={{ 
                width: '100%', 
                minHeight: '70vh', 
                background: '#2c2c2c', 
                borderRadius: '8px', 
                border: '1px solid #ddd', 
                display: roomSession ? 'block' : 'none', 
                overflow: 'hidden' 
            }} />
            
            {!roomSession && !showPreJoin && !isLoading && ( 
                <div style={{ textAlign: 'center', padding: '4rem', border: '2px dashed #ccc', borderRadius: '8px', background: '#f9f9f9' }}>
                    <h3>No Active Meeting</h3>
                    <p>Click "Create & Join Meeting" to start a video call.</p>
                </div> 
            )}
        </div>
    );
};

export default SignalWireVideo;
