FROM nginx:alpine

COPY css/styles.css   /usr/share/nginx/html/css/styles.css
COPY fonts            /usr/share/nginx/html/fonts
COPY images           /usr/share/nginx/html/images
COPY js               /usr/share/nginx/html/js
COPY index.html       /usr/share/nginx/html/index.html
COPY projects         /usr/share/nginx/html/projects

RUN HASH=$(sha1sum /usr/share/nginx/html/css/styles.css | cut -c1-12) \
 && sed -i "s/__CSS_VERSION__/$HASH/" \
      /usr/share/nginx/html/index.html \
      /usr/share/nginx/html/projects/index.html
