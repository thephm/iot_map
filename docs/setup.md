# Database setup and backups

The regular application setup is in the [README](../README.md). This page
covers restoring and backing up MongoDB data.

## Restore the repository's organization data

The repository's `dump/` directory contains `organizations.bson` and its
metadata. The metadata files for `people`, `users`, and GridFS collections do
not include their records; those BSON files are not in this repository.

Start MongoDB with Docker Compose and copy the dump into the container:

```powershell
docker compose up -d mongo
docker compose cp dump/. mongo:/tmp/iotmap
```

To replace the `organizations` collection with the repository copy, run:

```powershell
docker compose exec mongo mongorestore --drop --db iotmap --collection organizations /tmp/iotmap/organizations.bson
```

`--drop` deletes the destination collection before restoring it. Back up any
data you need first. If you do not want to replace the collection, omit
`--drop`; documents with IDs already in the database can cause duplicate-key
errors, and a restore that reports errors may have imported only some records.

## Restore people data

The original `people.bson` is in the external backup, not this repository.
Restore that collection from the backup using MongoDB Database Tools, replacing
the example path with the location of the BSON file:

```powershell
mongorestore --host localhost --db iotmap --collection people "C:\path\to\people.bson"
```

For Atlas, provide the destination URI using the Database Tools' secure
configuration or password prompt. Check the existing collection before
importing: restores do not merge matching `_id` values, and failures can leave
a partial import. Do not use `--drop` unless replacing the collection is
intentional and backed up.

People can share a first name. On databases initialized with the old model,
check for and remove its unique index before restoring:

```javascript
use iotmap
db.people.getIndexes()
db.people.dropIndex("first_name_1")
```

Only drop `first_name_1` if it exists; retain the `_id_` index. Removing
`unique` from the model does not remove an existing database index.

## Back up a database

With the Compose MongoDB port published on localhost, install MongoDB Database
Tools on the host and run:

```powershell
mongodump --host localhost --db iotmap --out .\backup
```

This creates `backup/iotmap/`. Keep backups secure, especially those containing
people or login-user records, and verify the backup before replacing data.
