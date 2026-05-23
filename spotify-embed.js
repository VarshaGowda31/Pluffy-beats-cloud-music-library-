/**
 * Spotify Embed Integration Module
 * No authentication required - uses public embed players
 */

class SpotifyEmbedService {
    constructor() {
        this.playlists = this.loadPlaylists();
    }

    /**
     * Parse Spotify URL and extract ID and type
     * @param {string} url - Spotify URL
     * @returns {Object|null} - {type, id} or null if invalid
     */
    parseSpotifyUrl(url) {
        // Remove query parameters and trailing slashes
        url = url.split('?')[0].replace(/\/$/, '');

        // Patterns for different Spotify URL formats
        const patterns = [
            // Standard web URLs
            /spotify\.com\/(playlist|album|track|artist|show|episode)\/([a-zA-Z0-9]+)/,
            // Spotify URI format
            /spotify:(playlist|album|track|artist|show|episode):([a-zA-Z0-9]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    type: match[1],
                    id: match[2],
                    url: `https://open.spotify.com/${match[1]}/${match[2]}`
                };
            }
        }

        return null;
    }

    /**
     * Generate embed iframe HTML
     * @param {string} type - playlist, album, track, etc.
     * @param {string} id - Spotify ID
     * @param {Object} options - Width, height, theme
     * @returns {string} - iframe HTML
     */
    generateEmbedCode(type, id, options = {}) {
        const width = options.width || '100%';
        const height = options.height || (type === 'track' ? '152' : '380');
        const theme = options.theme || '0'; // 0 = dark theme

        return `<iframe 
      style="border-radius: 12px" 
      src="https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=${theme}" 
      width="${width}" 
      height="${height}" 
      frameBorder="0" 
      allowfullscreen="" 
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
      loading="lazy">
    </iframe>`;
    }

    /**
     * Fetch playlist metadata using Spotify oEmbed API (no auth required)
     * @param {string} url - Spotify URL
     * @returns {Promise<Object>} - Metadata object
     */
    async fetchMetadata(url) {
        try {
            const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
            const response = await fetch(oEmbedUrl);

            if (!response.ok) {
                throw new Error('Failed to fetch metadata');
            }

            const data = await response.json();

            return {
                title: data.title || 'Untitled',
                thumbnail: data.thumbnail_url || '',
                html: data.html || '',
                provider: data.provider_name || 'Spotify',
                type: data.type || 'rich'
            };
        } catch (error) {
            console.error('Error fetching Spotify metadata:', error);
            // Return basic metadata if fetch fails
            const parsed = this.parseSpotifyUrl(url);
            return {
                title: `Spotify ${parsed?.type || 'Content'}`,
                thumbnail: '',
                html: '',
                provider: 'Spotify',
                type: 'rich'
            };
        }
    }

    /**
     * Add a Spotify playlist/album/track to user's collection
     * @param {string} url - Spotify URL
     * @returns {Promise<Object>} - Added playlist object
     */
    async addPlaylist(url) {
        const parsed = this.parseSpotifyUrl(url);

        if (!parsed) {
            throw new Error('Invalid Spotify URL. Please use a valid Spotify link.');
        }

        // Check if already exists
        const exists = this.playlists.find(p => p.id === parsed.id);
        if (exists) {
            throw new Error('This playlist is already in your collection.');
        }

        // Fetch metadata
        const metadata = await this.fetchMetadata(parsed.url);

        const playlist = {
            id: parsed.id,
            type: parsed.type,
            url: parsed.url,
            title: metadata.title,
            thumbnail: metadata.thumbnail,
            addedAt: new Date().toISOString(),
            embedCode: this.generateEmbedCode(parsed.type, parsed.id)
        };

        this.playlists.push(playlist);
        this.savePlaylists();

        return playlist;
    }

    /**
     * Remove a playlist from collection
     * @param {string} id - Playlist ID
     */
    removePlaylist(id) {
        this.playlists = this.playlists.filter(p => p.id !== id);
        this.savePlaylists();
    }

    /**
     * Get all saved playlists
     * @returns {Array} - Array of playlist objects
     */
    getPlaylists() {
        return this.playlists;
    }

    /**
     * Get a specific playlist by ID
     * @param {string} id - Playlist ID
     * @returns {Object|null} - Playlist object or null
     */
    getPlaylist(id) {
        return this.playlists.find(p => p.id === id) || null;
    }

    /**
     * Load playlists from localStorage
     * @returns {Array} - Array of playlists
     */
    loadPlaylists() {
        try {
            const stored = localStorage.getItem('spotify_playlists');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading playlists:', error);
            return [];
        }
    }

    /**
     * Save playlists to localStorage
     */
    savePlaylists() {
        try {
            localStorage.setItem('spotify_playlists', JSON.stringify(this.playlists));
        } catch (error) {
            console.error('Error saving playlists:', error);
        }
    }

    /**
     * Clear all playlists
     */
    clearAll() {
        this.playlists = [];
        this.savePlaylists();
    }

    /**
     * Get embed URL for direct iframe src
     * @param {string} type - Content type
     * @param {string} id - Spotify ID
     * @returns {string} - Embed URL
     */
    getEmbedUrl(type, id) {
        return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
    }
}

// Export singleton instance
export const spotifyService = new SpotifyEmbedService();
