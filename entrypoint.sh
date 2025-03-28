#!/bin/sh

# Create certificates directory
mkdir -p /etc/nginx/certs

# Generate ECDSA self-signed SSL certificate
echo 'Generating ECDSA self-signed SSL certificate...'
openssl ecparam -name prime256v1 -genkey -noout -out /etc/nginx/certs/nginx.key
openssl req -new -key /etc/nginx/certs/nginx.key -out /etc/nginx/certs/nginx.csr -subj "/CN=localhost"
openssl x509 -req -in /etc/nginx/certs/nginx.csr -signkey /etc/nginx/certs/nginx.key -out /etc/nginx/certs/nginx.crt
rm /etc/nginx/certs/nginx.csr
chmod 400 /etc/nginx/certs/nginx.key
chmod 444 /etc/nginx/certs/nginx.crt

# Write nginx config
cat > /etc/nginx/nginx.conf << EOF
events {}
http {
    server {
        listen 0.0.0.0:8443 ssl;
        server_name localhost;

        ssl_certificate /etc/nginx/certs/nginx.crt;
        ssl_certificate_key /etc/nginx/certs/nginx.key;

        location / {
            proxy_pass http://core:8000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        location = / {
            proxy_pass http://demosite:8006/index.html;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }

        location /examples {
            proxy_pass http://demosite:8006/examples;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
        }
    }
}
EOF

# Start nginx
exec nginx 
