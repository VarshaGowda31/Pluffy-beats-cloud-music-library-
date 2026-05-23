/**
 * Data Manager for PluffyBeats - FIREBASE EDITION
 * Connects to Firebase Auth and Firestore.
 */

import { auth, db } from "./firebase.js?v=force10";
import { supabase } from "./supabase.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile as updateAuthProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    getDoc,
    deleteDoc,
    query,
    where,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

console.log("DataManager Module Loading...");

// Initial Seed Data
const INITIAL_SONGS = [
    {
        id: 's1',
        title: 'Cyberpunk City',
        artist: 'Futuristic Vibes',
        audioURL: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        coverGradient: 'linear-gradient(135deg, #FF00CC, #333399)'
    },
    {
        id: 's2',
        title: 'Lof-fi Chill',
        artist: 'Relaxing Beats',
        audioURL: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        coverGradient: 'linear-gradient(135deg, #FDC830, #F37335)'
    },
    {
        id: 's3',
        title: 'Deep House Summer',
        artist: 'ElectronicFlow',
        audioURL: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        coverGradient: 'linear-gradient(135deg, #00B4DB, #0083B0)'
    },
    {
        id: 's4',
        title: 'Cinematic Ambient',
        artist: 'Soundscapes',
        audioURL: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        coverGradient: 'linear-gradient(135deg, #11998e, #38ef7d)'
    },
    {
        id: 's5',
        title: 'Upbeat Pop',
        artist: 'Happy Tunes',
        audioURL: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        coverGradient: 'linear-gradient(135deg, #fc4a1a, #f7b733)'
    },
    {
        id: 's6',
        title: 'Synthwave Night',
        artist: 'Retro Gamer',
        audioURL: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
        coverGradient: 'linear-gradient(135deg, #7F00FF, #E100FF)'
    }
];

