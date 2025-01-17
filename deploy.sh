#!/bin/bash

set -e

echo "Starting Ticketroo deployment..."

FRONTEND_DIR="client"
BACKEND_DIR="server"
FRONTEND_BUILD_DIR="/var/www/ticketroo"
BACKEND_ENTRY="src/index.js"

cd $FRONTEND_DIR
npm install
npm run build

sudo mkdir -p $FRONTEND_BUILD_DIR
sudo cp -r dist/* $FRONTEND_BUILD_DIR/

sudo chown -R www-data:www-data $FRONTEND_BUILD_DIR
sudo chmod -R 755 $FRONTEND_BUILD_DIR

cd ../$BACKEND_DIR
npm install

pm2 restart $BACKEND_DIR/$BACKEND_ENTRY --name ticketroo-backend || pm2 start $BACKEND_ENTRY --name ticketroo-backend

if curl -s http://localhost:80 | grep -q "Ticketroo"; then
  echo "Frontend is live!"
else
  echo "Frontend deployment verification failed. Please check the Nginx configuration."
fi

if curl -s http://localhost:3001/status; then
  echo "Backend is live!"
else
  echo "Backend deployment verification failed. Please check the backend logs."
fi

echo "Deployment complete!"
