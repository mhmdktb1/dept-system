# Chocair Fresh - Debt Manager Frontend

This is the frontend for the Chocair Fresh Debt Manager system. It is a static site built with vanilla HTML, CSS, and JavaScript.

## Deployment to Render

This frontend is designed to be deployed as a **Static Site** on Render. The deployment is managed via the `render.yaml` Blueprint file in the repository root.

### Automatic Deployment via Blueprint

The repository includes a `render.yaml` file that configures both frontend and backend services. When you connect your GitHub repository to Render using the Blueprint feature:

1.  **Go to Render Dashboard** → Click "New +" → Select "Blueprint"
2.  **Connect your GitHub repository**
3.  **Render will automatically detect** the `render.yaml` file and configure your services

### Manual Static Site Setup (Alternative)

If you prefer to set up the static site manually:

1.  **Push to GitHub:** Ensure this `frontend` folder is pushed to your GitHub repository.
2.  **Create New Static Site on Render:**
    *   Go to your Render Dashboard.
    *   Click "New +" -> "Static Site".
    *   Connect your GitHub repository.
3.  **Configure Settings:**
    *   **Name:** `dept-system-frontend` (or similar)
    *   **Root Directory:** `frontend` (This tells Render to serve files from this folder)
    *   **Build Command:** (Leave empty)
    *   **Publish Directory:** `.` (relative to the root directory)
4.  **Deploy:** Click "Create Static Site".

### Configuration

The frontend is configured to communicate with the backend at:
`https://dept-system.onrender.com`

If your backend URL changes, update the `BASE_URL` constant in `script.js`.

## Troubleshooting Deployment Issues

### Updates Not Appearing After Deploy

If your updates don't appear after deployment, try the following:

1. **Clear Render's build cache:**
   - Go to your service in the Render Dashboard
   - Click "Manual Deploy" dropdown
   - Select "Clear build cache & deploy"

2. **Clear browser cache:**
   - Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
   - Or clear your browser's cache in settings

3. **Verify auto-deploy is enabled:**
   - In your Render Dashboard, go to your service settings
   - Ensure "Auto-Deploy" is set to "Yes"

### Cache Headers

The `render.yaml` file includes cache headers configuration to prevent browser caching issues:
```yaml
headers:
  - path: /*
    name: Cache-Control
    value: no-cache, no-store, must-revalidate
```

This ensures browsers always fetch the latest version of your files.
