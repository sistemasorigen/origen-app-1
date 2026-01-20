
import React from 'react';
import { useAudio } from '../contexts/AudioContext';
import { 
    Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, 
    Volume2, VolumeX, Heart
} from 'lucide-react';

const formatTime = (time: number) => {
    if(isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const GlobalPlayer: React.FC = () => {
    const { 
        currentSong, isPlaying, progress, duration, volume, isMuted, isShuffle, repeatMode,
        togglePlay, nextSong, prevSong, seek, setVolume, toggleMute, toggleShuffle, toggleRepeat
    } = useAudio();

    // Don't render if no song has been selected yet
    if (!currentSong) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 h-24 bg-white border-t border-neutral-100 z-[60] transition-transform duration-300 translate-y-0 animate-slideIn">
            <div className="h-full px-6 md:px-12 grid grid-cols-3 items-center max-w-[1920px] mx-auto">
                
                {/* Song Info */}
                <div className="flex items-center gap-6">
                    {/* Sharp Artwork */}
                    <div className="w-14 h-14 overflow-hidden relative border border-neutral-200 flex-shrink-0 bg-neutral-50">
                        <img 
                            src={currentSong.coverUrl} 
                            className={`w-full h-full object-cover ${isPlaying ? 'opacity-100' : 'opacity-90 grayscale'}`} 
                            alt={currentSong.title}
                        />
                    </div>
                    <div className="hidden sm:block overflow-hidden">
                        <h4 className="font-bold text-sm text-black uppercase tracking-tight truncate max-w-[200px]">{currentSong.title}</h4>
                        <p className="text-xs text-neutral-500 uppercase tracking-wider truncate max-w-[200px]">{currentSong.artist}</p>
                    </div>
                    <button className="text-neutral-400 hover:text-black ml-2 hidden md:block transition-colors">
                        <Heart className="w-4 h-4" />
                    </button>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center gap-8">
                        <button 
                            onClick={toggleShuffle}
                            className={`text-neutral-400 hover:text-black transition-colors hidden md:block ${isShuffle ? 'text-black' : ''}`}
                        >
                            <Shuffle className="w-4 h-4" />
                        </button>

                        <button onClick={prevSong} className="text-black hover:opacity-60 transition-opacity">
                            <SkipBack className="w-5 h-5 fill-current" />
                        </button>
                        
                        {/* Play Button - Solid Black Circle as requested */}
                        <button 
                            onClick={togglePlay}
                            className="w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 transition-transform bg-black text-white"
                        >
                            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                        </button>
                        
                        <button onClick={nextSong} className="text-black hover:opacity-60 transition-opacity">
                            <SkipForward className="w-5 h-5 fill-current" />
                        </button>

                        <button 
                            onClick={toggleRepeat}
                            className={`text-neutral-400 hover:text-black transition-colors hidden md:block ${repeatMode !== 'NONE' ? 'text-black' : ''}`}
                            title={`Repetir: ${repeatMode === 'ONE' ? 'Una' : repeatMode === 'ALL' ? 'Todas' : 'No'}`}
                        >
                            <Repeat className="w-4 h-4" />
                            {repeatMode === 'ONE' && <span className="absolute text-[8px] font-bold ml-2.5 -mt-2">1</span>}
                        </button>
                    </div>
                    
                    {/* Minimalist Progress Bar */}
                    <div className="w-full max-w-lg flex items-center gap-3 text-[10px] text-neutral-400 font-mono font-medium">
                        <span className="w-8 text-right text-black">{formatTime(progress)}</span>
                        <div className="flex-1 relative group h-1 flex items-center cursor-pointer">
                            <input 
                                type="range" 
                                min="0" max={duration || 0} step="0.1"
                                value={progress}
                                onChange={(e) => seek(parseFloat(e.target.value))}
                                className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                            />
                            {/* Track Background */}
                            <div className="w-full h-[2px] bg-neutral-200 relative overflow-hidden">
                                {/* Progress Fill (Solid Black) */}
                                <div 
                                    className="absolute top-0 left-0 h-full bg-black transition-all duration-100"
                                    style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                                ></div>
                            </div>
                            {/* Thumb (Only visible on hover) */}
                            <div 
                                className="absolute h-3 w-3 bg-black opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                style={{ left: `${(progress / (duration || 1)) * 100}%`, transform: 'translateX(-50%)' }}
                            ></div>
                        </div>
                        <span className="w-8">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Volume */}
                <div className="flex items-center justify-end gap-4">
                    <div className="flex items-center gap-3 w-32 group">
                        <button onClick={toggleMute} className="text-neutral-400 hover:text-black transition-colors">
                            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <div className="relative h-[2px] flex-1 bg-neutral-200 flex items-center">
                             <input 
                                type="range" 
                                min="0" max="1" step="0.01" 
                                value={isMuted ? 0 : volume} 
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                            />
                            <div 
                                className="absolute left-0 top-0 h-full bg-black"
                                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalPlayer;
