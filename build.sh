#!/bin/sh
# Install OS Dependencies
echo "Installing libssl-dev (if not installed already)"
# # libssl is for bcrypt in package.json
sudo apt-get -qq install libssl-dev

mkdir assets public

# DEV ONLY
ln -s ../assets/js public/js

# # Install Node packages
npm -s install

bower -s install

mkdir -p public/vendor/zeptojs.com
wget http://zeptojs.com/zepto.js -O public/vendor/zeptojs.com/zepto.js
