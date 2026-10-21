# iot_map

An interactive map of IoT organizations and products, built with Node.js, Express, MongoDB, EJS, and Google Maps.
This is an older project being maintained; many company and product links in the historical data may no longer work.

Select a category and subcategory to filter organizations and map markers.
Select an organization to see its details and products, or use the search field.
Category and subcategory counts show distinct organizations, not products or map markers.
Each subcategory count is scoped to its parent category; organizations with multiple matching products count only once.
Type pills beneath organization names summarize the hardware, software, and services provided across all their products, with each type shown only once.
The navbar shows database-wide totals for organizations, people, and embedded product records, refreshed on page load and independent of the selected category.
Use the Light/Dark switch beside search to change the page and road-map theme.
The default is light; your choice is saved in this browser and restored on reload.
Satellite imagery retains its original appearance.

Organization social links use inline SVG paths vendored from Material UI in [social-icons.json](config/social-icons.json), with the [upstream license](config/social-icons.LICENSE).
No external icon font, CDN, or React runtime is needed for these icons.
Links retain accessible names and tooltips; legacy GooglePlus links use the Google icon, and unrecognized services retain text labels.
Empty social URLs are omitted.

## Setup

### Configuration

Create a `.env` file in the repository root:

```dotenv
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
SESSION_SECRET=your_random_session_secret
SHOW_PRODUCT_URLS=false
```

Generate a session secret with Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SESSION_SECRET` is required; the app exits at startup if it is missing.
Production session cookies are secure, HTTP-only, and same-site.

Keep `.env` out of version control.
Docker Compose reads it at runtime, and `.dockerignore` excludes it from the image build context.
Do not bake secrets into an image.

| Variable | Purpose | Default |
| --- | --- | --- |
| `GOOGLE_MAPS_API_KEY` | Browser key for the Google Maps JavaScript API | Required for the map |
| `SESSION_SECRET` | Secret used to sign sessions | Required |
| `MONGODB_URI` | MongoDB connection URI, including the database name | Docker Compose: `mongodb://mongo:27017/iotmap`; required when running Node directly |
| `SHOW_PRODUCT_URLS` | Show product website URLs when set to exactly `true` | `false` |
| `PORT` | HTTP port used by Node | `3000`; Compose publishes it on host port `3030` |

### Run with Docker Compose

Install Docker with Compose, then run from the repository root:

```powershell
docker compose up -d --build
```

Open http://localhost:3030.
The local MongoDB service is available on port `27017`, with data persisted in the `mongodata` Docker volume.

To use Atlas instead of local MongoDB, add its connection URI as `MONGODB_URI` in `.env`.
Permit your IP in Atlas Network Access and use a database user with access to `iotmap`.
Do not commit the URI or credentials.

After code or dependency changes, rebuild with `docker compose up -d --build iot_map`.
Compose loads `.env` at runtime.
After changing an environment value, restart the app with `docker compose up -d iot_map`; dependency or source changes need an image rebuild.

### Run without Docker

Install Node.js 20.19 or newer and provide `MONGODB_URI` in `.env`, pointing to local MongoDB or Atlas:

```dotenv
MONGODB_URI=mongodb://localhost:27017/iotmap
```

```powershell
npm install
npm start
```

Open http://localhost:3000.

### Render deployment

Deploy the Dockerfile on Render and set the environment variables above in the service settings.
Use Atlas for `MONGODB_URI`; the local Compose MongoDB hostname is not available on Render.
Render provides these variables at runtime; `.env` is not included in the image.
Allow the Render service's outbound IP ranges (shown in its dashboard) in Atlas Network Access, and confirm the database user has access to `iotmap`.

The server waits for MongoDB before listening.
A failed connection logs `MongoDB startup failed` and exits instead of serving pages with buffered queries.
Check authentication, the URI's database name, and Atlas network access when diagnosing connection failures.

Automatic deploys require a pushed commit on the service's configured branch and auto-deploy enabled in Render.
Check build filters and any required CI checks if a push does not trigger a build.
Use **Manual Deploy > Deploy latest commit** to explicitly deploy the latest pushed revision.

## Data

The repository includes an organizations BSON dump in [dump/](dump/).
The people BSON file is in the external backup, not this repository; metadata files alone do not contain collection records.

See [setup notes](docs/setup.md) for restore and backup commands, including
the legacy first-name index that must be removed before importing people.
Check existing data before restoring: imports can partially succeed, and `--drop` replaces a collection.
Back up existing data before replacing it.
Treat people records and login-user backups as sensitive.

Public signup, the organization creation form, and the `/users` and `/users/:username` routes are removed.
Only accounts provisioned by an administrator can log in; there is no public account creation flow.
Login is rate-limited and protected by CSRF tokens; logout is a CSRF-protected POST.
Profile edits require authentication and CSRF protection.

[IoT Thing of Things.xlsx](docs/IoT%20Thing%20of%20Things.xlsx) is a backlog of companies and products that had not yet been added to MongoDB.

## Product website URLs

Product website URLs are hidden by default because many are outdated.
To show them, set `SHOW_PRODUCT_URLS=true` in `.env` or the application's environment.
Only the exact value `true` enables them.
This does not hide organization website links or GitHub links.
Products without a name display "Unnamed product" while their website URLs are hidden.

Restart the app after changing this setting. With Docker Compose, run
`docker compose up -d iot_map` to apply an environment change.

## Google Maps configuration

Enable the Maps JavaScript API and billing for your Google Cloud project.
Configure the browser API key in [Google Cloud credentials](https://console.cloud.google.com/apis/credentials):

- Restrict the key to the Maps JavaScript API.
- Use **Websites (HTTP referrers)** as the application restriction, allowing `http://localhost:3030/*` for Docker, `http://localhost:3000/*` for direct Node, and your deployed site's URL as needed.

The key is sent to the browser by design; referrer and API restrictions limit where it can be used.

## Original mockup

![](docs/IoT-Map-Mockup.png)
