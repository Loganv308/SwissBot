import { BaseExtractor, Track } from 'discord-player';
import { spawn } from 'node:child_process';

const YTDLP = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

// ─── Constants ─────────────────────────────────────────────────────────────

const CACHE_TTL        = 5 * 60 * 1000;  // 5 minutes
const PLAYLIST_LIMIT   = 100;            // Max tracks to load from a playlist
const PLAYLIST_PREFETCH = 5;            // How many tracks to prefetch URLs for upfront

// ─── Cache ─────────────────────────────────────────────────────────────────

const searchCache    = new Map(); // query    -> { value, timestamp }
const directUrlCache = new Map(); // yt url   -> { value, timestamp }
const playlistCache  = new Map(); // list url -> { value, timestamp }

function getCached(cache, key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
    return entry.value;
}

function setCache(cache, key, value) {
    cache.set(key, { value, timestamp: Date.now() });
}

// ─── yt-dlp Runner ─────────────────────────────────────────────────────────

function ytdlpExec(args, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        const proc  = spawn(YTDLP, args);
        let out = '';

        const timer = setTimeout(() => {
            console.warn(`[YtDlpExtractor] Timeout after ${timeoutMs}ms`);
            proc.kill('SIGKILL');
            resolve('');
        }, timeoutMs);

        proc.stdout.on('data', d => out += d.toString());
        proc.stderr.resume();
        proc.on('close', () => { clearTimeout(timer); resolve(out.trim()); });
        proc.on('error', err => { clearTimeout(timer); reject(err); });
    });
}

// ─── Core Fetchers ─────────────────────────────────────────────────────────

// Text search: 1 result, get metadata + direct URL in a single yt-dlp call
async function searchOne(query) {
    const cached = getCached(searchCache, query);
    if (cached) {
        console.log(`[YtDlpExtractor] Cache hit: "${query}"`);
        return cached;
    }

    // Single yt-dlp call: dump JSON + get direct audio URL at the same time
    const out = await ytdlpExec([
        `ytsearch1:${query}`,
        '--dump-json',
        '--no-playlist',
        '--match-filter', 'duration > 0',
        '--no-warnings',
        '-q',
        '-f', 'bestaudio[ext=webm]/bestaudio',
        '--extractor-args', 'youtube:skip=dash,hls',
        '--socket-timeout', '10',
    ]);

    if (!out) return null;

    try {
        const info = JSON.parse(out.split('\n')[0]);
        // Extract the direct URL from the chosen format
        const directUrl = info.url ?? info.formats?.find(f => f.url)?.url ?? null;
        const result = { info, directUrl };
        setCache(searchCache, query, result);
        return result;
    } catch {
        return null;
    }
}

// Direct URL: get metadata + direct audio URL in one call
async function getVideoInfoAndUrl(url) {
    const cachedUrl = getCached(directUrlCache, url);
    if (cachedUrl) {
        console.log(`[YtDlpExtractor] Cache hit (direct): ${url}`);
        return cachedUrl;
    }

    const out = await ytdlpExec([
        url,
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '-q',
        '-f', 'bestaudio[ext=webm]/bestaudio',
        '--extractor-args', 'youtube:skip=dash,hls',
    ]);

    if (!out) return null;

    try {
        const info = JSON.parse(out);
        const directUrl = info.url ?? info.formats?.find(f => f.url)?.url ?? null;
        const result = { info, directUrl };
        setCache(directUrlCache, url, result);
        return result;
    } catch {
        return null;
    }
}

// Playlist: fetch up to PLAYLIST_LIMIT track metadata entries
async function getPlaylistTracks(url) {
    const cached = getCached(playlistCache, url);
    if (cached) {
        console.log(`[YtDlpExtractor] Cache hit (playlist): ${url}`);
        return cached;
    }

    console.log(`[YtDlpExtractor] Fetching playlist (limit ${PLAYLIST_LIMIT})...`);
    const out = await ytdlpExec([
        url,
        '--dump-json',
        '--yes-playlist',
        '--playlist-end', String(PLAYLIST_LIMIT),
        '--no-warnings',
        '-q',
        '--flat-playlist',          // Fast: only fetches metadata, not stream URLs
        '--extractor-args', 'youtube:skip=dash,hls',
        '--socket-timeout', '10',
    ], 60000); // longer timeout for big playlists

    if (!out) return [];

    const tracks = out.split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(r => r?.url || r?.webpage_url);

    setCache(playlistCache, url, tracks);
    return tracks;
}

// Fetch just the direct stream URL for a single known video URL
async function getDirectUrl(videoUrl) {
    const cached = getCached(directUrlCache, videoUrl);
    if (cached?.directUrl) return cached.directUrl;

    const out = await ytdlpExec([
        videoUrl,
        '-f', 'bestaudio[ext=webm]/bestaudio',
        '--get-url',
        '--no-playlist',
        '--no-warnings',
        '-q',
        '--extractor-args', 'youtube:skip=dash,hls',
    ]);

    const directUrl = out.split('\n')[0].trim();
    setCache(directUrlCache, videoUrl, { info: null, directUrl });
    return directUrl;
}

// ─── Track Builder ─────────────────────────────────────────────────────────

