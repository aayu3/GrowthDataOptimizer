# GFL2 Growth Data Optimizer

A web application designed to help players of Girls Frontline 2 (GFL2) manage and optimize their in-game equipment (relics). The tool allows users to import their inventory, browse their available gear, and automatically calculate the best setup for their characters.

**[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/N4N51V6NN9)**

---

## User Guide

### Features
- **Inventory Management**: Import and export relic data to keep your local database in sync.
- **Relic Database**: Browse and filter your entire collection of gear.
- **Character Optimizer**: Select specific characters and calculate the optimal relic configurations based on their specific stat needs.
- **Local Storage**: Securely stores your data locally in your browser. No server required.

---

## Developer Guide

### Tech Stack
- React 18
- TypeScript
- Vite
- Dexie.js (IndexedDB wrapper)
- React Router DOM

### Running locally

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```

### Google Drive sync setup

To enable browser-only Google Drive backup/restore:

1. Create a Google OAuth 2.0 Web application client in Google Cloud.
2. Enable the Google Drive API for that project.
3. Add your frontend origins, such as `http://localhost:5173` and your production domain, to the OAuth client.
4. Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_CLIENT_ID`.

The app uses Google OAuth in the browser and stores a single backup file in Drive `appDataFolder`. No backend, client secret, or manually supplied access token is required.
