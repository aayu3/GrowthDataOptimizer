const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
export const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

declare global {
    interface Window {
        google?: {
            accounts: {
                oauth2: {
                    initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
                    revoke: (token: string, done?: () => void) => void;
                };
            };
        };
    }
}

interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    error?: string;
    error_description?: string;
    prompt?: string;
    scope: string;
    token_type: string;
}

interface GoogleTokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type: string }) => void;
}

interface GoogleTokenClient {
    requestAccessToken: (overrides?: { prompt?: string }) => void;
}

let scriptLoadPromise: Promise<void> | null = null;

export function getGoogleClientId() {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';
}

export function isGoogleDriveConfigured() {
    return getGoogleClientId().length > 0;
}

export function loadGoogleIdentityScript() {
    if (window.google?.accounts?.oauth2) {
        return Promise.resolve();
    }

    if (scriptLoadPromise) {
        return scriptLoadPromise;
    }

    scriptLoadPromise = new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services script.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
        document.head.appendChild(script);
    });

    return scriptLoadPromise;
}

export async function requestGoogleAccessToken(prompt: '' | 'consent' = 'consent') {
    const clientId = getGoogleClientId();
    if (!clientId) {
        throw new Error('Google Drive sync is not configured. Set VITE_GOOGLE_CLIENT_ID.');
    }

    await loadGoogleIdentityScript();

    return new Promise<GoogleTokenResponse>((resolve, reject) => {
        const tokenClient = window.google?.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GOOGLE_DRIVE_APPDATA_SCOPE,
            callback: (response) => {
                if (response.error) {
                    reject(new Error(response.error_description || response.error));
                    return;
                }
                resolve(response);
            },
            error_callback: (error) => {
                reject(new Error(error.type || 'Failed to authenticate with Google.'));
            }
        });

        if (!tokenClient) {
            reject(new Error('Google Identity Services is unavailable.'));
            return;
        }

        tokenClient.requestAccessToken({ prompt });
    });
}

export function revokeGoogleAccessToken(token: string) {
    return new Promise<void>((resolve) => {
        if (!window.google?.accounts?.oauth2 || !token) {
            resolve();
            return;
        }

        window.google.accounts.oauth2.revoke(token, () => resolve());
    });
}
