FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY package.json package-lock.json /usr/src/app/
RUN npm ci --omit=dev
COPY . /usr/src/app
EXPOSE 3000
CMD [ "npm", "start" ]