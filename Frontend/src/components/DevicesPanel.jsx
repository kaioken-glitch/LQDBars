import React from 'react';
import { FaPlay, FaPause, FaStepBackward, FaStepForward, FaMobileAlt, FaLaptop, FaTimes } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';

const CSS = `
.dv-panel {
  display: flex; flex-direction: column;
  width: 100%; max-width: 320px;
  background: rgba(8,8,14,0.92);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 16px;
  backdrop-filter: blur(28px);
  overflow: hidden;
  font-family: 'DM Sans', sans-serif;
}
.dv-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; color: #fff;
}
.dv-close { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.4); width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
.dv-close:hover { color: #fff; background: rgba(255,255,255,0.08); }
.dv-list { display: flex; flex-direction: column; max-height: 320px; overflow-y: auto; padding: 6px; }
.dv-empty { padding: 22px 18px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6; }
.dv-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px; border-radius: 12px;
}
.dv-item.self { background: rgba(29,185,84,0.06); }
.dv-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.5); font-size: 13px;
}
.dv-item.self .dv-icon { color: #1DB954; background: rgba(29,185,84,0.14); }
.dv-meta { flex: 1; min-width: 0; }
.dv-label { font-size: 12.5px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dv-song { font-size: 11px; color: rgba(255,255,255,0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.dv-controls { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.dv-btn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.6); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
.dv-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }
.dv-btn.play { color: #1DB954; }
`;

function DeviceRow({ device, onTransport }) {
  const isMobile = /iOS|Android/i.test(device.label || '');
  return (
    <div className={`dv-item${device.isSelf ? ' self' : ''}`}>
      <div className="dv-icon">{isMobile ? <FaMobileAlt /> : <FaLaptop />}</div>
      <div className="dv-meta">
        <p className="dv-label">{device.label}{device.isSelf ? ' · This device' : ''}</p>
        <p className="dv-song">{device.song ? `${device.song.name} · ${device.song.artist || ''}` : 'Nothing playing'}</p>
      </div>
      <div className="dv-controls">
        <button className="dv-btn" onClick={() => onTransport('prev')} aria-label="Previous">
          <FaStepBackward style={{ fontSize: 10 }} />
        </button>
        <button className="dv-btn play" onClick={() => onTransport('toggle')} aria-label={device.isPlaying ? 'Pause' : 'Play'}>
          {device.isPlaying ? <FaPause style={{ fontSize: 11 }} /> : <FaPlay style={{ fontSize: 11, marginLeft: 1 }} />}
        </button>
        <button className="dv-btn" onClick={() => onTransport('next')} aria-label="Next">
          <FaStepForward style={{ fontSize: 10 }} />
        </button>
      </div>
    </div>
  );
}

export default function DevicesPanel({ onClose }) {
  const { devices, controlDevice, setIsPlaying, playNext, playPrev } = usePlayer();

  const handleTransport = (device, action) => {
    if (device.isSelf) {
      if (action === 'toggle') setIsPlaying(p => !p);
      else if (action === 'next') playNext();
      else if (action === 'prev') playPrev();
    } else {
      controlDevice(device.id, action);
    }
  };

  return (
    <div className="dv-panel">
      <style>{CSS}</style>
      <div className="dv-header">
        <span>Devices</span>
        <button className="dv-close" onClick={onClose} aria-label="Close"><FaTimes style={{ fontSize: 11 }} /></button>
      </div>
      {devices.length === 0 ? (
        <div className="dv-empty">
          No devices online.<br />
          Turn on "Remote control" in Settings on this and other signed-in devices to control playback between them.
        </div>
      ) : (
        <div className="dv-list">
          {devices.map(d => (
            <DeviceRow key={d.id} device={d} onTransport={(action) => handleTransport(d, action)} />
          ))}
        </div>
      )}
    </div>
  );
}