class DataManager {
    constructor() {
        this.currentUser = null;
        // Listen to auth state changes
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                localStorage.setItem('pluffy_uid', user.uid);
            } else {
                this.currentUser = null;
                localStorage.removeItem('pluffy_uid');
            }
        });
    }

    async _seedSongs(force = false) {
        try {
            const querySnapshot = await getDocs(collection(db, "songs"));
            if (force || querySnapshot.empty) {
                console.log("Seeding Database (Force: " + force + ")...");
                for (const song of INITIAL_SONGS) {
                    await setDoc(doc(db, "songs", song.id), { ...song, isPublic: true });
                }
                return INITIAL_SONGS.map(s => ({ ...s, isPublic: true }));
            } else {
                const songs = [];
                let hasCorruption = false;
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (!data.audioURL || !data.artist || data.artist === "undefined" || data.title === "Believer") {
                        hasCorruption = true;
                    }
                    songs.push({ ...data, id: doc.id }); // Ensure ID is present
                });

                if (hasCorruption) {
                    console.warn("Database contains corrupted data (Read-Only). Fallback to local.");
                    return INITIAL_SONGS.map(s => ({ ...s, isPublic: true }));
                }
                return songs.map(s => ({ ...s, isPublic: true }));
            }
        } catch (e) {
            console.error("Firestore Error (Permissions?):", e);
            // Fallback to local data so app still works
            return INITIAL_SONGS.map(s => ({ ...s, isPublic: true }));
        }
    }

    // --- Auth ---

    getCurrentUser() {
        return auth.currentUser;
    }

    getCachedUser() {
        if (auth.currentUser) {
            return {
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0]
            };
        }
        return null;
    }

    async login(email, password) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Record login history
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            loginHistory: arrayUnion({
                date: new Date().toISOString(),
                device: navigator.userAgent
            })
        }).catch(async (e) => {
            if (e.code === 'not-found') {
                await setDoc(userRef, {
                    email: user.email,
                    name: user.displayName || user.email.split('@')[0],
                    likedSongs: [],
                    loginHistory: [{
                        date: new Date().toISOString(),
                        device: navigator.userAgent
                    }]
                });
            }
        });

        return user;
    }

    async register(email, password) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const name = email.split('@')[0];

        await updateAuthProfile(user, { displayName: name });

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: email,
            name: name,
            likedSongs: [],
            loginHistory: [{
                date: new Date().toISOString(),
                device: navigator.userAgent
            }],
            listeningHistory: []
        });

        return user;
    }

    async logout() {
        await signOut(auth);
    }

    // --- Songs ---

    async getSongs() {
        const publicSongs = await this._seedSongs();
        let userSongs = [];

        if (auth.currentUser) {
            const q = query(collection(db, "songs"), where("uploadedBy", "==", auth.currentUser.uid));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                userSongs.push({ ...doc.data(), id: doc.id });
            });
        }

        return [...publicSongs, ...userSongs];
    }

    async uploadSong(file, title, artist) {
        if (!auth.currentUser) throw new Error("Not logged in");
        const user = auth.currentUser;
        const songId = 'u' + Date.now();
        const extension = file.name.split('.').pop();
        const storagePath = `${user.uid}/${songId}.${extension}`;

        try {
            console.log("Starting Upload to Supabase for:", file.name);

            const { data, error } = await supabase.storage
                .from('songs')
                .upload(storagePath, file);

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('songs')
                .getPublicUrl(storagePath);

            const songData = {
                id: songId,
                title: title || file.name.replace(/\.[^/.]+$/, ""),
                artist: artist || "Unknown Artist",
                audioURL: publicUrl,
                storagePath: storagePath,
                uploadedBy: user.uid,
                uploadDate: new Date().toISOString(),
                coverGradient: this._generateRandomGradient()
            };

            await setDoc(doc(db, "songs", songId), songData);
            return songData;
        } catch (error) {
            console.error("DEBUG: Supabase Storage Upload Error Details:", error);
            throw error;
        }
    }

    async deleteSong(songId) {
        if (!auth.currentUser) throw new Error("Not logged in");
        const songRef = doc(db, "songs", songId);
        const songSnap = await getDoc(songRef);

        if (songSnap.exists()) {
            const data = songSnap.data();
            if (data.uploadedBy !== auth.currentUser.uid) {
                throw new Error("You do not have permission to delete this song");
            }

            // Delete from Supabase Storage if it exists
            if (data.storagePath) {
                const { error } = await supabase.storage
                    .from('songs')
                    .remove([data.storagePath]);
                if (error) console.warn("Supabase Storage delete failed:", error);
            }

            // Delete from Firestore
            await deleteDoc(songRef);
            return true;
        }
        return false;
    }

    _generateRandomGradient() {
        const colors = [
            '#FF00CC', '#333399', '#FDC830', '#F37335',
            '#00B4DB', '#0083B0', '#11998e', '#38ef7d',
            '#fc4a1a', '#f7b733', '#7F00FF', '#E100FF'
        ];
        const c1 = colors[Math.floor(Math.random() * colors.length)];
        const c2 = colors[Math.floor(Math.random() * colors.length)];
        return `linear-gradient(135deg, ${c1}, ${c2})`;
    }

    // --- User Data ---

    async recordPlay(songId) {
        if (!auth.currentUser) return;
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
            listeningHistory: arrayUnion({
                songId,
                date: new Date().toISOString()
            })
        });
    }

    async toggleLike(songId) {
        if (!auth.currentUser) throw new Error("Not logged in");
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            const likes = data.likedSongs || [];

            if (likes.includes(songId)) {
                await updateDoc(userRef, {
                    likedSongs: arrayRemove(songId)
                });
            } else {
                await updateDoc(userRef, {
                    likedSongs: arrayUnion(songId)
                });
            }
            return !likes.includes(songId);
        }
    }

    async getLikedSongs() {
        if (!auth.currentUser) return [];
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            const likedIds = data.likedSongs || [];
            if (likedIds.length === 0) return [];

            const allSongs = await this.getSongs();
            return allSongs.filter(s => likedIds.includes(s.id));
        }
        return [];
    }

    async getFullHistory() {
        if (!auth.currentUser) return { login: [], listening: [] };
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            let listening = data.listeningHistory || [];
            listening.sort((a, b) => new Date(b.date) - new Date(a.date));
            listening = listening.slice(0, 20);

            let login = data.loginHistory || [];
            login.sort((a, b) => new Date(b.date) - new Date(a.date));

            return {
                login: login,
                listening: listening
            };
        }
        return { login: [], listening: [] };
    }

    async updateProfile(name, newPassword) {
        if (!auth.currentUser) throw new Error("Not logged in");
        const user = auth.currentUser;

        if (name) {
            await updateAuthProfile(user, { displayName: name });
            await updateDoc(doc(db, "users", user.uid), { name: name });
        }

        if (newPassword) {
            const { updatePassword } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js");
            await updatePassword(user, newPassword);
        }

        return { name: user.displayName };
    }

    async resetLibrary() {
        console.log("Resetting library...");
        try {
            const querySnapshot = await getDocs(collection(db, "songs"));
            const deletePromises = [];
            querySnapshot.forEach((docSnapshot) => {
                deletePromises.push(deleteDoc(doc(db, "songs", docSnapshot.id)));
            });
            await Promise.all(deletePromises);
        } catch (e) {
            console.warn("Could not delete existing songs (permission error?), proceeding to overwrite anyway.", e);
        }

        return await this._seedSongs(true);
    }

    // --- Playlists ---

    async createPlaylist(name) {
        if (!auth.currentUser) throw new Error("Not logged in");
        const playlistId = 'p' + Date.now();
        const playlistData = {
            id: playlistId,
            name: name,
            createdBy: auth.currentUser.uid,
            createdAt: new Date().toISOString(),
            songs: [] // Array of song IDs
        };
        await setDoc(doc(db, "playlists", playlistId), playlistData);
        return playlistData;
    }

    async getPlaylists() {
        if (!auth.currentUser) return [];
        const q = query(collection(db, "playlists"), where("createdBy", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        const playlists = [];
        querySnapshot.forEach((doc) => {
            playlists.push({ ...doc.data(), id: doc.id });
        });
        return playlists;
    }

    async addSongToPlaylist(playlistId, songId) {
        if (!auth.currentUser) throw new Error("Not logged in");
        const playlistRef = doc(db, "playlists", playlistId);
        await updateDoc(playlistRef, {
            songs: arrayUnion(songId)
        });
    }

    async removeSongFromPlaylist(playlistId, songId) {
        if (!auth.currentUser) throw new Error("Not logged in");
        const playlistRef = doc(db, "playlists", playlistId);
        await updateDoc(playlistRef, {
            songs: arrayRemove(songId)
        });
    }

    async deletePlaylist(playlistId) {
        if (!auth.currentUser) throw new Error("Not logged in");
        const playlistRef = doc(db, "playlists", playlistId);
        const playlistSnap = await getDoc(playlistRef);
        if (playlistSnap.exists() && playlistSnap.data().createdBy === auth.currentUser.uid) {
            await deleteDoc(playlistRef);
            return true;
        }
        return false;
    }
}

export const dataManager = new DataManager();
console.log("DataManager Initialized");
