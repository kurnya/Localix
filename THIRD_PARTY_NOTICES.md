# Third-Party Notices

Localix itself is freeware; see [LICENSE](LICENSE). Release builds bundle the following third-party software, which is distributed under its own license. These components are not modified by Localix, and their license files are included in the `runtime/` folder of each build.

| Component | Version | License | Project |
|---|---|---|---|
| Apache HTTP Server (Apache Lounge build) | 2.4.67 | Apache License 2.0 | https://httpd.apache.org/ · https://www.apachelounge.com/ |
| PHP | 8.4.22 | PHP License 3.01 | https://www.php.net/ |
| MySQL Community Server | 9.6.0 | GNU GPL v2 (with Universal FOSS Exception) | https://www.mysql.com/ |
| phpMyAdmin | 5.2.3 | GNU GPL v2 | https://www.phpmyadmin.net/ |
| Composer | 2.9.8 | MIT License | https://getcomposer.org/ |
| Electron (includes Chromium and Node.js) | 31.x | MIT License (Chromium and Node.js components under their own licenses) | https://www.electronjs.org/ |

License files in a build:

- Apache: `runtime/apache/Apache24/LICENSE.txt`, `NOTICE.txt`
- PHP: `runtime/php/<version>/license.txt`
- MySQL: `runtime/mysql/LICENSE`
- phpMyAdmin: `runtime/phpmyadmin/LICENSE`
- Electron: `app-bin/LICENSE.electron.txt`, `app-bin/LICENSES.chromium.html`

MySQL and phpMyAdmin are licensed under the GPL. They run as separate programs managed by Localix and are not linked into Localix. Their source code is available from the project sites listed above.

All trademarks belong to their respective owners.
