import os
import time
from datetime import datetime
import docker
import shutil
from argparse import ArgumentParser
import json
import re

# Key to replace in tplstart.sh for base url passed in jenkins. If not passed, baseUrl from config.js is assigned
selected_base_url = "client_base_url"

parser = ArgumentParser()
parser.add_argument("-d", "--dir", dest="dirname",
                    help="The folder\'s name that contains the tests.")
parser.add_argument("-i", "--image", dest="docker_image",
                    help="The docker image to download.")
parser.add_argument("-b", "--clientbaseurl", default="-", nargs="?", const="-", dest=selected_base_url, required=False,
                    help="The baseurl of the client system to be executed in.")
parser.add_argument("-f", "--folder", default="", nargs="?", const="", dest="folder_to_read",
                    required=False, help="folder from where to read")
parser.add_argument("-n", "--number", default=50, dest="containers_number",
                    help="The maximum number of containers that will be running simultaneously. 5 is the default value. 0 for unlimited number ")
# parser.add_argument("-f", "--string", dest="targeted_server", help= "")
args = parser.parse_args()
##### Initiating the global variables #######
dateTimeObj = datetime.now()
if args.containers_number:
    max_containers_up = int(args.containers_number)
else:
    max_containers_up = 50

if args.folder_to_read:
    folder_to_read = str(args.folder_to_read).replace(
        "/", os.sep).replace("\\", os.sep)
else:
    folder_to_read = ""

args.to_run = 3
# Assigning baseurl from arg if passed. Or default baseurl will be assigned in get_config_file() funtion
client_base_url = ""
url_regex = re.compile(
    r'^(?:http|ftp)s?://'  # http:// or https://
    # domain...
    r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'
    r'localhost|'  # localhost...
    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
    r'(?::\d+)?'  # optional port
    r'(?:/?|[/?]\S+)$', re.IGNORECASE)

if args.client_base_url and re.match(url_regex, args.client_base_url):
    client_base_url = args.client_base_url

print("client_base_url " + client_base_url)

list_containers = []
list_containers_failed = []
job_endtime = 'Job still ongoing'
# Commented below line for testing
# final_destination = '/home/ccloud/reports/server/results/'
work_dir = os.getcwd() + os.sep + str(args.dirname)
folder_to_read = os.path.join(work_dir, folder_to_read)
root_dir = os.getcwd()
# Changed results folder path
reports_dir = os.path.join(root_dir, "reports" + os.sep + 'server' + os.sep)
final_destination = os.path.join(reports_dir, 'results' + os.sep)

print("final_destination: " + final_destination)
main_folder = dateTimeObj.strftime("%d%b%Y%H%M%S")
main_folder_path = os.path.join(final_destination, main_folder)
volumes_dir = os.path.join(root_dir, 'test_volumes')
docker_client = docker.from_env()
templ_script = 'tplstart.sh'
# Selected test file to replace in tplstart.sh with actual test file
selected_test = '/tmp/test/config.js'


##### Declaring all functions needed ########


def get_config_file(client_base_url):
    '''
    Get the config file from the tests repository and put it in the roor folder
    '''
    for subdir, dirs, files in os.walk(work_dir):
        for file in files:
            filepath = os.path.join(subdir, file)
            filename = file
            search_config = 'configuration' + os.sep + 'config.js'
            if filepath.endswith(search_config):
                config_path = os.path.join(root_dir, filename)
                shutil.copy(filepath, config_path)
                if not client_base_url:
                    with open(config_path) as config_file:
                        _lines = config_file.readlines()
                        config_file.close()
                    print("-----------------base------------------------")
                    for line in _lines:
                        line = line.strip()
                        if(re.search("^baseUrl[ ]?:[ ]*\"(http.*)\"", line)):
                            print(
                                re.search("^baseUrl[ ]?:[ ]*\"(http.*)\"", line).groups()[0])
                            client_base_url = re.search(
                                "^baseUrl[ ]?:[ ]*\"(http.*)\"", line).groups()[0]
                            break

                    print("-----------------------------------------")
                print("Default client_base_url: " + client_base_url)
    return client_base_url


def get_testfiles_number():
    '''
    Calculate the number of the tests that script will be running
    '''
    tests_number = 0
    for subdir, dirs, files in os.walk(folder_to_read):
        for file in files:
            filepath = os.path.join(subdir, file)
            # filename = file
            if filepath.endswith(".spec.js"):
                print("file: " + file)
                tests_number += 1
    print("___________________________")
    print("Total specs in " + folder_to_read + " is " + str(tests_number))
    print("___________________________")
    return tests_number


