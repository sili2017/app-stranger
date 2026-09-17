# Cloud test environment — setup runbook

Companion to `infra/docker/docker-compose.cloud.yml`. Covers the one-time manual
setup only Claude Code cannot do (no remote access to the Strato server, and account
creation/billing needs a human) — see `docs/architecture/decisions.md` for the
architecture this deploys.

## 1. Strato Windows server: Docker Desktop + WSL2 + OpenSSH

Run these over RDP, in an elevated PowerShell.

```powershell
# WSL2 + a Linux distro (reboot if prompted, then re-run to finish setup)
wsl --install -d Ubuntu

# Install Docker Desktop for Windows manually from
# https://www.docker.com/products/docker-desktop/ — during setup, enable
# "Use WSL 2 based engine" and enable integration with the Ubuntu distro
# (Docker Desktop > Settings > Resources > WSL Integration).

# Cap WSL2's resource usage to fit the box's actual RAM. Adjust `memory`/`processors`
# to what the server actually has free — check first with:
Get-ComputerInfo | Select-Object CsTotalPhysicalMemory, CsNumberOfProcessors
```

`%UserProfile%\.wslconfig`:
```ini
[wsl2]
memory=4GB
processors=2
```

Restart WSL2 after editing: `wsl --shutdown` then reopen Ubuntu.

```powershell
# OpenSSH Server, for CI-driven deploys (.github/workflows/deploy.yml)
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Set-Service -Name sshd -StartupType Automatic
Start-Service sshd
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True `
  -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22

# Make PowerShell the default shell for SSH sessions, so deploy.yml's `shell:
# powershell` step behaves predictably.
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
  -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force
```

Create a dedicated deploy user (don't reuse your personal RDP login for CI) with a
password or key-based login, restricted if possible to just this directory. Then
clone the repo once by hand as that user:

```powershell
git clone https://github.com/sili2017/app-stranger.git C:\app-stranger
cd C:\app-stranger
Copy-Item infra\docker\.env.cloud.example infra\docker\.env.cloud
notepad infra\docker\.env.cloud   # fill in real values — see section 3 and 4 below
```

## 2. Firewall (both layers)

- **Windows Defender Firewall**: allow inbound 80, 443, 22 (the `sshd` rule above
  covers 22; add rules for 80/443 the same way, or Docker Desktop may add them when
  the containers first bind those ports).
- **Strato's hosting panel**: check for a separate network/security-group firewall
  in front of the OS — VPS providers commonly have one. Open the same three ports
  there too, and nothing else.

## 3. Find the server's static IP → sslip.io hostname

```powershell
# From the server itself:
(Invoke-WebRequest -UseBasicParsing https://api.ipify.org).Content
```

Turn `85.215.12.34` into `85-215-12-34.sslip.io` and set that as `SITE_ADDRESS` in
`infra/docker/.env.cloud`. Caddy (`docker/Caddyfile`) issues a real Let's Encrypt
certificate for it automatically on first start — no manual cert steps.

## 4. AWS S3 (media / ID-document storage — Phase B)

No app code needed; `services/media/src/storage/s3-storage.adapter.ts` already
implements this (`STORAGE_DRIVER=s3`). Create the bucket + a least-privilege IAM
user under your own AWS login:

```bash
aws s3api create-bucket --bucket stranger-media-test --region us-east-1
aws s3api put-bucket-encryption --bucket stranger-media-test \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket stranger-media-test \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws iam create-user --user-name stranger-media-test-service
aws iam put-user-policy --user-name stranger-media-test-service \
  --policy-name stranger-media-test-bucket-only \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::stranger-media-test/*"
    }]
  }'
aws iam create-access-key --user-name stranger-media-test-service
```

Put the resulting bucket name, region, access key, and secret into
`infra/docker/.env.cloud`'s `S3_BUCKET` / `AWS_REGION` / `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY`.

## 5. First manual deploy (before CI/CD exists / to verify by hand)

From the WSL2 Ubuntu shell or Windows PowerShell (Docker Desktop's CLI works from
either) in `C:\app-stranger`:

```powershell
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.cloud.yml `
  --env-file infra/docker/.env.cloud pull
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.cloud.yml `
  --env-file infra/docker/.env.cloud up -d
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.cloud.yml ps
```

The first `pull` only works once `.github/workflows/deploy.yml` has run at least
once on `main` and pushed images to GHCR (Phase C needs no account setup — it uses
the repo's built-in `GITHUB_TOKEN`, so it'll just work on the next push to `main`
once this file is merged).

## 6. GitHub repo configuration (for automated deploys — Phase C/D)

**Secrets** (Settings → Secrets and variables → Actions → Secrets):
- `STRATO_HOST` — the server's IP or sslip.io hostname
- `STRATO_SSH_USER` / `STRATO_SSH_KEY` — the deploy user from step 1, key-based auth
- `STRATO_APP_DIR` — `C:\app-stranger`
- `FIREBASE_APP_ID`, `FIREBASE_SERVICE_ACCOUNT` — from Firebase project setup below

**Variables** (same page, "Variables" tab — not secret, just the hostname):
- `SITE_ADDRESS` — the sslip.io hostname from step 3

## 7. Firebase App Distribution (Android test installs — Phase D)

1. Create a Firebase project (free Spark plan) at console.firebase.google.com.
2. Add an Android app using `apps/stranger_flutter/android`'s existing
   `applicationId` (check `apps/stranger_flutter/android/app/build.gradle`).
3. Enable App Distribution, create a tester group named `testers` (matches
   `deploy.yml`'s `--groups testers`), and invite your test devices' Google
   accounts/emails.
4. Create a service account (IAM & Admin → Service Accounts) with the
   "Firebase App Distribution Admin" role, generate a JSON key, and paste its full
   contents into the `FIREBASE_SERVICE_ACCOUNT` GitHub secret.
5. Copy the Firebase App ID (Project settings → General → your Android app) into
   `FIREBASE_APP_ID`.

iOS/TestFlight is intentionally deferred — it needs a paid Apple Developer Program
membership, a separate cost decision from this pass.
