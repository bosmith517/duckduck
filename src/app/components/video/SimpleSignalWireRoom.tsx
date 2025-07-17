import React, { useState, useRef } from 'react';
import * as SignalWire from '@signalwire/js';
import { supabase } from '../../../supabaseClient';

const SimpleSignalWireVideo = () => {
  const [roomSession, setRoomSession] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const videoElementRef = useRef<HTMLDivElement>(null);

  const connectToRoom = async () => {
    if (!videoElementRef.current) return;
    
    setIsConnecting(true);
    
    try {
      // Get token from Supabase function
      const { data, error } = await supabase.functions.invoke('generate-signalwire-token', {
        body: { 
          clientIdentity: `user-${Date.now()}`,
          room_name: `test-room-${Date.now()}`
        }
      });

      if (error) throw error;
      if (!data.token) throw new Error('No token received');

      // Create room session exactly like the demo
      const roomSession = new SignalWire.Video.RoomSession({
        token: data.token,
        rootElement: videoElementRef.current,
      });

      roomSession.on('room.joined', () => console.log('You joined the room.'));
      roomSession.on('member.joined', (e) => console.log(`${e.member.name} joined the room.`));
      roomSession.on('member.left', (e) => console.log(`${e.member.name} left the room.`));

      await roomSession.join();
      setRoomSession(roomSession);
      
    } catch (error) {
      console.error('Error connecting to room:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const leaveRoom = async () => {
    if (roomSession) {
      await roomSession.leave();
      setRoomSession(null);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Simple SignalWire Video Test</h2>
      
      {!roomSession && (
        <button 
          onClick={connectToRoom} 
          disabled={isConnecting}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnecting ? 'not-allowed' : 'pointer'
          }}
        >
          {isConnecting ? 'Connecting...' : 'Join Room'}
        </button>
      )}

      {roomSession && (
        <button 
          onClick={leaveRoom}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Leave Room
        </button>
      )}

      <div 
        ref={videoElementRef}
        style={{ 
          width: '100%', 
          height: '400px', 
          backgroundColor: '#000',
          marginTop: '20px',
          borderRadius: '8px'
        }}
      />
    </div>
  );
};

export default SimpleSignalWireVideo;

