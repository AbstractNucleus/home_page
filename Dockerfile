FROM node:22-alpine AS build

WORKDIR /app
RUN npm install tailwindcss @tailwindcss/cli
COPY src/input.css src/input.css
COPY index.html index.html
RUN npx @tailwindcss/cli -i src/input.css -o dist/styles.css --minify
RUN HASH=$(sha1sum dist/styles.css | cut -c1-12) && sed -i "s/__CSS_VERSION__/$HASH/" index.html

FROM nginx:alpine
COPY --from=build /app/dist/styles.css /usr/share/nginx/html/css/styles.css
COPY --from=build /app/index.html /usr/share/nginx/html/index.html
