# Deploying Liberty Lighthouse to Netlify

## Step 1: Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) and sign in (or create an account)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify to access your repos
4. Select the **liberty-lighthouse** repository

## Step 2: Configure Build Settings

Netlify should auto-detect these, but verify:

| Setting | Value |
|---------|-------|
| **Branch to deploy** | `main` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |

Click **"Deploy site"**.

## Step 3: Set Up the CMS (Decap CMS + Netlify Identity)

The CMS is already configured in the code. You just need to enable authentication:

### Enable Netlify Identity

1. In your Netlify dashboard, go to **Site settings** → **Identity**
2. Click **"Enable Identity"**
3. Under **Registration**, select **"Invite only"** (so only your team can access the CMS)
4. Under **External providers**, optionally add **Google** for easier login

### Enable Git Gateway

1. Still in **Site settings** → **Identity** → scroll down to **Services**
2. Click **"Enable Git Gateway"**
3. This lets the CMS commit changes to your GitHub repo on behalf of users

### Invite Your Team

1. Go to **Identity** tab in the Netlify dashboard
2. Click **"Invite users"**
3. Enter email addresses of people who should be able to edit content
4. They'll receive an email with a link to set their password

## Step 4: Access the CMS

Once deployed, your CMS lives at:

```
https://your-site-name.netlify.app/admin/
```

Users log in with the credentials from the invite email. They'll see:

- **Topics** — Create/manage topic categories
- **FAQs** — Write FAQ entries with a rich text editor
- **Videos** — Add YouTube videos with notes
- **Guided Syllabus** — Curate reading lists and resources

### What Users Can Do (No Technical Knowledge Needed)

- **Write content** using a toolbar (bold, italic, links, headings)
- **Upload images** by dragging and dropping into the editor
- **Save as draft** to work on something without publishing it
- **Pick topics** from a dropdown that updates automatically when new topics are created
- **Preview changes** before publishing

## Step 5: Custom Domain (Optional)

1. Go to **Domain management** in Netlify dashboard
2. Click **"Add a domain"**
3. Enter your domain (e.g., `libertylighthouse.in`)
4. Follow the DNS configuration instructions
5. Netlify provides free HTTPS automatically

## Troubleshooting

### CMS shows "Error loading the CMS configuration"
- Make sure Git Gateway is enabled (Step 3)
- Check that `public/admin/config.yml` exists and has `backend: git-gateway`

### Users can't log in to the CMS
- Confirm Identity is enabled and users were invited
- They should check their email (including spam) for the invite link
- The first login requires setting a password via the invite link

### Changes in the CMS don't appear on the site
- Netlify automatically rebuilds when the CMS publishes (it commits to GitHub)
- Builds take 1-2 minutes — check the **Deploys** tab for status
- If editorial workflow is on, content must be moved from "Draft" → "Ready" → "Published"

### Images don't show up
- Images uploaded via the CMS go to `public/images/content/`
- Make sure the image was actually uploaded (check the media library in the CMS)

## Architecture Notes

- **Static site**: Astro builds everything at deploy time. No server needed.
- **CMS**: Decap CMS runs entirely in the browser. It talks to GitHub via Netlify's Git Gateway.
- **Content**: Stored as `.mdx` files in the repo. The CMS just provides a friendly UI for editing them.
- **Images**: Stored in the repo under `public/images/content/`. Served as static files.
- **Builds**: Every CMS publish triggers a GitHub commit → Netlify auto-rebuilds → new version live in ~1-2 min.
