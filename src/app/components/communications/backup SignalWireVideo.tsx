// src/app/components/communications/SignalWireVideo.tsx

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient'; // Make sure this path is correct
import { showToast } from '../../utils/toast'; // Make sure this path is correct

// Correctly import the entire SDK under a namespace
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
    const mediaContainerRef = useRef<HTMLDivElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);

    // Get the current user when the component mounts
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, []);

    // Function to create the meeting room and show pre-join screen
    const handleCreateMeeting = async () => {
        setIsLoading(true);
        setError(null);
        setRoomSession(null);

        try {
            // Call the new Edge Function to create the room on SignalWire's side
            // and log it in our database.
            const { data, error: functionError } = await supabase.functions.invoke('create-signalwire-video-room', {
                body: { jobId: null }, // You can pass a job_id here if needed
            });

            if (functionError) throw new Error(functionError.message);
            if (data.error) throw new Error(data.error);

            if (data.roomName) {
                setRoomName(data.roomName);
                // Show pre-join screen instead of immediately joining
                await setupPreJoinScreen();
            } else {
                throw new Error('Could not retrieve room name from function.');
            }
        } catch (err: any) {
            console.error('Error creating meeting:', err);
            setError(err.message || 'An unknown error occurred.');
            setIsLoading(false);
        }
    };

    // Function to set up the pre-join screen with device detection
    const setupPreJoinScreen = async () => {
        try {
            console.log("Starting device acquisition...");
            
            let audioStream = null;
            let videoStream = null;
            let finalStream = new MediaStream();

            // 1. Try to get Audio first
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioStream.getTracks().forEach(track => finalStream.addTrack(track));
                setHasAudio(true);
                console.log("Audio device acquired successfully.");
            } catch (error: any) {
                console.warn("Could not acquire audio device. User may not have a microphone.", error.name);
                setHasAudio(false);
                setAudioEnabled(false);
            }

            // 2. Try to get Video next
            try {
                videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoStream.getTracks().forEach(track => finalStream.addTrack(track));
                setHasVideo(true);
                console.log("Video device acquired successfully.");
                
                // Show video preview
                if (previewVideoRef.current) {
                    previewVideoRef.current.srcObject = videoStream;
                }
            } catch (error: any) {
                console.warn("Could not acquire video device. User may not have a camera.", error.name);
                setHasVideo(false);
                setVideoEnabled(false);
            }

            // 3. Check if we acquired ANY device
            if (finalStream.getTracks().length === 0) {
                console.log("No media devices were acquired. User will join as an observer.");
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

    // Function to join the room with robust device acquisition
    const joinRoom = async () => {
        if (!currentUser || !roomName) {
            showToast.error("User or room not available to join.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log("Starting robust device acquisition for room join...");
            
            let audioStream = null;
            let videoStream = null;
            let finalStream = new MediaStream();

            // 1. Try to get Audio first (if enabled)
            if (audioEnabled && hasAudio) {
                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioStream.getTracks().forEach(track => finalStream.addTrack(track));
                    console.log("Audio device acquired successfully for room join.");
                } catch (error: any) {
                    console.warn("Could not acquire audio device for room join.", error.name);
                }
            }

            // 2. Try to get Video next (if enabled)
            if (videoEnabled && hasVideo) {
                try {
                    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    videoStream.getTracks().forEach(track => finalStream.addTrack(track));
                    console.log("Video device acquired successfully for room join.");
                } catch (error: any) {
                    console.warn("Could not acquire video device for room join.", error.name);
                }
            }

            // 3. Check if we acquired ANY device or if user is joining as observer
            if (finalStream.getTracks().length === 0) {
                console.log("No media devices were acquired. User joining as an observer.");
            }

            // 4. Get SignalWire token
            const { data, error: tokenError } = await supabase.functions.invoke('generate-signalwire-token', {
                body: { 
                    clientIdentity: `video-user-${currentUser.id.substring(0, 8)}`,
                    room_name: roomName
                },
            });

            if (tokenError) {
                throw new Error(`Failed to get video token: ${tokenError.message}`);
            }

            const token = data.token;

            // 5. Create the room session with the acquired stream
            const newRoomSession = new SignalWire.Video.RoomSession({
                token: data.token,
                rootElement: mediaContainerRef.current!,
                // Pass the stream we built. If it's empty, the user joins as a viewer.
                localStream: finalStream.getTracks().length > 0 ? finalStream : undefined
            });

            // 6. Join the room
            await newRoomSession.join();
            
            setRoomSession(newRoomSession);
            setShowPreJoin(false);
            
            // Clean up preview stream
            if (previewStream) {
                previewStream.getTracks().forEach(track => track.stop());
                setPreviewStream(null);
            }
            
            console.log("Successfully joined the video room!");

        } catch (err: any) {
             console.error('Error joining room:', err);
             setError(err.message || 'Could not join video session.');
        } finally {
            setIsLoading(false);
        }
    };

    // Function to toggle audio/video before joining
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

    // Function to cancel pre-join and go back
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
            await roomSession.leave();
        }
        setRoomSession(null);
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

            {/* Pre-Join Screen */}
            {showPreJoin && (
                <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '2rem', border: '1px solid #dee2e6' }}>
                    <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Ready to join the meeting?</h3>
                    
                    <div className="row">
                        {/* Video Preview */}
                        <div className="col-md-8">
                            <div style={{ position: 'relative', background: '#2c2c2c', borderRadius: '8px', overflow: 'hidden', minHeight: '300px' }}>
                                {hasVideo && videoEnabled ? (
                                    <video
                                        ref={previewVideoRef}
                                        autoPlay
                                        muted
                                        style={{ width: '100%', height: '300px', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        height: '300px',
                                        color: '#fff',
                                        flexDirection: 'column'
                                    }}>
                                        <i className="ki-duotone ki-user fs-3x mb-3">
                                            <span className="path1"></span>
                                            <span className="path2"></span>
                                        </i>
                                        <span>{!hasVideo ? 'No camera detected' : 'Camera is off'}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="col-md-4">
                            <div className="d-flex flex-column gap-3">
                                {/* Audio Control */}
                                <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded border">
                                    <div className="d-flex align-items-center">
                                        <i className={`ki-duotone ${audioEnabled ? 'ki-microphone-2' : 'ki-microphone-2-slash'} fs-2 me-3 ${audioEnabled ? 'text-success' : 'text-danger'}`}>
                                            <span className="path1"></span>
                                            <span className="path2"></span>
                                        </i>
                                        <div>
                                            <div className="fw-bold">Microphone</div>
                                            <div className="text-muted fs-7">
                                                {!hasAudio ? 'Not detected' : audioEnabled ? 'On' : 'Off'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className={`btn btn-sm ${audioEnabled ? 'btn-success' : 'btn-light-danger'}`}
                                        onClick={toggleAudio}
                                        disabled={!hasAudio}
                                    >
                                        {audioEnabled ? 'Mute' : 'Unmute'}
                                    </button>
                                </div>

                                {/* Video Control */}
                                <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded border">
                                    <div className="d-flex align-items-center">
                                        <i className={`ki-duotone ${videoEnabled ? 'ki-video' : 'ki-video-slash'} fs-2 me-3 ${videoEnabled ? 'text-success' : 'text-danger'}`}>
                                            <span className="path1"></span>
                                            <span className="path2"></span>
                                        </i>
                                        <div>
                                            <div className="fw-bold">Camera</div>
                                            <div className="text-muted fs-7">
                                                {!hasVideo ? 'Not detected' : videoEnabled ? 'On' : 'Off'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className={`btn btn-sm ${videoEnabled ? 'btn-success' : 'btn-light-danger'}`}
                                        onClick={toggleVideo}
                                        disabled={!hasVideo}
                                    >
                                        {videoEnabled ? 'Turn Off' : 'Turn On'}
                                    </button>
                                </div>

                                {/* Observer Mode Info */}
                                {!hasAudio && !hasVideo && (
                                    <div className="alert alert-info">
                                        <i className="ki-duotone ki-information fs-2 me-2">
                                            <span className="path1"></span>
                                            <span className="path2"></span>
                                            <span className="path3"></span>
                                        </i>
                                        You'll join as an observer (view-only mode)
                                    </div>
                                )}

                                {/* Join Buttons */}
                                <div className="d-flex flex-column gap-2 mt-3">
                                    <button
                                        className="btn btn-primary btn-lg"
                                        onClick={joinRoom}
                                        disabled={isLoading}
                                    >
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
                                    <button
                                        className="btn btn-light btn-sm"
                                        onClick={cancelPreJoin}
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Meeting View */}
            <div 
                ref={mediaContainerRef} 
                style={{ 
                    width: '100%', 
                    minHeight: '70vh', 
                    background: '#2c2c2c', 
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    display: roomSession ? 'block' : 'none',
                    overflow: 'hidden'
                }}
            />

            {/* Default State */}
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
