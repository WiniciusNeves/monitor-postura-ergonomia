import type { RefObject } from 'react';

interface VideoCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function VideoCanvas({ videoRef, canvasRef }: VideoCanvasProps) {
  return (
    <div className="video-canvas">
      <video ref={videoRef} className="video-canvas__video" playsInline muted />
      <canvas ref={canvasRef} className="video-canvas__canvas" width={640} height={480} />
    </div>
  );
}
