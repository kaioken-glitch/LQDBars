import React from 'react'
import { FaHome, FaCompactDisc, FaListUl, FaHeart, FaCog } from 'react-icons/fa'

export default function BottomNavPremium({ active, setActive }) {
  const navItems = [
    { label: 'Home', icon: FaHome },
    { label: 'Library', icon: FaCompactDisc },
    { label: 'Playlists', icon: FaListUl },
    { label: 'Favorites', icon: FaHeart },
    { label: 'Settings', icon: FaCog },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/90 to-slate-900/70 backdrop-blur-2xl" />
      
      {/* Top border with gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {/* Content */}
      <div className="relative max-w-3xl mx-auto px-3 py-2">
        <div className="flex items-center justify-between">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.label;
            
            return (
              <button
                key={item.label}
                onClick={() => setActive(item.label)}
                className={`
                  relative flex flex-col items-center justify-center gap-1.5 
                  py-2 px-3 rounded-2xl min-w-[64px]
                  transition-all duration-300 ease-out
                  ${isActive 
                    ? 'bg-emerald-500/15' 
                    : 'hover:bg-white/5 active:scale-95'
                  }
                `}
              >
                {/* Glow effect for active item */}
                {isActive && (
                  <>
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-xl" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-full" />
                  </>
                )}
                
                {/* Icon */}
                <div className="relative z-10">
                  <Icon 
                    className={`
                      text-[22px] transition-all duration-300
                      ${isActive 
                        ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]' 
                        : 'text-white/60'
                      }
                    `}
                  />
                </div>
                
                {/* Label */}
                <span 
                  className={`
                    relative z-10 text-[9px] font-semibold tracking-wider uppercase
                    transition-all duration-300
                    ${isActive 
                      ? 'text-emerald-400' 
                      : 'text-white/50'
                    }
                  `}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}