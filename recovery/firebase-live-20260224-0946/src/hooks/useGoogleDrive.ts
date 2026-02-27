import { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';

// Types for GAPI and GIS
// We declare them globally or essentially treat window.gapi as any for interactions, 
// but try to maintain type safety where possible.
declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

// Configuration - Check Env Vars
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;

export interface GoogleDriveFile {
    id: string;
    name: string;
    mimeType: string;
    thumbnailLink?: string;
    iconLink?: string;
    size?: string;
    modifiedTime?: string;
    parents?: string[];
    webViewLink?: string; // Open in Drive
    webContentLink?: string; // Download
}

export const useGoogleDrive = () => {
    const [isApiLoaded, setIsApiLoaded] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Local Storage Key
    const STORAGE_KEY = 'gdrive_token';

    // GIS Token Client
    const tokenClient = useRef<any>(null);

    // Initial Script Loading
    useEffect(() => {
        const loadScripts = async () => {
            if (!CLIENT_ID || !API_KEY) {
                console.warn('Google Drive API: Missing Client ID or API Key in environment variables.');
                return;
            }

            try {
                // 1. Load GAPI (Google API Client)
                const loadGapi = new Promise<void>((resolve) => {
                    if (window.gapi) { resolve(); return; }
                    const script = document.createElement('script');
                    script.src = 'https://apis.google.com/js/api.js';
                    script.onload = () => resolve();
                    script.onerror = () => console.error('Failed to load gapi');
                    document.body.appendChild(script);
                });

                // 2. Load GIS (Google Identity Services)
                const loadGis = new Promise<void>((resolve) => {
                    if (window.google) { resolve(); return; }
                    const script = document.createElement('script');
                    script.src = 'https://accounts.google.com/gsi/client';
                    script.onload = () => resolve();
                    script.onerror = () => console.error('Failed to load gis');
                    document.body.appendChild(script);
                });

                await Promise.all([loadGapi, loadGis]);

                // 3. Initialize GAPI Client
                await new Promise<void>((resolve, reject) => {
                    window.gapi.load('client', async () => {
                        try {
                            await window.gapi.client.init({
                                apiKey: API_KEY,
                                discoveryDocs: DISCOVERY_DOCS,
                            });
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    });
                });

                // 4. Initialize GIS Token Client
                tokenClient.current = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: async (resp: any) => {
                        if (resp.error !== undefined) {
                            throw (resp);
                        }
                        // Token received, set gapi token
                        const token = resp.access_token;
                        const expiresIn = resp.expires_in; // seconds
                        const expiryDate = new Date().getTime() + (expiresIn * 1000);

                        // Save to localStorage
                        localStorage.setItem(STORAGE_KEY, JSON.stringify({
                            token,
                            expiry: expiryDate
                        }));

                        setIsAuthenticated(true);
                    },
                });

                setIsApiLoaded(true);

                // 5. Restore Token from LocalStorage if valid
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const { token, expiry } = JSON.parse(stored);
                    if (new Date().getTime() < expiry) {
                        // Validate token? For now, assume valid if not expired time-wise.
                        // We must set it in GAPI to use it.
                        // GAPI client uses the token object structure. 
                        // We can reconstruct a basic one or just pass access_token if using raw fetch, 
                        // but gapi.client.setToken needs an object.
                        window.gapi.client.setToken({ access_token: token });
                        setIsAuthenticated(true);
                    } else {
                        // Expired
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }

            } catch (error) {
                console.error('Error initializing Google Drive API:', error);
                Swal.fire({ title: 'Initialization Error', text: 'Failed to load Google Drive API. Check console.', icon: 'error' });
            }
        };

        loadScripts();
    }, []);

    // Login Action
    const handleLogin = useCallback(() => {
        if (!tokenClient.current) return;
        tokenClient.current.requestAccessToken({ prompt: '' }); // Try silent or auto
    }, []);

    const handleLogout = useCallback(() => {
        const token = window.gapi?.client?.getToken();
        if (token !== null) {
            window.google?.accounts?.oauth2?.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                setIsAuthenticated(false);
                localStorage.removeItem(STORAGE_KEY);
            });
        } else {
            // Just clear local state
            setIsAuthenticated(false);
            localStorage.removeItem(STORAGE_KEY);
            window.gapi?.client?.setToken(null);
        }
    }, []);

    // Operations
    const getFile = async (fileId: string) => {
        if (!isApiLoaded) return null;
        try {
            const response = await window.gapi.client.drive.files.get({
                fileId: fileId,
                fields: 'id, name, mimeType'
            });
            return response.result;
        } catch (error) {
            console.error('Get File Error', error);
            return null;
        }
    };

    const listFiles = async (folderId = 'root') => {
        if (!isApiLoaded) return [];
        setIsLoading(true);
        try {
            const response = await window.gapi.client.drive.files.list({
                'pageSize': 20,
                'fields': "nextPageToken, files(id, name, mimeType, thumbnailLink, iconLink, size, modifiedTime, webViewLink, webContentLink)",
                'q': `'${folderId}' in parents and trashed = false`,
                'orderBy': 'folder, name',
                // Support Shared Drives/Team Drives
                'supportsAllDrives': true,
                'includeItemsFromAllDrives': true
            });

            const files: GoogleDriveFile[] = response.result.files;
            return files;

        } catch (err: any) {
            console.error('List Files Error', err);
            if (err.status === 401) {
                setIsAuthenticated(false);
                localStorage.removeItem(STORAGE_KEY); // Clear invalid token
                Swal.fire('Session Expired', 'Please login again.', 'warning');
            } else {
                Swal.fire('Error', 'Failed to list files', 'error');
            }
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    // Upload with Multipath (JSON Metadata + File Content)
    const uploadFile = async (file: File, parentId = 'root') => {
        if (!isApiLoaded) return;
        setIsLoading(true);

        const accessToken = window.gapi.client.getToken()?.access_token;
        if (!accessToken) {
            Swal.fire('Error', 'No access token found', 'error');
            setIsLoading(false);
            return;
        }

        try {
            const metadata = {
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                parents: [parentId],
            };

            const formData = new FormData();
            const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
            formData.append('metadata', metadataBlob);
            formData.append('file', file);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                body: formData,
            });

            const data = await response.json();
            if (data.error) throw data.error;

            Swal.fire({ icon: 'success', title: 'Uploaded', text: file.name, toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
            return data;

        } catch (error) {
            console.error('Upload Error', error);
            if ((error as any).status === 401 || (error as any).code === 401) {
                setIsAuthenticated(false);
                localStorage.removeItem(STORAGE_KEY);
                Swal.fire('Session Expired', 'Please login again.', 'warning');
            } else {
                Swal.fire('Upload Failed', 'See console for details', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const deleteFile = async (fileId: string) => {
        try {
            await window.gapi.client.drive.files.delete({
                fileId: fileId
            });
            return true;
        } catch (error) {
            console.error('Delete Error', error);
            if ((error as any).status === 401) {
                setIsAuthenticated(false);
                localStorage.removeItem(STORAGE_KEY);
                Swal.fire('Session Expired', 'Please login again.', 'warning');
            } else {
                Swal.fire('Error', 'Could not delete file', 'error');
            }
            return false;
        }
    };

    return {
        isApiLoaded,
        isAuthenticated,
        isLoading,
        files: [],
        login: handleLogin,
        logout: handleLogout,
        listFiles,
        uploadFile,
        deleteFile,
        getFile,
        checkEnv: { hasClientId: !!CLIENT_ID, hasApiKey: !!API_KEY }
    };
};
