
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Song, PlaybackRecord } from '../types';
import { dbAPI } from '../services/db'; // Changed from dbService to dbAPI

interface AudioContextType {
    currentSong: Song | null;
    isPlaying: boolean;
    progress: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    isShuffle: boolean;
    repeatMode: 'NONE' | 'ALL' | 'ONE';
    playSong: (song: Song) => void;
    togglePlay: () => void;
    nextSong: () => void;
    prevSong: () => void;
    seek: (time: number) => void;
    setVolume: (vol: number) => void;
    toggleMute: () => void;
    toggleShuffle: () => void;
    toggleRepeat: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fadeIntervalRef = useRef<number | null>(null);

    // Refs to hold current state for async operations (fade intervals)
    const volumeRef = useRef(1);
    const isMutedRef = useRef(false);

    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isShuffle, setIsShuffle] = useState(false);
    const [repeatMode, setRepeatMode] = useState<'NONE' | 'ALL' | 'ONE'>('NONE');

    // Load volume from storage
    useEffect(() => {
        const savedVol = localStorage.getItem('alabanza_volume');
        if (savedVol) {
            const vol = parseFloat(savedVol);
            setVolumeState(vol);
            volumeRef.current = vol;
        }
    }, []);

    // Audio Element Setup
    useEffect(() => {
        audioRef.current = new Audio();

        const audio = audioRef.current;

        const updateTime = () => {
            setProgress(audio.currentTime);
            setDuration(audio.duration || 0);
        };

        const handleEnded = () => {
            if (repeatMode === 'ONE') {
                audio.currentTime = 0;
                audio.play().catch(e => console.error("Replay failed", e));
                // We should record repeat plays as well
                if (currentSong) recordPlay(currentSong);
            } else {
                nextSong();
            }
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateTime);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateTime);
            audio.removeEventListener('ended', handleEnded);
            audio.pause();
            audioRef.current = null;
        };
    }, [repeatMode, currentSong]); // Re-bind if repeat mode changes to ensure closure captures it

    // Helper to record statistics
    const recordPlay = (song: Song) => {
        const record: PlaybackRecord = {
            id: crypto.randomUUID(),
            songId: song.id,
            songTitle: song.title,
            artist: song.artist,
            category: song.category,
            timestamp: new Date().toISOString()
        };
        dbAPI.addPlaybackRecord(record).catch(err => console.error("Failed to track play", err));
    };

    // Handle Song Change
    useEffect(() => {
        if (audioRef.current && currentSong) {
            // Stop any existing fade
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
            }

            // CRITICAL FIX: Check if audio source is valid before assigning or playing
            if (!currentSong.audioFile || currentSong.audioFile.trim() === '') {
                console.warn(`AudioContext: No audio source found for "${currentSong.title}". Playback aborted.`);
                setIsPlaying(false);
                return;
            }

            audioRef.current.src = currentSong.audioFile;
            audioRef.current.load();

            // Restore volume immediately for new song
            audioRef.current.volume = isMutedRef.current ? 0 : volumeRef.current;

            if (isPlaying) {
                audioRef.current.play().then(() => {
                    recordPlay(currentSong); // Track play when auto-playing next song
                }).catch(e => {
                    console.error("Playback failed:", e);
                    setIsPlaying(false);
                });
            }
        }
    }, [currentSong]);

    // Handle Play/Pause with Fade Out
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentSong) return;

        // Skip if source is invalid
        if (!currentSong.audioFile) {
            if (isPlaying) setIsPlaying(false);
            return;
        }

        // Clear any active fade interval
        if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
        }

        if (isPlaying) {
            // PLAYING
            // Ensure volume is restored to target level immediately
            const targetVolume = isMutedRef.current ? 0 : volumeRef.current;
            audio.volume = targetVolume;

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.warn("Audio playback prevented:", e);
                    setIsPlaying(false);
                });
            }
        } else {
            // PAUSING (Fade Out)
            if (!audio.paused && !audio.ended && audio.currentTime > 0) {
                const startVol = audio.volume;
                // If volume is already very low, pause immediately
                if (startVol < 0.05) {
                    audio.pause();
                    return;
                }

                const fadeDuration = 800; // 800ms fade out
                const steps = 20;
                const intervalTime = fadeDuration / steps;
                const volStep = startVol / steps;

                fadeIntervalRef.current = window.setInterval(() => {
                    if (audio.volume > volStep) {
                        audio.volume -= volStep;
                    } else {
                        // Fade complete
                        audio.volume = 0;
                        audio.pause();
                        if (fadeIntervalRef.current) {
                            clearInterval(fadeIntervalRef.current);
                            fadeIntervalRef.current = null;
                        }
                        // Restore volume state for next play
                        audio.volume = isMutedRef.current ? 0 : volumeRef.current;
                    }
                }, intervalTime);
            } else {
                // If already paused, ensure it stays paused
                audio.pause();
            }
        }

        // Cleanup on effect re-run (e.g. rapid toggle)
        return () => {
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
                // Restore volume if interrupted
                if (audio) {
                    audio.volume = isMutedRef.current ? 0 : volumeRef.current;
                }
            }
        };
    }, [isPlaying]);

    // Handle Volume Changes
    useEffect(() => {
        // Update refs
        volumeRef.current = volume;
        isMutedRef.current = isMuted;

        if (audioRef.current) {
            // Only update volume directly if we are NOT currently fading out
            if (!fadeIntervalRef.current) {
                audioRef.current.volume = isMuted ? 0 : volume;
            }
            localStorage.setItem('alabanza_volume', volume.toString());
        }
    }, [volume, isMuted]);

    const playSong = (song: Song) => {
        if (!song.audioFile) {
            console.warn("Cannot play song without audio file");
            return;
        }

        if (currentSong?.id === song.id) {
            togglePlay();
        } else {
            setCurrentSong(song);
            setIsPlaying(true);
            // Record Play is triggered by the useEffect[currentSong] + isPlaying=true
        }
    };

    const togglePlay = () => {
        if (currentSong?.audioFile) {
            setIsPlaying(!isPlaying);
        }
    };

    // Fetch playlist asynchronously
    const nextSong = async () => {
        try {
            const songs = await dbAPI.getAllSongs();
            const validSongs = songs.filter(s => s.audioFile); // Only cycle through valid songs
            if (validSongs.length === 0) return;

            let nextTrack: Song;

            if (isShuffle) {
                const randomIndex = Math.floor(Math.random() * validSongs.length);
                nextTrack = validSongs[randomIndex];
            } else {
                // Find current index in the full list or valid list
                const currentIndex = validSongs.findIndex(s => s.id === currentSong?.id);
                const nextIndex = (currentIndex + 1) % validSongs.length;
                nextTrack = validSongs[nextIndex];
            }

            setCurrentSong(nextTrack);
            setIsPlaying(true);
        } catch (err) {
            console.error('Error fetching songs for next track:', err);
        }
    };

    const prevSong = async () => {
        try {
            const songs = await dbAPI.getAllSongs();
            const validSongs = songs.filter(s => s.audioFile);
            if (validSongs.length === 0) return;

            if (audioRef.current && audioRef.current.currentTime > 3) {
                audioRef.current.currentTime = 0;
                return;
            }

            const currentIndex = validSongs.findIndex(s => s.id === currentSong?.id);
            const prevIndex = currentIndex <= 0 ? validSongs.length - 1 : currentIndex - 1;
            setCurrentSong(validSongs[prevIndex]);
            setIsPlaying(true);
        } catch (err) {
            console.error('Error fetching songs for previous track:', err);
        }
    };

    const seek = (time: number) => {
        if (audioRef.current && audioRef.current.duration) {
            audioRef.current.currentTime = time;
            setProgress(time);
        }
    };

    const setVolume = (vol: number) => {
        setVolumeState(vol);
        setIsMuted(false);
    };

    const toggleMute = () => setIsMuted(!isMuted);
    const toggleShuffle = () => setIsShuffle(!isShuffle);
    const toggleRepeat = () => {
        if (repeatMode === 'NONE') setRepeatMode('ALL');
        else if (repeatMode === 'ALL') setRepeatMode('ONE');
        else setRepeatMode('NONE');
    };

    return (
        <AudioContext.Provider value={{
            currentSong, isPlaying, progress, duration, volume, isMuted, isShuffle, repeatMode,
            playSong, togglePlay, nextSong, prevSong, seek, setVolume, toggleMute, toggleShuffle, toggleRepeat
        }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudio = () => {
    const context = useContext(AudioContext);
    if (context === undefined) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};
