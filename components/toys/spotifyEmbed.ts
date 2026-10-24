export type PlaybackEvent = { data: { playingURI?: string; isPaused: boolean; isBuffering: boolean; duration?: number; position?: number } };
export type EmbedController = {
  loadUri: (uri: string) => void;
  loadEntity?: (uri: string) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  destroy: () => void;
  addListener: (name: string, callback: (event: PlaybackEvent) => void) => void;
  removeListener?: (name: string, callback: (event: PlaybackEvent) => void) => void;
};
type EmbedApi = { createController: (element: HTMLElement, options: { uri: string; width: string; height: number }, callback: (controller: EmbedController) => void) => void };
declare global { interface Window { onSpotifyIframeApiReady?: (api: EmbedApi) => void; SpotifyIframeConfig?: { loading?: number } } }
let pending: Promise<EmbedApi> | null = null;
let loaded: EmbedApi | null = null;

/** Only called after an explicit visitor interaction. No audio is proxied. */
export function loadSpotifyEmbed(): Promise<EmbedApi> {
  if (loaded) return Promise.resolve(loaded);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previous = window.onSpotifyIframeApiReady;
    const timer = window.setTimeout(fail, 15000);
    function fail() {
      clearTimeout(timer);
      script.onerror = null;
      script.remove();
      document.getElementById('spotify-iframeapi-script')?.remove();
      // The official bootstrap sets this flag before fetching its CDN script.
      // Reset it after a failed fetch so an explicit retry can load the SDK.
      if (window.SpotifyIframeConfig) window.SpotifyIframeConfig.loading = 0;
      pending = null;
      window.onSpotifyIframeApiReady = previous;
      reject(new Error('Spotify 暂时未连接'));
    }
    window.onSpotifyIframeApiReady = api => { clearTimeout(timer); loaded = api; resolve(api); };
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}
