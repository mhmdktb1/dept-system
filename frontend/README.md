# Chocair Fresh - Debt Manager Frontend

This is the frontend for the Chocair Fresh Debt Manager system. It is a static site built with vanilla HTML, CSS, and JavaScript.

## Deployment to Render

This frontend is designed to be deployed as a **Static Site** on Render.

### Steps to Deploy:

1.  **Push to GitHub:** Ensure this `frontend` folder is pushed to your GitHub repository.
2.  **Create New Static Site on Render:**
    *   Go to your Render Dashboard.
    *   Click "New +" -> "Static Site".
    *   Connect your GitHub repository.
3.  **Configure Settings:**
    *   **Name:** `chocair-fresh-frontend` (or similar)
    *   **Root Directory:** `frontend` (This is important! It tells Render to serve files from this folder)
    *   **Build Command:** (Leave empty)
    *   **Publish Directory:** `.` (or leave empty, it defaults to the root directory, which is `frontend` because of the setting above)
4.  **Deploy:** Click "Create Static Site".

### Configuration

The frontend is configured to communicate with the backend at:
`https://dept-system.onrender.com`

If your backend URL changes, update the `BASE_URL` constant in `script.js`.
