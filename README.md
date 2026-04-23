# SocialSync — Backend

Deployed on **Railway**. Node.js + Express + Socket.io + MongoDB.

## Deploy to Railway

1. Push this folder to a GitHub repo (e.g. `socialsync-backend`)
2. Go to railway.app → "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Go to **Variables** tab and add these env vars:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | your mongodb connection string |
| `JWT_SECRET` | `social-gathering-123` |
| `PORT` | `3000` |
| `ALLOWED_ORIGINS` | `https://YOUR-NETLIFY-SITE.netlify.app` |

5. Railway gives you a URL like `https://socialsync-production.up.railway.app`
6. Copy that URL → paste into frontend `index.html` as `BASE_URL`
