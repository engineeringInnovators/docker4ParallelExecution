import os
import time
from datetime import datetime
import docker
import shutil
from argparse import ArgumentParser

parser = ArgumentParser()
parser.add_argument("-d", "--dir", dest="dirname", help="The folder\'s name that contains the tests.")
parser.add_argument("-i", "--image", dest="docker_image", help="The docker image to download.")
parser.add_argument("-n", "--number", dest="containers_number", help= "The maximum number of containers that will be running simultaneously. 5 is the default value. 0 for unlimited number ")
args = parser.parse_args()
dateTimeObj = datetime.now()
if args.containers_number:
    max_containers_up = int(args.containers_number)
else:
    max_containers_up = 5
list_containers = []
final_destination = '/opt/destination/results'
if args.dirname and args.docker_image:
    main_folder = dateTimeObj.strftime("%d%b%Y%H%M%S")
    main_folder_path = os.path.join(final_destination,main_folder)
    os.mkdir(main_folder_path)
    templ_script = 'tplstart.sh'
    selected_test = '/tmp/test/config.js'
    # Select the tests directories
    work_dir = os.getcwd() + os.sep + args.dirname
    root_dir = os.getcwd()
    volumes_dir = os.path.join(root_dir,'test_volumes')
    os.mkdir(volumes_dir)
    docker_client = docker.from_env()
    # vyper_image = docker_client.images.pull(args.docker_image,tag='latest')
    vyper_image = args.docker_image
    docker_client.images.build(path=root_dir, tag=args.docker_image)
    # search for the config.js file
    for subdir, dirs, files in os.walk(work_dir):
        for file in files:
            filepath = os.path.join(subdir,file)
            filename = file
            search_config = 'configuration' + os.sep + 'config.js'
            if  filepath.endswith(search_config):
                config_path = os.path.join(root_dir,filename)
                shutil.copy(filepath,config_path)
    # Get the number of tests to run
    tests_number = 0
    for subdir, dirs, files in os.walk(work_dir):
        for file in files:
            filepath = os.path.join(subdir,file)
            filename = file
            if filepath.endswith(".spec.js"):
                tests_number += 1
    print ('There will be ' + str(tests_number) + ' containers to be created')
    left_containers = tests_number
    # Browse every file in the directory with its path
    for subdir, dirs, files in os.walk(work_dir):
        for file in files:
            filepath = os.path.join(subdir,file)
            filename = file
            if filepath.endswith(".spec.js"):
                while len(docker_client.containers.list()) >= max_containers_up and  max_containers_up != 0:
                    time.sleep(5)
                    print ("max permitted number of running container reached")
                    print ("waiting for running containers")
                # Create a volume for every container and put all needed files in it
                container_volume = os.path.join(volumes_dir,filename)
                os.mkdir(container_volume)
                run_script = os.path.join(container_volume,'start.sh')
                source_config = os.path.join(root_dir,'config.js')
                dest_config = os.path.join(container_volume,'config.js')
                shutil.copy(source_config,dest_config)
                relative_workdir = os.path.join(container_volume,args.dirname)
                shutil.copytree(work_dir,relative_workdir)
                # Update start.sh file to call the selected test
                with open(templ_script,"r") as file:
                    text=file.readlines()
                    file.close()
                filepath = '/vyper' + os.sep + os.path.relpath(filepath, root_dir) # use the path of the container
                i = 0
                while i < len(text):
                    if selected_test in text[i]:
                        text[i]=text[i].replace(selected_test,filepath)
                    i += 1
                with open(run_script,"w") as file:
                    file.writelines(text)
                    file.close()
                docker_client.containers.run(vyper_image, volumes={container_volume:{'bind': '/vyper', 'mode': 'rw'}}, detach=True, name=filename, command="/bin/bash /vyper/start.sh  ")
                list_containers.append(docker_client.containers.get(str(filename)).id)
                if len(list_containers) < tests_number:
                    for container in list_containers:
                        created_containers = docker_client.containers.list(all=True)
                        list_ids = []
                        for artifact in created_containers:
                            list_ids.append(artifact.id)
                        if container in list_ids:
                            print(docker_client.containers.get(container).name + ' : ' + docker_client.containers.get(container).status)
                            if docker_client.containers.get(container).status == 'exited':
                                container_object = docker_client.containers.get(container)
                                container_name = container_object.name
                                print ('First Cleaning the container: ' + container_name)
                                container_volume = os.path.join(volumes_dir,container_name)
                                container_object.remove(v=False)
                                left_containers = left_containers - 1
                                container_name = container_name[:-3]
                                result_folder = os.path.join(container_volume,'results')
                                if os.path.isdir(result_folder):
                                    new_results_name = os.path.join(main_folder_path,container_name)
                                    shutil.move(result_folder, new_results_name)
                                    os.listdir(main_folder_path)
                                    # Change the files and folders permission for security purposes
                                    for root, dirs, files in os.walk(new_results_name):
                                        for dir in [os.path.join(root,d) for d in dirs]:
                                            os.chown(dir, 1000, 1000)
                                            os.chmod(dir, 0o755)
                                        for file in [os.path.join(root, f) for f in files]:
                                            os.chown(file, 1000, 1000)
                                            os.chmod(file, 0o644)
                elif len(list_containers) == tests_number:
                    while left_containers > 0:
                        print ('Waiting For containers to finish')
                        for container in list_containers:
                            created_containers = docker_client.containers.list(all=True)
                            list_ids = []
                            for artifact in created_containers:
                                list_ids.append(artifact.id)
                            if container in list_ids:
                                if docker_client.containers.get(container).status == 'exited':
                                    container_object = docker_client.containers.get(container)
                                    container_name = container_object.name
                                    print ('Cleaning the container: ' + container_name)
                                    container_volume = os.path.join(volumes_dir,container_name)
                                    container_object.remove(v=False)
                                    left_containers = left_containers - 1
                                    container_name = container_name[:-3]
                                    result_folder = os.path.join(container_volume,'results')
                                    if os.path.isdir(result_folder):
                                        new_results_name = os.path.join(main_folder_path,container_name)
                                        shutil.move(result_folder, new_results_name)
                                        # Change the files and folders permission for security purposes
                                        for root, dirs, files in os.walk(new_results_name):
                                            for dir in [os.path.join(root,d) for d in dirs]:
                                                os.chown(dir, 1000, 1000)
                                                os.chmod(dir, 0o755)
                                            for file in [os.path.join(root, f) for f in files]:
                                                os.chown(file, 1000, 1000)
                                                os.chmod(file, 0o644)


    # delete the containers volumes
    if volumes_dir:
        shutil.rmtree(volumes_dir)
else:
    print ('Arguments Missing')
