import shutil
import time
import re
import os
import json
from argparse import ArgumentParser
# import re
from typing import Dict

parser = ArgumentParser()

parser.add_argument("-k", "--buildstokeep", dest="builds_to_keep", default=10,
                    nargs="?", const=10, help="The name of the file to create an html file")

args = parser.parse_args()

if(args.builds_to_keep):
    args.builds_to_keep = int(args.builds_to_keep)

if(args.builds_to_keep < 10):
    print("Builds to keep is less than 10. Setting value to 10")
    args.builds_to_keep = 10

print("Total Number of build to keep: " + str(args.builds_to_keep))

root_dir = os.getcwd()
reports_dir = os.path.join(root_dir, "reports" + os.sep + 'server' + os.sep)
results_dir = os.path.join(root_dir, "reports" +
                           os.sep + 'server' + os.sep + 'results' + os.sep)


def replaceAllSpecialChar(val):
    return str(val).replace(":", "").replace(".", "").replace(" ", "")


def getFolderInResults():
    _data = os.path.join(reports_dir, 'fileStructure.json')
    if os.path.isfile(_data):
        with open(_data) as json_file:
            fileStructure = json.load(json_file)
            json_file.close()
        if len(fileStructure["dates"]) > 0:
            _list = fileStructure["dates"]
            print(_list)
            _list = _list[args.builds_to_keep:]
            _list = list(map(replaceAllSpecialChar, _list))
            return _list
        else:
            print("No files")
            return []
    else:
        return []


if args.builds_to_keep > 1:
    total_files = getFolderInResults()
    print(total_files)
    if(len(total_files) > 0):
        for item in os.listdir(results_dir):
            if item in total_files:
                print(str(item) in total_files)
                dir_path = os.path.join(results_dir, item)
                print(dir_path)
                print("Deleting previous txt dir: "+dir_path)
                shutil.rmtree(dir_path, ignore_errors=True)
                # os.removedirs(dir_path)

else:
    print("Build Must be positive number")
