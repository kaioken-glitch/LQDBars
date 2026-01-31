import React from 'react'
import { usePlayer } from '../context/PlayerContext'
import logo from '../assets/logo.svg'
import '../App.css'
import { FaHome, FaCompactDisc, FaListUl, FaHeart, FaHistory, FaCog, FaPlay } from 'react-icons/fa'

export default function Sidebar({ active, setActive }) {
    const navItems = [
        { label: 'Home', icon: FaHome },
        { label: 'Library', icon: FaCompactDisc },
        { label: 'Playlists', icon: FaListUl },
        { label: 'Favorites', icon: FaHeart },
        { label: 'Recently Played', icon: FaHistory },
    ];

    const user = { firstName: 'Ava' };
    const { currentSong } = usePlayer();

    return (
        <aside className="sidebar w-[220px] h-[calc(100vh-40px)] rounded-2xl flex flex-col py-6 my-5 ml-5 overflow-hidden relative group">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-teal-900/30 to-slate-900/40 backdrop-blur-2xl" />
            
            {/* Subtle animated gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
            
            {/* Border with gradient */}
            <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none" />
            
            {/* Glow effect on hover */}
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-emerald-500/0 via-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/10 group-hover:via-teal-500/5 group-hover:to-transparent transition-all duration-700 pointer-events-none blur-xl" />

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full">
                {/* Logo Section */}
                <div className="px-6 mb-8">
                    <button 
                        onClick={() => setActive('Home')}
                        className="group/logo transition-transform hover:scale-105 duration-300"
                    >
                        <img 
                            src={logo} 
                            alt="LiquidBars" 
                            className="w-[120px] h-auto drop-shadow-[0_0_20px_rgba(52,211,153,0.3)] group-hover/logo:drop-shadow-[0_0_30px_rgba(52,211,153,0.5)] transition-all duration-300" 
                        />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = active === item.label;
                        
                        return (
                            <button
                                key={item.label}
                                onClick={() => setActive(item.label)}
                                className={`
                                    group/nav relative w-full flex items-center gap-3 py-3 px-4 rounded-xl
                                    text-sm font-medium text-left transition-all duration-300
                                    ${isActive 
                                        ? 'text-white bg-emerald-500/20 shadow-lg shadow-emerald-500/20' 
                                        : 'text-white/70 hover:text-white hover:bg-white/5'
                                    }
                                `}
                            >
                                {/* Active indicator bar */}
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-emerald-400 to-teal-400 rounded-r-full shadow-lg shadow-emerald-500/50" />
                                )}
                                
                                {/* Icon with glow effect when active */}
                                <div className="relative">
                                    <Icon 
                                        className={`
                                            text-lg transition-all duration-300
                                            ${isActive 
                                                ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' 
                                                : 'text-white/60 group-hover/nav:text-white/80'
                                            }
                                        `}
                                    />
                                    {/* Subtle pulse on active */}
                                    {isActive && (
                                        <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-md animate-pulse" />
                                    )}
                                </div>
                                
                                {/* Label */}
                                <span className={`
                                    transition-all duration-300
                                    ${isActive ? 'font-semibold' : 'font-medium'}
                                `}>
                                    {item.label}
                                </span>

                                {/* Hover shine effect */}
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover/nav:opacity-100 transition-opacity duration-500" />
                            </button>
                        );
                    })}
                </nav>

                {/* Now Playing Card */}
                <div className="mx-3 my-4">
                    <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 p-3 group/playing hover:border-emerald-500/30 transition-all duration-300">
                        {currentSong ? (
                            <>
                                {/* Album Art */}
                                <div className="relative mb-3 rounded-lg overflow-hidden">
                                    <img 
                                        src={currentSong.cover} 
                                        alt={currentSong.name || 'cover'} 
                                        className="w-full aspect-square object-cover"
                                    />
                                    {/* Overlay gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    
                                    {/* Play indicator */}
                                    <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/50">
                                        <FaPlay className="text-white text-xs ml-0.5" />
                                    </div>
                                </div>

                                {/* Song Info */}
                                <div className="space-y-1">
                                    <p className="text-white text-xs font-semibold truncate">
                                        {currentSong.name || 'Unknown'}
                                    </p>
                                    <p className="text-white/60 text-[10px] truncate">
                                        {currentSong.artist || 'Unknown Artist'}
                                    </p>
                                </div>

                                {/* Mini equalizer animation */}
                                <div className="flex items-center gap-0.5 mt-2">
                                    <div className="w-0.5 h-2 bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_infinite]" />
                                    <div className="w-0.5 h-3 bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_0.1s_infinite]" />
                                    <div className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_0.2s_infinite]" />
                                    <div className="w-0.5 h-3 bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_0.3s_infinite]" />
                                    <div className="w-0.5 h-2 bg-emerald-400 rounded-full animate-[wave_0.6s_ease-in-out_0.4s_infinite]" />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                    <FaCompactDisc className="text-white/30 text-2xl" />
                                </div>
                                <p className="text-white/40 text-xs text-center">No song playing</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Settings & Profile */}
                <div className="px-3 pt-3 border-t border-white/10">
                    <button
                        onClick={() => setActive('Settings')}
                        className={`
                            group/settings relative w-full flex items-center gap-3 py-3 px-4 rounded-xl
                            text-sm font-medium text-left transition-all duration-300
                            ${active === 'Settings'
                                ? 'text-white bg-emerald-500/20 shadow-lg shadow-emerald-500/20'
                                : 'text-white/70 hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        {/* Active indicator */}
                        {active === 'Settings' && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-emerald-400 to-teal-400 rounded-r-full shadow-lg shadow-emerald-500/50" />
                        )}

                        <FaCog 
                            className={`
                                text-lg transition-all duration-300 group-hover/settings:rotate-90
                                ${active === 'Settings'
                                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                                    : 'text-white/60'
                                }
                            `}
                        />
                        
                        <span>Settings</span>

                        {/* User Avatar */}
                        <div className="ml-auto">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-emerald-500/30 ring-2 ring-white/20 transition-transform group-hover/settings:scale-110 duration-300">
                                {user.firstName[0].toUpperCase()}
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </aside>
    );
}