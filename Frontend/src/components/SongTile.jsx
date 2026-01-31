import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleArrowDown } from '@fortawesome/free-solid-svg-icons';
import { FaStar } from 'react-icons/fa';

export default function SongTile({
  song,
  index,
  isCurrent,
  onPlay,
  onToggleFavorite,
  onToggleDownload,
  dragHandle,
  className = '',
}) {
  return (
    <div
      className={`song-tile flex items-center gap-3 p-2 rounded-md transition ${className}`}
      draggable={!!dragHandle}
    >
      {dragHandle}
      <img
        src={song.cover}
        alt={song.name}
        className="w-14 h-14 rounded-md object-cover flex-shrink-0"
        onClick={onPlay}
        style={{ cursor: 'pointer' }}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate min-w-0">
            <div className={`song-title text-white text-xs truncate ${isCurrent ? 'font-semibold' : ''}`}>
              <div className="marquee-container">
                <span className="marquee-text">{song.name}</span>
              </div>
            </div>
            <div className="text-white/60 text-[11px] truncate mt-0.5">{song.artist}</div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {song.downloaded && (
              <FontAwesomeIcon icon={faCircleArrowDown} className="text-emerald-400" />
            )}
            <button
              type="button"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition ${song.favorite ? 'bg-yellow-400/80' : 'bg-white/10 hover:bg-yellow-400/80'}`}
              title={song.favorite ? 'Favorited' : 'Add to Favorites'}
              onClick={onToggleFavorite}
            >
              <FaStar className={`text-sm ${song.favorite ? 'text-yellow-400' : 'text-white'}`} />
            </button>
            <button
              type="button"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition ${song.downloaded ? 'bg-emerald-500/20' : 'bg-white/10 hover:bg-emerald-500/30'}`}
              title={song.downloaded ? 'Downloaded' : 'Download'}
              onClick={onToggleDownload}
            >
              <FontAwesomeIcon icon={faCircleArrowDown} className={`text-sm ${song.downloaded ? 'text-emerald-400' : 'text-white'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact marquee styles applied locally to keep behavior scoped to this component
const styles = `
.marquee-container{overflow:hidden;white-space:nowrap}
.marquee-text{display:inline-block;padding-right:24px;transform:translateX(0);}
.marquee-container:hover .marquee-text{animation:marquee 7s linear infinite}
@keyframes marquee{0%{transform:translateX(0%)}50%{transform:translateX(-50%)}100%{transform:translateX(0%)}}
`;

// Inject styles once
if (typeof document !== 'undefined' && !document.getElementById('songtile-marquee-styles')) {
  const s = document.createElement('style');
  s.id = 'songtile-marquee-styles';
  s.innerHTML = styles;
  document.head.appendChild(s);
}

