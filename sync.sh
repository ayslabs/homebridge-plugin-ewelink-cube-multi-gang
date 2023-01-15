cd ..

# set BASE_PATH
BASE_PATH=$(pwd)

# server project path
SERVER_PATH="$BASE_PATH/cc.coolkit.it.ihost.homebridge.plugin.server"
# web project path
WEB_PATH="$BASE_PATH/cc.coolkit.it.ihost.homebridge.web"

# build server
cd $SERVER_PATH
npm run build

# build web
cd $WEB_PATH
npm run build

cd $BASE_PATH
pwd

echo "copying web code..."

# copy build web code to server
cp -r $WEB_PATH/dist/* $SERVER_PATH/lib/homebridge-ui/public

cd $SERVER_PATH
npm link

echo "success!!!"
