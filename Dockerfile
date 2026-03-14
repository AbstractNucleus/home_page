FROM node:22-alpine AS build

WORKDIR /app
RUN npm install tailwindcss @tailwindcss/cli
COPY src/input.css src/input.css
COPY index.html index.html
RUN npx @tailwindcss/cli -i src/input.css -o dist/styles.css --minify

FROM nginx:alpine
COPY --from=build /app/dist/styles.css /usr/share/nginx/html/css/styles.css
COPY index.html /usr/share/nginx/html/index.html
