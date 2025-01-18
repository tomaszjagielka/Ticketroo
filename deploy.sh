#!/bin/bash

set -e

echo "Starting Ticketroo deployment..."

FRONTEND_DIR="client"
BACKEND_DIR="server"
FRONTEND_BUILD_DIR="/var/www/ticketroo"
BACKEND_ENTRY="index.js"
BACKEND_PORT=3004

# Build and Deploy Frontend
echo "Building frontend..."
cd $FRONTEND_DIR
npm install
#npm run build

sudo mkdir -p $FRONTEND_BUILD_DIR
sudo cp -r build/* $FRONTEND_BUILD_DIR/

sudo chown -R www-data:www-data $FRONTEND_BUILD_DIR
sudo chmod -R 755 $FRONTEND_BUILD_DIR

# Deploy Backend
echo "Deploying backend..."
cd ../$BACKEND_DIR/src
npm install
pm2 restart $BACKEND_ENTRY --name ticketroo-backend --update-env --env PORT=$BACKEND_PORT || pm2 start $BACKEND_ENTRY --name ticketroo-backend --update-env --env PORT=$BACKEND_PORT

# Synchronize PM2 process list
pm2 save

# Reload Nginx
echo "Reloading Nginx..."
sudo systemctl reload nginx

# Verify Deployment
echo "Verifying deployment..."

FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/status)

if [[ "$FRONTEND_STATUS" == "200" ]]; then
  echo "Frontend is live!"
else
  echo "Frontend deployment verification failed. Please check the Nginx configuration."
fi

if [[ "$BACKEND_STATUS" == "200" ]]; then
  echo "Backend is live!"
else
  echo "Backend deployment verification failed. Please check the backend logs."
fi

echo "Deployment complete!"
