# ABC Exam Portal — Step-by-Step Deployment Guide

> This guide assumes you have never deployed anything before.
> Every step is explained. Every command is copy-pastable.
> You will only need to SSH into the server **once** (for the first-time setup).
> After that, every code update goes live with just `git push`.

---

## What You Will End Up With

```
Internet
   │
   ▼
Your domain (e.g. osssc.in)
   │
   ├── student.osssc.in  →  Student portal (Next.js)
   ├── admin.osssc.in    →  Admin portal   (Next.js)
   └── api.osssc.in      →  Backend API    (Go)
```

Everything runs inside Docker containers on your Hostinger KVM 8 VPS.
When you push code to GitHub, it automatically rebuilds and redeploys — you do nothing.

---

## Prerequisites (Things to Have Ready)

Before starting, make sure you have:

- [ ] A **GitHub account** and this project pushed to a GitHub repository
- [ ] A **Hostinger account** with the KVM 8 VPS purchased and active
- [ ] A **domain name** (e.g. `osssc.in`) with DNS managed through Hostinger or Cloudflare
- [ ] **Node.js 22** installed on your local machine (to run `scripts/deploy.js`)
- [ ] **Git** installed on your local machine

---

## Concept: What is "deploying" actually doing?

Think of it like this:

1. Your code lives on your laptop
2. You push it to **GitHub** (a cloud backup of your code)
3. **GitHub Actions** (a robot that runs in the cloud) sees the push, builds your app into a **Docker image** (a self-contained package of your app + everything it needs to run), and stores that image on **GHCR** (GitHub's container storage)
4. GitHub Actions then calls the **Hostinger API** and says "hey, pull the new image and restart"
5. Your VPS pulls the new image and your live site updates

You never touch the server again after the first setup.

---

## PHASE 1 — One-time GitHub Setup

### Step 1 — Push your code to GitHub

If you haven't already:

1. Go to [github.com](https://github.com) → click **New repository**
2. Name it `abc-exam-portal`, set it to **Private**, click **Create repository**
3. In your project folder, open a terminal and run:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/abc-exam-portal.git
git branch -M main
git push -u origin main
```

> Replace `YOUR-USERNAME` with your actual GitHub username.

---

### Step 2 — Add GitHub Secrets

**What is a secret?** A secret is a password or token that your GitHub workflow needs but that you never want written in your code files. GitHub stores them encrypted and only injects them when the workflow runs.

You need to add **6 secrets**. Here is where to go:

1. Open your repository on GitHub
2. Click **Settings** (top menu bar of the repo)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** for each one below

| Secret Name | What to put in the Value field |
|---|---|
| `HOSTINGER_API_TOKEN` | Your Hostinger API token — see Step 3 below for how to get it |
| `HOSTINGER_VM_ID` | Your VPS numeric ID — see Step 4 below for how to find it |
| `NEXT_PUBLIC_API_URL` | `https://api.osssc.in/api` (replace with your actual domain) |
| `NEXT_PUBLIC_WS_URL` | `wss://api.osssc.in` (replace with your actual domain) |

> You will come back and add `HOSTINGER_API_TOKEN` and `HOSTINGER_VM_ID` after Steps 3 and 4.

---

### Step 3 — Get your Hostinger API Token

1. Log into [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Click your profile icon (top right) → **API**
3. Click **Generate new token**
4. Give it a name like `abc-exam-deploy`
5. Set expiry to **Never** (or 1 year — your choice)
6. Click **Generate** — **copy the token immediately**, you won't see it again
7. Go back to GitHub and paste it as the value for `HOSTINGER_API_TOKEN`

---

### Step 4 — Find your VPS ID

1. In hPanel, click **VPS** in the top menu
2. Click on your KVM 8 server
3. Look at the URL in your browser — it will look like:
   `https://hpanel.hostinger.com/vps/123456/overview`
4. That number (`123456`) is your VM ID
5. Go back to GitHub and paste it as the value for `HOSTINGER_VM_ID`

---

### Step 5 — Create a GitHub Environment called "production"

The workflow uses a `production` environment for the deploy job. You need to create it:

1. In your GitHub repo → **Settings** → **Environments** (left sidebar)
2. Click **New environment**
3. Name it exactly: `production`
4. Click **Configure environment**
5. You can leave everything default — just click **Save protection rules**

---

## PHASE 2 — One-time VPS Setup (SSH required — only this once)

### Step 6 — Connect to your VPS via SSH

**What is SSH?** It's a secure way to type commands on a remote computer (your VPS) from your laptop's terminal.

#### On Windows (PowerShell):
```powershell
ssh root@YOUR_VPS_IP_ADDRESS
```
> Your VPS IP is on the hPanel VPS overview page. Example: `ssh root@123.45.67.89`

When prompted, type your VPS root password (shown in hPanel when you first set up the VPS).

You should now see a prompt like `root@vps-123456:~#` — you are now "inside" your VPS.

---

### Step 7 — Install SSL certificates (HTTPS)

**What is SSL?** It makes your site use `https://` instead of `http://`. Without it, browsers will show scary "Not Secure" warnings and block some features.

First, point your DNS. Go to your domain's DNS settings (Cloudflare or Hostinger DNS) and add these **A records**:

| Subdomain | Points to |
|---|---|
| `student` | Your VPS IP address |
| `admin` | Your VPS IP address |
| `api` | Your VPS IP address |

Wait 5–10 minutes for DNS to propagate, then run on the VPS:

```bash
apt update && apt install -y certbot
certbot certonly --standalone \
  -d student.osssc.in \
  -d admin.osssc.in \
  -d api.osssc.in
```

> Replace `osssc.in` with your actual domain everywhere.

When asked for an email, enter yours. When asked to agree to terms, type `Y`.

If successful you will see:
```
Congratulations! Your certificate and chain have been saved at:
/etc/letsencrypt/live/student.osssc.in/fullchain.pem
```

---

### Step 8 — Create the project folder and secrets file on the VPS

```bash
mkdir -p /root/abc-exam
cd /root/abc-exam
nano .env.production
```

This opens a text editor. Paste the following, **filling in your real values** everywhere you see `CHANGE_ME` or a placeholder:

```env
# Server
PORT=8081
ENV=production

# Database — these are the username/password for your Postgres database
# Make these strong, random passwords. You are creating them right now.
DB_USER=abc_exam
DB_PASSWORD=CHANGE_ME_make_this_long_and_random
DB_NAME=abc_exam

# Redis password — make this strong too
REDIS_PASSWORD=CHANGE_ME_redis_password

# Auth — generate a random 32-character string for JWT_SECRET
# You can generate one at: https://generate-secret.vercel.app/32
JWT_SECRET=CHANGE_ME_32_char_random_string
JWT_EXPIRY_MIN=15
REFRESH_TOKEN_EXPIRY_DAYS=7

# Payment — your live Razorpay credentials
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_razorpay_secret_here
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret_here

# Email — your SMTP provider credentials (e.g. Brevo, Mailgun, Postmark)
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM=noreply@osssc.in

# Storage
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=/app/storage

# Your actual live domain URLs
FRONTEND_URL=https://student.osssc.in
ADMIN_URL=https://admin.osssc.in
BACKEND_URL=https://api.osssc.in

# Container registry — your GitHub username, lowercase
REGISTRY=ghcr.io/your-github-username-lowercase
API_TAG=latest
STUDENT_TAG=latest
ADMIN_TAG=latest
```

**To save and exit nano:** press `Ctrl+X`, then `Y`, then `Enter`.

---

### Step 9 — Make the secrets file only readable by root

```bash
chmod 600 /root/abc-exam/.env.production
```

This makes it so only the root user can read this file.

---

### Step 10 — Make your GHCR images public (or configure pull access)

By default, GitHub Container Registry images are private. The easiest option for a start is to make them public:

1. After your first push triggers a build (Phase 3), go to your GitHub profile
2. Click **Packages** tab
3. Click on `abc-exam-api` (or any of the packages)
4. Click **Package settings** → scroll to **Danger Zone** → **Change visibility** → **Public**
5. Repeat for `abc-exam-student` and `abc-exam-admin`

> If you want to keep them private, you'll need to configure Docker pull credentials on the VPS — that's covered in the Appendix at the bottom.

---

## PHASE 3 — First Deploy

### Step 11 — Set up the deploy script on your local machine

The `scripts/deploy.js` file is already in your project. You need to tell it your credentials when running it locally.

Create a file called `.env.deploy` in your project root (it is already gitignored — it will never be committed):

```env
HOSTINGER_API_TOKEN=your_token_from_step_3
HOSTINGER_VM_ID=123456
```

To use it when running the deploy script, you need to load it first. On Windows PowerShell:

```powershell
# Load the .env.deploy file into your shell session
Get-Content .env.deploy | ForEach-Object {
  if ($_ -match '^([^#][^=]+)=(.+)$') {
    [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), 'Process')
  }
}
```

Or on any platform, you can simply set them inline:
```powershell
$env:HOSTINGER_API_TOKEN = "your_token_here"
$env:HOSTINGER_VM_ID     = "123456"
```

---

### Step 12 — Trigger your first push to start the image build

In your project folder, make any small change (or just run):

```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```

Now go to your GitHub repo → **Actions** tab. You will see a workflow running called **Build & Deploy**. Click on it to watch it run.

The first run will take **5–10 minutes** because it has to:
- Install all npm packages
- Build the Next.js apps
- Compile the Go binary
- Package everything into Docker images
- Push 3 images to GHCR

After the build jobs finish, the deploy job will try to run — **it will fail** because you haven't done the first-time deploy yet. That's expected. Continue to Step 13.

---

### Step 13 — Run the first deploy from your local machine

Once the images are built and sitting in GHCR (check the **Packages** tab on your GitHub profile to confirm), run from your project folder:

```bash
node scripts/deploy.js deploy
```

This sends your `docker-compose.yml` file to Hostinger, which then starts all 6 containers on your VPS (postgres, redis, api, student, admin, nginx).

You should see output like:
```
🚀  Creating project "abc-exam" on VM 123456...
✅  Project creation triggered.
    Action ID: 789
```

Wait about 60 seconds, then check if everything is running:

```bash
node scripts/deploy.js status
```

You should see all 6 containers with 🟢 status.

---

### Step 14 — Verify the site is live

Open a browser and go to:
- `https://student.osssc.in` — should show the student login page
- `https://admin.osssc.in` — should show the admin login page
- `https://api.osssc.in/health` — should show `{"status":"ok","service":"abc-exam-portal-api","env":"production"}`

If all three work, **you are live**. 🎉

---

## PHASE 4 — All Future Deploys (Automatic)

From this point forward, here is your entire deployment workflow:

```
1. Write code in your IDE
2. git add .
3. git commit -m "your message"
4. git push origin main
5. ☕ Wait ~2 minutes
6. ✅ Live site is updated
```

You do not need to SSH, run any scripts, or do anything else.

GitHub Actions handles everything automatically:
- Detects which parts of the code changed
- Only rebuilds the images that need rebuilding
- Pushes new images to GHCR
- Calls Hostinger API to pull new images and restart containers
- Verifies containers are healthy

---

## Appendix A — Viewing Logs When Something Goes Wrong

### Option 1: From your local machine
```bash
node scripts/deploy.js logs
```
Shows the last 300 log lines from all containers.

### Option 2: From GitHub Actions
Click the **Actions** tab in your repo → click the latest workflow run → click any job to see its full output.

### Option 3: From hPanel
Log into hPanel → VPS → your server → **Docker** tab (only available on Managed Docker). You can see projects, containers, and basic logs here.

---

## Appendix B — Keeping Private GHCR Images (Advanced)

If you want your Docker images to stay private:

1. Create a GitHub **Personal Access Token** (PAT) with `read:packages` scope:
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
   - Check only `read:packages`
   - Copy the token

2. SSH into your VPS and run:
   ```bash
   echo "YOUR_PAT_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```

3. Docker will now be able to pull your private images on the VPS.

---

## Appendix C — Rotating Secrets / Changing Credentials

If you ever need to change a password or API key:

1. SSH into VPS: `ssh root@YOUR_VPS_IP`
2. Edit the secrets file: `nano /root/abc-exam/.env.production`
3. Change the value, save, exit
4. Restart the containers to pick up new values:
   ```bash
   node scripts/deploy.js restart
   ```
   Or if you changed database credentials, do a full redeploy:
   ```bash
   node scripts/deploy.js update
   ```

---

## Appendix D — SSL Certificate Renewal

Let's Encrypt certificates expire every 90 days. Certbot sets up **automatic renewal** on install. To verify auto-renewal is set up:

```bash
systemctl status certbot.timer
```

To manually force a renewal test:
```bash
certbot renew --dry-run
```

After renewal, restart nginx to pick up the new cert:
```bash
node scripts/deploy.js restart
```

---

## Appendix E — Quick Reference Command Sheet

```bash
# ── Deploy ─────────────────────────────────────────────────────
node scripts/deploy.js deploy    # first-time only: create project on VPS
node scripts/deploy.js update    # pull latest images + recreate containers
node scripts/deploy.js restart   # restart containers without pulling new images

# ── Monitor ────────────────────────────────────────────────────
node scripts/deploy.js status    # show all containers + health
node scripts/deploy.js logs      # show last 300 log lines

# ── Nuclear option ─────────────────────────────────────────────
node scripts/deploy.js down --confirm   # DESTROYS everything (use only if needed)

# ── SSH into VPS ───────────────────────────────────────────────
ssh root@YOUR_VPS_IP

# ── Edit secrets on VPS ────────────────────────────────────────
nano /root/abc-exam/.env.production

# ── Check SSL cert status ──────────────────────────────────────
ssh root@YOUR_VPS_IP "certbot certificates"
```

---

## Summary: What You Did and Why

| Phase | What you did | Why |
|---|---|---|
| GitHub Setup | Pushed code, added secrets | GitHub needs your code; secrets let the CI/CD robot authenticate |
| VPS Setup | SSH'd in, got SSL certs, created `.env.production` | One-time server prep; SSL for HTTPS; secrets stored safely on server |
| First Deploy | Ran `deploy.js deploy` | Sent compose file to Hostinger; started all containers for the first time |
| Future deploys | Just `git push` | GitHub Actions handles everything automatically from here |
