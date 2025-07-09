import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../../components/mobile/MobileLayout';
import MobileCameraCapture from '../../components/mobile/MobileCameraCapture';
import { PhotoResult } from '../../services/mobileService';

const MobileCameraPage: React.FC = () => {
  const navigate = useNavigate();
  const [capturedPhotos, setCapturedPhotos] = useState<PhotoResult[]>([]);

  const handlePhotoTaken = (photo: PhotoResult) => {
    setCapturedPhotos(prev => [...prev, photo]);
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <MobileLayout title="Camera" showBackButton>
      <div className="p-3">
        <h4>Camera Test Page</h4>
        <p>This page allows you to test the camera functionality.</p>
        
        {capturedPhotos.length > 0 && (
          <div className="captured-photos mt-4">
            <h5>Captured Photos ({capturedPhotos.length})</h5>
            <div className="photo-grid">
              {capturedPhotos.map((photo, index) => (
                <div key={index} className="photo-thumbnail">
                  <img src={photo.dataUrl} alt={`Captured ${index + 1}`} />
                </div>
              ))}
            </div>
          </div>
        )}
        
        <MobileCameraCapture
          onPhotoTaken={handlePhotoTaken}
          onCancel={handleCancel}
          title="Test Camera"
        />
      </div>
      
      <style>{`
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 0.5rem;
          margin-top: 1rem;
        }
        
        .photo-thumbnail {
          aspect-ratio: 1;
          border-radius: 0.5rem;
          overflow: hidden;
          border: 2px solid var(--bs-border-color);
        }
        
        .photo-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </MobileLayout>
  );
};

export default MobileCameraPage;