def build_start_script(filepath, client_base_url):
    '''
    Update start.sh file to call the selected test
    '''
    with open(templ_script, "r") as file:
        text = file.readlines()
        file.close()
    # use the path of the container
    filepath = '/vyper' + os.sep + os.path.relpath(filepath, root_dir)
    i = 0
    while i < len(text):
        if selected_test in text[i]:
            text[i] = text[i].replace(selected_test, filepath)
        if selected_base_url in text[i]:
            text[i] = text[i].replace(selected_base_url, client_base_url)
        i += 1
    # print(text)
    with open(run_script, "w") as file:
        file.writelines(text)
        file.close()


def prepare_results_report(container):
    '''
    Moving the results folder to its destination and removing the exited container
    '''
    container_object = docker_client.containers.get(container)
    container_name = container_object.name
    print('{} |  Cleaning the container: {}'.format(
        datetime.now().strftime("%H:%M:%S"), container_name))
    container_volume = os.path.join(volumes_dir, container_name)
    logs = container_object.logs()
    spec_failed = False
    if re.search("] E/launcher - Process exited with error code", str(logs)):
        print("error found")
        spec_failed = True
    if args.to_run == 0 and not spec_failed:
        container_object.remove(v=False)
    else:
        args.to_run = args.to_run - 1
        print("Rerunning the container " + (3 - args.to_run))
        container_object.restart()
    container_name = container_name[:-3]
    result_folder = os.path.join(container_volume, 'results')
    # print("result_folder: " + result_folder)
    if os.path.isdir(result_folder):
        new_results_name = os.path.join(main_folder_path, container_name)
        print("new_results_name: " + new_results_name)
        if spec_failed:
            print("remove the results")
        else:
            print("Moving results folder into destination results folder") 
            shutil.move(result_folder, new_results_name)
            # Change the files and folders permission for security purposes
            os.chown(new_results_name, 1000, 1000)
            os.chmod(new_results_name, 0o755)
            for root, dirs, files in os.walk(new_results_name):
                for dir in [os.path.join(root, d) for d in dirs]:
                    os.chown(dir, 1000, 1000)
                    os.chmod(dir, 0o755)
                for file in [os.path.join(root, f) for f in files]:
                    os.chown(file, 1000, 1000)
                    os.chmod(file, 0o644)
    else:
        list_containers_failed.append(container_name)
        print("--------------------------------------------------------")
        print("Script could have syntax error: " + result_folder)
        print("--------------------------------------------------------")


def build_metadata(total, starttime, endtime, inprogress, client_base_url):
    # metadata_file = os.path.join(main_folder_path,'metadata.json')
    # metadata_file = '/home/ccloud/reports/server/metadata.json'
    # Changed relative path
    metadata_file = os.path.join(reports_dir, 'metadata.json')
    completed = total - inprogress
    if endtime == 'Job still ongoing':
        totalexecutiontime = '-'
    else:
        totalexecutiontime = endtime - starttime
        totalexecutiontime = int(totalexecutiontime.seconds / 60)
        endtime = endtime.strftime("%d%b%Y%H%M%S")
    new_data = {
        main_folder: {
            "total": total,
            "inProgress": inprogress,
            "completed": completed,
            "executionStartTime": starttime.strftime("%d%b%Y%H%M%S"),
            "executionEndTime": endtime,
            "totalExecutionTime": totalexecutiontime,
            "baseUrl": client_base_url
        }
    }
    if os.path.isfile(metadata_file):
        with open(metadata_file) as json_file:
            data = json.load(json_file)
        data.update(new_data)
    else:
        data = new_data
    with open(metadata_file, 'w') as f:
        json.dump(data, f, indent=4)
    os.chown(metadata_file, 1000, 1000)
    os.chmod(metadata_file, 0o644)


def update_latest_running_file():
    metadata = os.path.join(reports_dir, 'metadata.json')

    if os.path.isfile(metadata):
        with open(metadata) as json_file:
            data = json.load(json_file)
        data.update({"latest": main_folder})
    else:
        data = {"latest": main_folder}
    with open(metadata, 'w') as f:
        json.dump(data, f, indent=4)
    os.chown(metadata, 1000, 1000)
    os.chmod(metadata, 0o644)


