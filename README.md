# Reports

More [detail](./reports/README.md)

# Troubleshooting

## Login into system using ssh key

Open your terminal and run below command where your private key is placed 
`ssh -i <PRIVATE_KEY> ccloud@<IP_ADDRESS>`

<PRIVATE_KEY> is the name of the private key.

Note: For Windows you need to run it in git bash

## Docker images

Ensure docker image is created by name `vyper`. To check docker images in system `docker images`

If you did not find any images with named vyper then follow below steps

1. Go to worspace folder `cd /home/ccloud/workspace`
2. Check your slave by typing `ls`. Then cd into your slave. ex .`cd docker-vyper-fxu`
3. Navigate into DockerForE2ETests by `cd DockerForE2ETests` and ensure DockerFile exists
4. Run `docker build --no-cache -t vyper .` to create a docker image by name vyper

## Create a mount of project

1. Go to worspace folder `cd /home/ccloud/workspace`
2. `docker run -it --name devtest2 -v "$(pwd)"/<your-slave>:/mnt vyper /bin/bash`

## To run a spec file
1. `cd /mnt/DockerForE2ETests`
2. `vyper config.js --specs=<path_to_your_spec_file>`