function buildTrack(player, info, context, directUrl = null) {
    const durationSec = info.duration ?? 0;
    const mins = Math.floor(durationSec / 60);
    const secs = String(durationSec % 60).padStart(2, '0');

    // --flat-playlist gives us url (relative ID) or webpage_url
    const trackUrl = info.webpage_url
        ?? (info.url?.startsWith('http') ? info.url : `https://www.youtube.com/watch?v=${info.url}`);

    return new Track(player, {
        title:       info.title     ?? 'Unknown',
        url:         trackUrl,
        duration:    `${mins}:${secs}`,
        thumbnail:   info.thumbnail ?? `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
        author:      info.uploader  ?? info.channel ?? info.uploader_id ?? 'Unknown',
        requestedBy: context.requestedBy,
        source:      'youtube',
        queryType:   'youtubeVideo',
        metadata:    { ...info, cachedDirectUrl: directUrl },
    });
}

// ─── Extractor ─────────────────────────────────────────────────────────────

export class YtDlpExtractor extends BaseExtractor {
    static identifier = 'com.swissarmybot.ytdlp-extractor';
    supportsDemux = true;

    async activate() {
        console.log('[YtDlpExtractor] Activated');
    }

    async deactivate() {}

    async validate(query) {
        return (
            query.includes('youtube.com') ||
            query.includes('youtu.be/') ||
            (!query.startsWith('http://') && !query.startsWith('https://'))
        );
    }

    async handle(query, context) {
        const t0 = Date.now();
        console.log(`[YtDlpExtractor] handle() called with: "${query}"`);

        try {
            // ── Playlist URL ───────────────────────────────────────────────
            const isPlaylist = query.includes('youtube.com') &&
                               query.includes('list=') &&
                               !query.includes('watch?v='); // watch?v= with list= = single video

            if (isPlaylist) {
                console.log('[YtDlpExtractor] Playlist detected...');
                const rawTracks = await getPlaylistTracks(query);

                if (!rawTracks.length) return this.createResponse(null, []);

                const tracks = rawTracks.map(r => buildTrack(this.context.player, r, context));

                // Prefetch direct URLs for first N tracks in background
                console.log(`[YtDlpExtractor] Prefetching first ${PLAYLIST_PREFETCH} stream URLs...`);
                for (let i = 0; i < Math.min(PLAYLIST_PREFETCH, tracks.length); i++) {
                    const t = tracks[i];
                    getDirectUrl(t.url).then(url => {
                        t.metadata.cachedDirectUrl = url;
                        console.log(`[YtDlpExtractor] Prefetched [${i + 1}]: "${t.title}"`);
                    }).catch(err => console.error(`[YtDlpExtractor] Prefetch failed [${i}]:`, err.message));
                }

                console.log(`[YtDlpExtractor] Playlist loaded: ${tracks.length} tracks in ${Date.now() - t0}ms`);
                return this.createResponse(null, tracks);
            }

            // ── Direct Video URL ───────────────────────────────────────────
            if (query.includes('youtube.com/watch') || query.includes('youtu.be/')) {
                console.log('[YtDlpExtractor] Direct video URL...');
                const result = await getVideoInfoAndUrl(query);
                if (!result) return this.createResponse(null, []);

                const track = buildTrack(this.context.player, result.info, context, result.directUrl);
                console.log(`[YtDlpExtractor] Direct URL ready in ${Date.now() - t0}ms`);
                return this.createResponse(null, [track]);
            }

            // ── Text Search ────────────────────────────────────────────────
            console.log('[YtDlpExtractor] Text search...');
            const result = await searchOne(query);

            if (!result) return this.createResponse(null, []);

            // directUrl is already fetched — stream() will have zero wait time
            const track = buildTrack(this.context.player, result.info, context, result.directUrl);
            console.log(`[YtDlpExtractor] Search ready in ${Date.now() - t0}ms`);
            return this.createResponse(null, [track]);

        } catch (err) {
            console.error(`[YtDlpExtractor] handle() error after ${Date.now() - t0}ms:`, err.message);
            return this.createResponse(null, []);
        }
    }

    async stream(track) {
        const t0 = Date.now();
        const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
        console.log(`[YtDlpExtractor] stream() called: "${track.title}"`);

        try {
            let directUrl = track.metadata?.cachedDirectUrl;

            if (directUrl) {
                console.log(`[YtDlpExtractor] Using cached URL (0ms wait)`);
            } else {
                console.log('[YtDlpExtractor] No cached URL, fetching...');
                directUrl = await getDirectUrl(track.url);
                console.log(`[YtDlpExtractor] Fetched in ${Date.now() - t0}ms`);
            }

            const ffmpeg = spawn(ffmpegPath, [
                '-reconnect', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '5',
                '-i', directUrl,
                '-f', 'webm',
                '-c:a', 'copy',
                'pipe:1',
            ]);

            ffmpeg.stderr.resume();
            console.log(`[YtDlpExtractor] ffmpeg ready in ${Date.now() - t0}ms`);
            return ffmpeg.stdout;

        } catch (err) {
            console.error(`[YtDlpExtractor] stream() error after ${Date.now() - t0}ms:`, err.message);
            throw err;
        }
    }
}