###### The main script #####################
if args.dirname and args.docker_image:
    if not os.path.exists(final_destination):
        os.makedirs(final_destination)
    try:
        print("creating folder : " + main_folder_path)
        os.mkdir(main_folder_path)
    except OSError:
        print("Creation of the directory %s failed" % main_folder_path)
    else:
        print("Successfully created the directory %s " % main_folder_path)
    # print(main_folder_path + " Folder created")
    os.chown(main_folder_path, 1000, 1000)
    os.chmod(main_folder_path, 0o644)
    os.mkdir(volumes_dir)
    # vyper_image = docker_client.images.pull(args.docker_image,tag='latest')
    vyper_image = args.docker_image
    docker_client.images.build(path=root_dir, tag=args.docker_image)
    client_base_url = get_config_file(client_base_url)
    tests_number = get_testfiles_number()
    print('{} |  There will be {} containers to be created'.format(
        datetime.now().strftime("%H:%M:%S"), str(tests_number)))
    print('The results will be stored at {}'.format(main_folder_path))
    left_containers = tests_number
    update_latest_running_file()
    # Browse every file in the directory with its path
    for subdir, dirs, files in os.walk(folder_to_read):
        for file in files:
            filepath = os.path.join(subdir, file)
            filename = file
            if filepath.endswith(".spec.js") and filename:
                while len(docker_client.containers.list()) >= max_containers_up and max_containers_up != 0:
                    time.sleep(5)
                    print('{} |  max permitted number of running container reached'.format(
                        datetime.now().strftime("%H:%M:%S")))
                    print('{} |  waiting for running containers'.format(
                        datetime.now().strftime("%H:%M:%S")))
                # Create a volume for every container and put all needed files in it
                container_volume = os.path.join(volumes_dir, filename)
                os.mkdir(container_volume)
                run_script = os.path.join(container_volume, 'start.sh')
                # print("run_script path " +run_script)
                source_config = os.path.join(root_dir, 'config.js')
                dest_config = os.path.join(container_volume, 'config.js')
                shutil.copy(source_config, dest_config)
                relative_workdir = os.path.join(container_volume, args.dirname)
                shutil.copytree(work_dir, relative_workdir)
                build_start_script(filepath, client_base_url)
                docker_client.containers.run(vyper_image, volumes={container_volume: {
                                             'bind': '/vyper', 'mode': 'rw'}}, detach=True, name=filename, command="/bin/bash /vyper/start.sh")
                print('{} |  {} : is created'.format(datetime.now().strftime(
                    "%H:%M:%S"), docker_client.containers.get(filename).name))
                list_containers.append(
                    docker_client.containers.get(str(filename)).id)
                # Get the first container creation time
                if len(list_containers) == 1:
                    job_starttime = datetime.now()
                if len(list_containers) < tests_number:
                    for container in list_containers:
                        created_containers = docker_client.containers.list(
                            all=True)
                        list_ids = []
                        for artifact in created_containers:
                            list_ids.append(artifact.id)
                        if container in list_ids:
                            if docker_client.containers.get(container).status == 'exited':
                                # pass number of time retrigger should happen as an argument
                                # failedScripts as array - push failed job into the list by checking the job status in combined.json
                                # ask asif when we should I trigger failed jobs
                                # Make "run container" function as generic function
                                # Maintain results of retriggered jobs in same folder, which is created earlier
                                # Delete failed specs in results folder before retriggering
                                prepare_results_report(container)
                                left_containers = left_containers - 1
                                build_metadata(
                                    tests_number, job_starttime, job_endtime, left_containers, client_base_url)
                elif len(list_containers) == tests_number:
                    print('{} |  All containers are created! Waiting for the running ones'.format(
                        datetime.now().strftime("%H:%M:%S")))
                    while left_containers > 0:
                        for container in list_containers:
                            created_containers = docker_client.containers.list(
                                all=True)
                            list_ids = []
                            for artifact in created_containers:
                                list_ids.append(artifact.id)
                            if container in list_ids:
                                if docker_client.containers.get(container).status == 'exited':
                                    prepare_results_report(container)
                                    left_containers = left_containers - 1
                                    build_metadata(
                                        tests_number, job_starttime, job_endtime, left_containers, client_base_url)
                    if left_containers == 0:
                        job_endtime = datetime.now()
                        build_metadata(tests_number, job_starttime,
                                       job_endtime, left_containers, client_base_url)
    # delete the containers volumes
    if volumes_dir:
        shutil.rmtree(volumes_dir)
    if(len(list_containers_failed) > 0):
        print("Below are the list of containers which did not had results folder")
        for container in list_containers_failed:
            print(container)
else:
    print('Arguments Missing')
