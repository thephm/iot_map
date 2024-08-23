# Setup instructions for IoT Map

## Run

1. Startup so Mongo is running in a container

```shell
cd c:\data\src\iot_map
docker-compose up
```

2. Find the backup / mongo export

3. Import the data

```shell
cd c:\data
mongorestore --host dump\iotmap
```

## Backup

1. Use `mongodump` outside of the running container

```shell
mongodump --host localhost --db iotmap
```

---

## Older notes

### Setup instructions for IoT Map

- Install Mongo
	- https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/

- setup Mongo to start on boot
	- https://www.digitalocean.com/community/tutorials/how-to-install-mongodb-on-ubuntu-16-04


```shell
sudo nano /etc/systemd/system/mongodb.service
```

- paste this and save

```
[Unit]
Description=High-performance, schema-free document-oriented database
After=network.target

[Service]
User=mongodb
ExecStart=/usr/bin/mongod --quiet --config /etc/mongod.conf

[Install]
WantedBy=multi-user.target
```

- start Mongo

```shell
sudo systemctl start mongodb
```

- check Mongo has started

```shell
sudo systemctl status mongodb
```

- set Mongo to start on startup

```shell
sudo systemctl enable mongodb
```

- setup firewall so Mongo not accessible from Internet -- DO THIS LATER!
	- https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-16-04

- install Node.js (this one pointed to the 2nd link on setting up Production instance)
	- https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-16-04


```shell
sudo npm install
```

- see the list of packages installed by me

```shell
npm list -g --depth=0
```

- Install PM2

```shell
sudo npm install pm2 -g
ln -s /usr/bin/nodejs /usr/bin/node
```

- start an application

```shell
sudo pm2 start app.js
```

- If using Express then start the app like this:


```shell
pm2 start ./bin/www --name="app"
```

- List all running processes:

```shell
sudo pm2 list
┌──────────┬────┬──────┬──────┬────────┬─────────┬────────┬─────┬───────────┬──────────┐
│ App name │ id │ mode │ pid  │ status │ restart │ uptime │ cpu │ mem       │ watching │
├──────────┼────┼──────┼──────┼────────┼─────────┼────────┼─────┼───────────┼──────────┤
│ app      │ 0  │ fork │ 2713 │ online │ 6       │ 2M     │ 0%  │ 21.0 MB   │ disabled │
└──────────┴────┴──────┴──────┴────────┴─────────┴────────┴─────┴───────────┴──────────┘
```

- It will list all process. You can then stop / restart your service by using ID or Name of the app with following command.

```shell
sudo pm2 stop all
sudo pm2 stop 0
sudo pm2 restart all
```

- to display logs

```shell
sudo pm2 logs ['all'|app_name|app_id]
```

### HTTPS setup

- https://git.daplie.com/Daplie/greenlock-express

- install greenlock-express

```shell
npm install --save greenlock-express@2.x
```

- in app.js

```js
'use strict';

require('greenlock-express').create({

	server: 'https://acme-v01.api.letsencrypt.org/directory',
	email: 'iotmap@ownmail.net',
	agreeTos: true,
	approveDomains: ['iotmap.ca'],
	app: require('express')().use('/', function (req, res) {
		res.end('Hello, World!');
	})

}).listen(80, 443);
```

- Dump Mongo db, puts it in dump\iotmap


```shell
mongodump --db iotmap
```

- import a dump

```shell
mongorestore --db iotmap dump\iotmap
```

- install nginx proxy manager

- https://nginxproxymanager.jc21.com/

- start it

```shell
docker-compose up -d
```

- get container ID of mariadb

```shell
docker ps 
```

- get a shell in the DB container

```shell
docker exec -it af67b35d6c1b bash
```

- login to mariadb and change root password

```shell
mysql -u root -p
ALTER USER 'root'@'localhost' IDENTIFIED BY 'blah';
```

- access it!

```
http://iotmap.ca:81
```

- get container ID of nginx

```shell
docker exec -it f215c55baba9 bash
```

- check the config

```shell
nginx -t
```