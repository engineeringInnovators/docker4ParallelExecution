# Pipeline Script

## Node

```bash
node ('YOUR_SLAVE_NAME'){
  // Stages goes here 
}
```

| Properties           | Purpose                           |
| ---------            | --------------------------------- |
| YOUR_SLAVE_NAME      | Name of your slave/node which you created in jenkins "manage nodes and clouds" |


## Stage

```bash
node ('YOUR_SLAVE_NAME'){
  stage('NAME_OF_STAGE'){
    // Your pipeline script codes goes here
  } 
}
```

| Properties           | Purpose                           |
| ---------            | --------------------------------- |
| NAME_OF_STAGE        | Name of the stage. ex email, remove folder  |


## Stage for docker execution
This stage execute all of your script files which ends with .spec.js. 

├── ...
├── project_root            
│   ├── uiTests             
│   │   ├── configuration   
│   │   │   └── config.js   
│   │   ├── testScripts
│   │   │   ├── ....       
│   │   ├── ....         
│   └── ...              
└── ...

```bash
stage('Script execution'){
          
  sh '''#!/bin/sh
    DOCKERREPO="DockerForE2ETests"
    CODEREPO="<CODEREPO>"
    BRANCH_NAME="<BRANCH_NAME>"
    PORT="80"
    CLIENT_BASE_URL=""
    FOLDER_TO_READ=""
    NUMBER_OF_SPEC_TO_RUN_AT_ONE_GO=30
    
    # GIT url for Python Code To run script
    githubURL=git@github.wdf.sap.corp:sProcurementBlr/$DOCKERREPO.git
    # Script code
    githubURL2=git@github.wdf.sap.corp:sProcurementBlr/$CODEREPO.git
    
    # We do it this way so that we can abstract if from just git later on
    DOCKERREPO_VC_DIR=$DOCKERREPO/.git
    DOCKERREPO_VC_DIR2=$CODEREPO/.git
    
    if [ ! -d $DOCKERREPO_VC_DIR ]
    then
      echo "Cloning docker repo" 
      git clone $githubURL $DOCKERREPO
      cd $DOCKERREPO
      git show-branch
      ls -al;pwd
    else
      echo "Docker repo found. Removing test_volumes folder and Pulling updated code from repo"
      cd $DOCKERREPO
      sudo rm -rf test_volumes 
      git pull $githubURL
      git show-branch
      ls -al;pwd
    fi
    
    if [ -d $DOCKERREPO_VC_DIR2 ]
    then
        echo "Removing $CODEREPO repo" 
        sudo rm -rf $CODEREPO
    fi
    
    echo "Cloning $CODEREPO repo" 
    git clone -b $BRANCH_NAME $githubURL2 $CODEREPO
    cd $CODEREPO
    git checkout $BRANCH_NAME
    git show-branch
    cd uiTests
    sudo rm -rf node_modules/ package-lock.json/
    echo "Installing npm packages"
    npm i
    echo "Installation success"
    cd ..

    
    
    echo "Navigating to > reports/server"
    cd ../reports/server
    echo "current path reports/server"
    
    echo "Installing npm packages"
    npm i
        
    echo "Installing PM2 globally"
    sudo npm i -g pm2
    
    
    echo "Stopping if any $CODEREPO app is running "
    sudo pm2 stop $CODEREPO
    echo "Deleting if any $CODEREPO app is running "
    sudo pm2 delete $CODEREPO
    echo "Starting $CODEREPO app"
    sudo PORT=$PORT pm2 start app.js --name=$CODEREPO
    cd ../..
    ids=$(docker ps -a -q)
    for id in $ids
    do
      echo "$id"
      docker stop $id && docker rm $id
    done
      pwd;ls -al
    sudo python3 main.py -d $CODEREPO -i vyper:latest -n $NUMBER_OF_SPEC_TO_RUN_AT_ONE_GO -b $CLIENT_BASE_URL -f $FOLDER_TO_READ'''
}
```

| Properties   | Purpose                           |
| ---------    | --------------------------------- |
| DOCKERREPO      | Repo name to run docker container        |
| CODEREPO        | Repo name of your vyper script           |
| BRANCH_NAME     | Branch to execute vyper script           |
| PORT            | In which port your report should be seen |
| CLIENT_BASE_URL | Client base url of your test system. By default baseUrl from config.js is fecthed, if not passed |
| FOLDER_TO_READ  | Path to Scripts. By default this will run all the scripts, if nor passed |
| NUMBER_OF_SPEC_TO_RUN_AT_ONE_GO | Number of container to spawn in one iteration |
| githubURL  | ssh url of the docker code |
| githubURL2 | ssh url of your vyper scripts | 


## Email

```bash    
    stage("email") {
          sh '''#!/bin/sh
                DOCKERREPO="DockerForE2ETests"
                NAME=$JOB_NAME$BUILD_NUMBER
                REPORT_URL="http://eca-docker.s2p.c.eu-nl-1.cloud.sap/"
                cd $DOCKERREPO
                sudo python3 email/email.py -n $NAME -u $REPORT_URL
                '''
        
        def file_path = 'DockerForE2ETests/email/output/'+env.JOB_NAME+env.BUILD_NUMBER+'.txt'
        
        if(fileExists(file_path)) {
            def data = readFile(file: file_path)
            
            mail body: data, 
                subject: "Status-End To End Tests - ${env.JOB_NAME} #${env.BUILD_NUMBER}", 
                to: 'thomsheer.ahamed@sap.com',
                mimeType:'text/html'
        }

    }
    
    stage("Remove Prev build") {
          sh '''#!/bin/sh
                BUILD_TO_KEEP=15
                cd "DockerForE2ETests"
                sudo python3 remove_folders_from_results/remove.py -k $BUILD_TO_KEEP
                '''
    }
}
```