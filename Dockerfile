FROM node:24-bookworm-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json /usr/src/app/
RUN npm ci --omit=dev
COPY . /usr/src/app
EXPOSE 3000
CMD [ "npm", "start" ]