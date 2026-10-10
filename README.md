# Localix

![Localix Logo](website/assets/img/logo.png)

**Website:** [www.localix.my.id](https://www.localix.my.id) · **Documentation:** [Installation Guide](docs/installation.md) · [Download Latest Release](https://github.com/kurnya/Localix/releases/latest) · [Release Notes](https://github.com/kurnya/Localix/releases)

Localix is a simple local server manager for Windows. It helps you run Apache, PHP, MySQL, phpMyAdmin, local projects, Virtual Hosts, and Laravel project workflows from one clean desktop app.

Localix is built for local web development: start your stack quickly, keep projects in one `www` folder, and manage common server tasks without opening multiple config files.

![Localix Dashboard](website/assets/img/localix-dashboard.png)

## Download

Download the latest public release here:

https://github.com/kurnya/Localix/releases/latest

Available release files:

- `localix.setup.exe` - standard Windows installer.
- `localix.<version>.x64.exe` - portable Windows build.
- `SHA256SUMS.txt` - checksum file for verification.

For full setup steps, read:

[Installation Guide](docs/installation.md)

## Features

**Simple Control Panel**  
Start, stop, and restart Apache and MySQL from one desktop app.

**Bundled Local Stack**  
Apache 2.4, PHP 8.4, MySQL 9.6, phpMyAdmin, and Composer are included in the release build.

**PHP Version Manager**  
Install, update, and switch PHP 8.2 to 8.5 and phpMyAdmin from the PHP page. Downloads come from the official sites and are verified with SHA-256. Switch the active PHP version from the dashboard or the tray menu.

**PHP Extensions and php.ini**  
Toggle extensions and edit common `php.ini` settings with checkboxes. Custom directives are tested before they are applied.

**PHP in the Terminal (optional)**  
Add the active PHP and Composer to the Windows PATH so `php artisan` and `composer` use the same version and settings as Localix.

**Clean Localhost Dashboard**  
The `localhost` page shows Localix branding, server status, ports, phpMyAdmin access, and detected projects.

**Live Project Scanner**  
Projects inside the `www` folder are scanned while the app is running. The Projects page updates automatically.

**No MySQL Windows Service**  
MySQL runs as a Localix-managed process and stores data inside the Localix data folder.

**Virtual Hosts**  
Generate local domains such as:

```text
http://my-project.locx
```

**Laravel Helper**  
Create Laravel projects directly from Localix using Composer.

**Logs and Maintenance Tools**  
View Localix, Apache, MySQL, and PHP logs. Check ports, repair the phpMyAdmin config, and reinitialize MySQL data from Settings.

**Theme Support**  
Use light, dark, or system theme.

## Quick Start

1. Download `localix.setup.exe` from the latest release.
2. Install and open Localix.
3. Click `Start All`.
4. Open:

```text
http://localhost
http://localhost/phpmyadmin
```

5. Put your projects inside the `www` folder.

Default ports:

```text
Apache: 80
MySQL: 3306
```

If port `80` is already used by another app, run Localix as Administrator or change the Apache port in Settings.

## Project Folder Rules

- Put project folders directly inside `www`.
- `phpmyadmin` is reserved and ignored by the project scanner.
- Laravel projects use the `public` folder automatically when available.

Example:

```text
www/my-project -> http://localhost/my-project/
```

## Virtual Hosts

Virtual Hosts are optional. Turn on `Virtual host` on the Projects page and folders inside `www` can be accessed with `.locx` domains.

Example:

```text
www/my-project -> http://my-project.locx
```

Add the entries to the Windows hosts file (use `Copy hosts entry` or `Buka hosts file` on the Projects page):

```text
127.0.0.1 my-project.locx
```

Hosts file location:

```text
C:\Windows\System32\drivers\etc\hosts
```

If a new project's domain is missing, click `Regenerate` on the Projects page.

## Security Notice

Localix is currently distributed as an unsigned Windows app. Windows SmartScreen or antivirus software may show an unknown publisher warning because the app is new and includes local server binaries.

Only download Localix from the official GitHub Releases page:

https://github.com/kurnya/Localix/releases

You can verify release files with `SHA256SUMS.txt`.

## Repository

This repository contains the Localix website, documentation, changelog, and release downloads. The application source code is not public.

```text
docs/       Installation guide
website/    Source of www.localix.my.id (deployed with GitHub Pages)
```

Bug reports and feature requests are welcome in [Issues](https://github.com/kurnya/Localix/issues).

## License

Localix is free to download and use. See [LICENSE](LICENSE) for the terms. Bundled third-party components keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
