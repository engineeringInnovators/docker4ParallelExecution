import os
import json
from argparse import ArgumentParser
import re
from typing import Dict

parser = ArgumentParser()

# parser.add_argument("-d", "--dir", dest="dirname",
#                     help="The folder\'s name that contains the tests.")
parser.add_argument("-n", "--filename", dest="filename",
                    help="The name of the file to create an html file")

args = parser.parse_args()

print(args.filename)

text = ""
latest = {}
root_dir = os.getcwd()
reports_dir = os.path.join(root_dir, "reports" + os.sep + 'server' + os.sep)
print(reports_dir)


if args.filename:
    with open("email/template.html", "r", encoding='utf-8') as f:
        text = f.read()
        f.close()

    meta_data = os.path.join(reports_dir, 'metadata.json')

    if os.path.isfile(meta_data):
        with open(meta_data) as json_file:
            meta = json.load(json_file)
            json_file.close()

        if(meta['latest']):
            file_structure = os.path.join(reports_dir, 'fileStructure.json')

            if os.path.isfile(file_structure):
                with open(file_structure) as json_file:
                    latest = json.load(json_file)
                    json_file.close()

                formated_date = str(meta['latest']).replace(
                    ".", "").replace(" ", "").replace(":", "")
                print(formated_date)

                for key, value in latest["files"].items():
                    print(key.replace(".", "").replace(" ", ""))
                    if str(formated_date) == str(key).replace(".", "").replace(" ", "").replace(":", ""):
                        data = value["totalCounts"]
                        print(data)
                        text = text.replace("{{TOTAL_TIME}}", str(data['totalExecutionTime'])).replace(
                            "{{TOTAL_SPECS}}", str(data['total'])).replace(
                            "{{TOTAL_PASSED}}", str(data['totalSpecs'])).replace(
                            "{{TOTAL_FAILED}}", str(data['failed']))

                        text = text.replace("{{BASE_URL}}", str(
                            meta[formated_date]['baseUrl'])).replace(" ", "").replace("\n", "")
                        print(text)
                        with open("email/output/"+args.filename+".txt", "w") as file:
                            file.write(text)
                            file.close()
                        break
