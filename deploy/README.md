# Beelink server setup

Runs Jellyfin in Docker on a Beelink mini PC, with GPU transcoding and streaming from outside your home. About 30–45 minutes start to finish.

## 1. Find out which chip you have

Check the sticker on the bottom of the Beelink or the box:

- **Intel** (N100, N150, N200, N305, Core i3/i5): the best case. Quick Sync handles several 4K transcodes at once.
- **AMD Ryzen** (SER5, SER6, SER7, SER8): works fine using VA-API, just slightly less efficient than Intel.

The setup below is the same for both. The only difference is one setting in step 5.

## 2. Install the operating system

1. Download **Ubuntu Server 24.04 LTS** and flash it to a USB stick with [balenaEtcher](https://etcher.balena.io/).
2. Boot the Beelink from the USB stick (press F7 at power-on for the boot menu) and install. Tick **Install OpenSSH server** when asked.
3. Plug it into your router with Ethernet, not Wi-Fi.
4. Give it a fixed address: in your router's settings, reserve the Beelink's current IP (usually called "DHCP reservation").

Everything after this can be done over SSH from another computer: `ssh youruser@<beelink-ip>`.

## 3. Install Docker and get this folder

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in so the group change takes effect.

git clone -b plex https://github.com/xEpitheTx/jellyfin-web.git
cd jellyfin-web/deploy
cp .env.example .env
```

## 4. Configure and start

1. Confirm the GPU is visible: `ls /dev/dri` should list `renderD128`.
2. Get the three numbers for `.env`:
   ```sh
   id                                   # uid= goes in PUID, gid= goes in PGID
   getent group render | cut -d: -f3    # goes in RENDER_GID
   ```
3. Edit `.env` (`nano .env`): set those numbers, your time zone, and `MEDIA_DIR` (the folder holding your media).
4. Start it: `docker compose up -d`
5. Open `http://<beelink-ip>:8096` in a browser and follow the setup wizard. When adding libraries, your media is under `/media` inside Jellyfin.

**Folder layout that matches well:**
```
/mnt/media/Movies/Movie Name (2010)/Movie Name (2010).mkv
/mnt/media/Shows/Show Name/Season 01/Show Name S01E01.mkv
```

## 5. Turn on GPU transcoding

Dashboard → Playback → Transcoding:

- **Intel:** Hardware acceleration: **Intel QuickSync (QSV)**.
  - Tick every codec under "Enable hardware decoding for" (on N100/N150, include HEVC 10bit, VP9 and AV1).
  - Tick **Enable hardware encoding** and both **Low-Power** encoder options.
  - Tick **Enable Tone mapping** (makes HDR movies look right on normal screens).
- **AMD:** Hardware acceleration: **Video Acceleration API (VA-API)**, device `/dev/dri/renderD128`.
  - Tick the codecs your chip supports (H264, HEVC, HEVC 10bit, VP9; AV1 only on Ryzen 7000 and newer).
  - Tick **Enable hardware encoding** and **Enable Tone mapping**.

Test it: play a movie, open the gear menu → pick a lower quality, then Dashboard → Activity should show "Transcoding" with the hardware codec listed. If playback fails, send me the log from Dashboard → Logs.

## 6. Plex-style extras (recommended)

- **Scrubbing thumbnails:** Dashboard → Libraries → edit each library → tick **Enable trickplay image extraction**. The first run takes a while.
- **Skip Intro / Skip Credits:** Dashboard → Plugins → Catalog → install **Intro Skipper** (add its repository first if it isn't listed; see the plugin's GitHub page), restart the container, then let its scheduled task run.
- **Subtitles:** install the **Open Subtitles** plugin from the catalog.

## 7. Watching from outside your home

Pick one.

### Option A: Tailscale (easiest, most secure)

No ports opened on your router, and it works with any internet provider.

1. On the Beelink: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`
2. Install Tailscale on each phone, laptop and Fire Stick (it's in the Amazon Appstore) and sign in to the same account.
3. In the Jellyfin app, use the server address `http://<beelink-tailscale-name>:8096` (shown in the Tailscale app).

The downside is that everyone needs Tailscale installed. For family in other households, you can share the machine with them from the Tailscale admin page.

### Option B: your own domain (works on any device, no extra app)

Requires a public IP from your internet provider. To check: compare the "WAN IP" in your router's status page with https://ifconfig.me. If they differ, your provider uses CGNAT and this option won't work; use Tailscale.

1. Buy a domain (~$10/year; Cloudflare Registrar or Porkbun) and add an **A record** such as `watch.yourdomain.com` pointing to your home IP. If your home IP changes, set up dynamic DNS (most routers have this built in).
2. On your router, forward ports **80** and **443** to the Beelink.
3. In `.env`: set `DOMAIN=watch.yourdomain.com` and `PUBLIC_URL=https://watch.yourdomain.com`.
4. Start with Caddy: `docker compose --profile caddy up -d`
5. In Jellyfin: Dashboard → Networking → add `caddy` under **Known proxies**, then restart: `docker compose restart jellyfin`.
6. Open `https://watch.yourdomain.com` from your phone on mobile data to test.

**Security for option B:** your server is on the public internet, so:
- Use strong, unique passwords for every Jellyfin user, especially admins.
- Keep Jellyfin updated (step 8).
- Don't make admin accounts for other people.

Don't use Cloudflare Tunnel for this. Cloudflare's terms prohibit video streaming on its free plan, and accounts get cut off.

## 8. Install our Plex-style web interface

Our version of the web interface (merged Continue Watching, recommendations, Plex-style details page, typo-tolerant search) is built automatically whenever the `plex` branch changes. To install or update it:

```sh
cd ~/jellyfin-web/deploy
git pull
./update-web.sh
```

The first run also switches `docker-compose.yml` over to the new interface. Refresh the browser afterwards (Ctrl+Shift+R).

If something looks wrong, go back to the previous version with `./update-web.sh --rollback`. The Fire Stick and phone apps are unaffected either way.

## 9. Fire TV Stick app

Our Fire Stick app shows the same Plex-style home rows as the web interface. It installs next to the regular Jellyfin app as **Jellyfin+**.

One-time setup on the Fire Stick:

1. **Settings → My Fire TV → About**, then click **Fire TV Stick** 7 times until it says you're a developer.
2. **Settings → My Fire TV → Developer options → Install unknown apps**, and turn it on for **Downloader** (install Downloader from the Amazon Appstore first if it isn't listed).
3. Open **Downloader**, type this address, and install when prompted:

   `https://github.com/xEpitheTx/jellyfin-androidtv/releases/download/plex-latest/jellyfin-androidtv-plex.apk`

4. Open **Jellyfin+**, add your server (`http://<beelink-ip>:8096`, or your Tailscale / domain address away from home) and sign in.

To update, repeat step 3; your sign-in is kept.

## 10. Updating Jellyfin


```sh
cd ~/jellyfin-web/deploy
docker compose pull && docker compose up -d
```

Your settings and watch history live in `config/`. Back that folder up occasionally.
