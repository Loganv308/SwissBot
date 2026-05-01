import { BaseExtractor, Track } from 'discord-player';
import { spawn } from 'node:child_process';

const YTDLP = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

// Cache search results and direct URLs to avoid redundant yt-dlp calls
const searchCache   = new Map(); // query -> { tracks, timestamp }
const directUrlCache = new Map(); // youtube url -> { url, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(cache, key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
    return entry.value;
}

function setCache(cache, key, value) {
    cache.set(key, { value, timestamp: Date.now() });
}

function ytdlpExec(args, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const proc = spawn(YTDLP, args);
        let out = '';

        const timer = setTimeout(() => {
            console.error(`[YtDlpExtractor] yt-dlp couldn't find any results after ${timeoutMs}ms, try being more specific.`);
            proc.kill('SIGKILL');
            resolve(''); // resolve empty so handle() returns no results gracefully
        }, timeoutMs);

        proc.stdout.on('data', d => out += d.toString());
        proc.stderr.resume();
        proc.on('close', () => {
            clearTimeout(timer);
            resolve(out.trim());
        });
        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

async function search(query, limit = 3) {
    const cached = getCached(searchCache, query);
    if (cached) {
        console.log(`[YtDlpExtractor] Cache hit for search: "${query}"`);
        return cached;
    }

    const out = await ytdlpExec([
        `ytsearch${limit}:${query}`,
        '--dump-json',
        '--no-playlist',
        '--match-filter', 'duration > 0',
        '--no-warnings',
        '-q',
        '--extractor-args', 'youtube:skip=dash,hls',
        '--socket-timeout', '10',  // give up on slow connections after 10s
    ]);

    if (!out) return [];
    const results = out.split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
    }).filter(r => r?.webpage_url?.includes('watch?v='));

    setCache(searchCache, query, results);
    return results;
}

async function getInfo(url) {
    const out = await ytdlpExec([
        url,
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '-q',
        '--extractor-args', 'youtube:skip=dash,hls',
    ]);
    return JSON.parse(out);
}

async function getDirectUrl(url) {
    const cached = getCached(directUrlCache, url);
    if (cached) {
        console.log(`[YtDlpExtractor] Cache hit for direct URL: ${url}`);
        return cached;
    }

    const out = await ytdlpExec([
        url,
        '-f', 'bestaudio[ext=webm]/bestaudio',
        '--get-url',
        '--no-playlist',
        '--no-warnings',
        '-q',
        '--extractor-args', 'youtube:skip=dash,hls',
    ]);

    const directUrl = out.split('\n')[0].trim();
    setCache(directUrlCache, url, directUrl);
    return directUrl;
}

export class YtDlpExtractor extends BaseExtractor {
    static identifier = 'com.swissarmybot.ytdlp-extractor';
    supportsDemux = true;

    async activate() {
        console.log('[YtDlpExtractor] Activated');
    }

    async deactivate() {}

    async validate(query) {
        return (
            query.includes('youtube.com/watch') ||
            query.includes('youtu.be/') ||
            (!query.startsWith('http://') && !query.startsWith('https://'))
        );
    }

    async handle(query, context) {
        const t0 = Date.now();
        console.log(`[YtDlpExtractor] handle() called with: "${query}"`);
        try {
            if (query.includes('youtube.com/watch') || query.includes('youtu.be/')) {
                console.log('[YtDlpExtractor] Direct URL, fetching info + stream URL in parallel...');
                const [info, directUrl] = await Promise.all([
                    getInfo(query).then(r  => { console.log(`[YtDlpExtractor] getInfo() done in ${Date.now() - t0}ms`);      return r; }),
                    getDirectUrl(query).then(r => { console.log(`[YtDlpExtractor] getDirectUrl() done in ${Date.now() - t0}ms`); return r; }),
                ]);
                const track = this.buildTrack(info, context, directUrl);
                console.log(`[YtDlpExtractor] handle() complete in ${Date.now() - t0}ms`);
                return this.createResponse(null, [track]);
            } else {
                console.log('[YtDlpExtractor] Text search...');
                const results = await search(query);
                console.log(`[YtDlpExtractor] search() done in ${Date.now() - t0}ms — ${results.length} results`);

                if (!results.length) return this.createResponse(null, []);

                const tracks = results.map(r => this.buildTrack(r, context));

                // Prefetch stream URL for first track in background
                if (tracks[0]) {
                    const tp = Date.now();
                    console.log(`[YtDlpExtractor] Prefetching stream URL for: "${tracks[0].title}"`);
                    getDirectUrl(tracks[0].url).then(url => {
                        tracks[0].metadata.cachedDirectUrl = url;
                        console.log(`[YtDlpExtractor] Prefetch done in ${Date.now() - tp}ms`);
                    }).catch(err => console.error('[YtDlpExtractor] Prefetch failed:', err.message));
                }

                console.log(`[YtDlpExtractor] handle() returning ${tracks.length} tracks in ${Date.now() - t0}ms`);
                return this.createResponse(null, tracks);
            }
        } catch(err) {
            console.error(`[YtDlpExtractor] handle() error after ${Date.now() - t0}ms:`, err.message);
            return this.createResponse(null, []);
        }
    }

    buildTrack(info, context, directUrl = null) {
        const durationSec = info.duration ?? 0;
        const mins = Math.floor(durationSec / 60);
        const secs = String(durationSec % 60).padStart(2, '0');

        return new Track(this.context.player, {
            title:       info.title       ?? 'Unknown',
            url:         info.webpage_url ?? info.url,
            duration:    `${mins}:${secs}`,
            thumbnail:   info.thumbnail   ?? '',
            author:      info.uploader    ?? info.channel ?? 'Unknown',
            requestedBy: context.requestedBy,
            source:      'youtube',
            queryType:   'youtubeVideo',
            metadata:    { ...info, cachedDirectUrl: directUrl },
        });
    }

    async stream(track) {
        const t0 = Date.now();
        const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
        console.log(`[YtDlpExtractor] stream() called for: "${track.title}"`);

        try {
            let directUrl = track.metadata?.cachedDirectUrl;
            if (directUrl) {
                console.log(`[YtDlpExtractor] Using prefetched URL (0ms wait)`);
            } else {
                console.log('[YtDlpExtractor] No cached URL, fetching now...');
                directUrl = await getDirectUrl(track.url);
                console.log(`[YtDlpExtractor] getDirectUrl() done in ${Date.now() - t0}ms`);
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
            console.log(`[YtDlpExtractor] ffmpeg spawned, stream ready in ${Date.now() - t0}ms`);
            return ffmpeg.stdout;

        } catch(err) {
            console.error(`[YtDlpExtractor] stream() error after ${Date.now() - t0}ms:`, err.message);
            throw err;
        }
    }
}