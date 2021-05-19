import time
import re
import os
import json
from argparse import ArgumentParser
# import re
from typing import Dict

parser = ArgumentParser()

# parser.add_argument("-d", "--dir", dest="dirname",
#                     help="The folder\'s name that contains the tests.")
parser.add_argument("-n", "--filename", dest="filename",
                    help="The name of the file to create an html file")
parser.add_argument("-u", "--url", dest="reporturl",
                    help="The url of displaying reports")

args = parser.parse_args()

print("Folder Name: " + args.filename)
print("Reports URL: " + args.reporturl)

text = ""
latest = {}
root_dir = os.getcwd()
reports_dir = os.path.join(root_dir, "reports" + os.sep + 'server' + os.sep)
output_dir = os.path.join(root_dir, "email" + os.sep + "output")
# print("output_dir: "+output_dir)

# try:
for subdir, dirs, files in os.walk(output_dir):
    # print(files.count())
    for file in files:
        file_path = os.path.join(output_dir, file)
        # print(file_path)
        print("Deleting previous txt file: "+file_path)
        os.remove(file_path)


url_regex = re.compile(
    r'^(?:http|ftp)s?://'  # http:// or https://
    # domain...
    r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'
    r'localhost|'  # localhost...
    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
    r'(?::\d+)?'  # optional port
    r'(?:/?|[/?]\S+)$', re.IGNORECASE)


def checkWhetherFileIsLocked():
    _data = os.path.join(reports_dir, 'metadata.json')
    if os.path.isfile(_data):
        with open(_data) as json_file:
            _meta = json.load(json_file)
            json_file.close()
        return _meta.get('locked', 0)
    else:
        return 1


time.sleep(10)

while(checkWhetherFileIsLocked()):
    print("File is still locked for reading.")
    time.sleep(10)

# and re.match(url_regex, args.reporturl)
if args.filename and re.match(url_regex, args.reporturl):
    with open("email/template.html", "r", encoding='utf-8') as f:
        text = f.read()
        f.close()

    meta_data = os.path.join(reports_dir, 'metadata.json')

    if os.path.isfile(meta_data):
        with open(meta_data) as json_file:
            meta = json.load(json_file)
            json_file.close()

        if(meta['latest']):
            file_structure = os.path.join(
                reports_dir, 'fileStructure.json')

            if os.path.isfile(file_structure):
                with open(file_structure) as json_file:
                    latest = json.load(json_file)
                    json_file.close()

                formated_date = str(meta['latest']).replace(
                    ".", "").replace(" ", "").replace(":", "")
                # print(formated_date)

                for key, value in latest["files"].items():
                    # print(key.replace(".", "").replace(" ", ""))
                    if str(formated_date) == str(key).replace(".", "").replace(" ", "").replace(":", ""):
                        data = value["totalCounts"]
                        # print(data)
                        text = text.replace("{{TOTAL_TIME}}", str(data['totalExecutionTime'])).replace(
                            "{{TOTAL_PASSED}}", str(data['passed'])).replace(
                            "{{TOTAL_FAILED}}", str(data['failed']))

                        text = text.replace(
                            "{{TOTAL_SPECS}}", str(meta[formated_date]['total'])).replace("{{BASE_URL}}", str(
                                meta[formated_date]['baseUrl'])).replace(" ", "").replace("#", " ").replace("\n", "")
                        # print("args.filename: " +args.filename)
                        text = text.replace("{{REPORT_URL}}", args.reporturl).replace(
                            "{{BUILD_DATE}}", key)
                        try:
                            file = open("email/output/" +
                                        args.filename+".txt", "w")
                            file.write(text)
                            # print(text)
                            file.close()
                        except OSError:
                            print("error creating file")
                        break

# except FileExistsError:
#     print("Error while deleting text files")
# else:
#     print("error")
