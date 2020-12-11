# Reports Server

This directory is to watch results and create a overall reports using node js. [Client end](../reports-client/README.md) of the the application in written in angular.



# Prerequisites

- [nodejs](https://nodejs.org/en/) (created with v14.15.0)


# Run Command

1. `cd reports/server` from root folder
2. `npm i`
3. `npm i pm2 -g` (one time run)
4. `pm2 start app.js --name=<any-name>` (<any-name> can be any name for the app)
5. `pm2 list` (to check app status)
6. `pm2 restart <given-name>` (<give-name> is the above <any-name>) To restart if there are any changes 


## Note:
If you want to change any UI changes please refer [here](../reports-client/README.md)