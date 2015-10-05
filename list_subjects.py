#!/usr/bin/env python
"""
Query a DICOM node using findscu, returns list of subjects.

> python list_subjects.py 128.54.39.72 11112
[
  {
    "StudyInstanceUID": "1.3.12.2.1107.5.2.6.23556.30000010060722383567100000623", 
    "SeriesInstanceUID": "1.3.6.1.4.1.21767.1276273464547.1000153281.4258", 
    "PatientID": "0370543 "
  },
  ...
]

Get a list of subjects only:
> python list_subjects.py 128.54.39.72 11112 | jq ".[].PatientID" | sort | uniq

Get studyinstanceuid for a single subject:
> python list_subjects.py 128.54.39.72 11112 | jq '[.[] | select(.PatientID|match("^9071628"))] | [.[].StudyInstanceUID] | unique'

or to get a list of all series that start with "3D-T1" in their series description:
> python list_subjects.py 128.54.39.72 11112 | jq '[.[] | select(.SeriesDescription| match("^3D-T1"))]'

Get a list of all series for a subject that match a series description



or to get a string of studyinstance uid etc from the matching entries:
> python list_subjects.py 128.54.39.72 11112 | jq '[.[] | select(.SeriesDescription| match("^3D-T1"))]' | jq ".[] | [.StudyInstanceUID, .SeriesInstanceUID, .PatientID, .SeriesDescription]" | jq  'map("\(.) ") | add'


What would be nice is as a REPL:
   read data from IP PORT
   for each subject with more than 1 study select the first series that matches "3D-T1" in its SeriesDescription
   show all selected series
   move selected series to IP PORT using AETitleCalled "BREWERDATA" and AETitleCaller "ME"

"""
import dicom
import tempfile
import subprocess
import sys
import re
import json
from subprocess import Popen, PIPE

if __name__ == "__main__":
    if len(sys.argv) == 3:
        # write a temporary file to build a dicom with the query information
        temp = tempfile.NamedTemporaryFile(mode='w+t',delete=False)
        temp2 = tempfile.NamedTemporaryFile(delete=False)
        #print "name of the temp file is:", temp.name
        temp.write("# Query all patient names and IDs with Patient Root model\n#\n(0008,0052) CS [PATIENT]     # QueryRetrieveLevel\n(0010,0010) PN []    # PatientsName\n(0010,0020) LO []    # PatientID\n(0020,000d) UI []    # StudyInstanceUID\n(0020,000e) UI []    # SeriesInstanceUID\n(0008,103e) LD []    # StudyInstanceUID")
        temp.close()
        temp2.close()
        try:
            e = subprocess.check_output([ "/Applications/dcmtk/bin/dump2dcm", "+te", temp.name, temp2.name ])
        except OSError as e:
            print >>sys.stderr, "Execution of dump2dcm failed:", e
        
        try:
            cmd="/Applications/dcmtk/bin/findscu -v -S -k 0008,0052=\"SERIES\" -aec myself -aet OsiriX " + sys.argv[1] + " " + sys.argv[2] + " " + temp2.name
            #print cmd
            # data = subprocess.check_output(cmd, shell=True, stderr=sys.stdout)
            p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE, close_fds=True)
            data1, data = p.communicate()
            #print "returned data is: \"", data, "\""
        except OSError as e:
            print >>sys.stderr, "Execution of findscu failed:", e
        #W: (0008,103e) LO [2D-Axial-Diffusion-Weighted-Imaging-1000000084105197] #  52, 1 SeriesDescription
        #W: (0010,0010) PN [0491837 ]                               #   8, 1 PatientName
        #W: (0020,000d) UI [1.3.12.2.1107.5.2.6.23556.30000010060722383567100000623] #  56, 1 StudyInstanceUID
        #W: (0020,000e) UI [1.3.6.1.4.1.21767.1271461564987.1949003514.8020] #  48, 1 SeriesInstanceUID
        vars = re.compile(r'\(0008,103e\) LO \[([^\]]+)\].*[\n\r]+W: \(0010,0010\) PN \[([^\]]+)\].*[\n\r]+.*[\n\r]+W: \(0020,000d\) UI \[([^\]]+)\].*[\n\r]+W: \(0020,000e\) UI \[([^\]]+)\]', re.MULTILINE)
        data2 = []
        for match in vars.finditer(data):
            seriesdescription, patientid, studyinstanceuid, seriesinstanceuid = match.groups()
            #print "PatientID: ", patientid, " StudyInstanceUID: ", studyinstanceuid, " SeriesInstanceUID: ", seriesinstanceuid
            data2.append( { 'PatientID': patientid, 'StudyInstanceUID': studyinstanceuid, 'SeriesInstanceUID': seriesinstanceuid, 'SeriesDescription': seriesdescription } );

        val = json.dumps(data2,indent=2)
        print(val)

        #erg = re.findall( r'\(0010,0010\) PN \[([^\]]+)\]', data)
        #print erg
        #val=json.dumps(erg,indent=2)
        #print(val)
    else:
        print "Error: wrong number of arguments, we require an IP and a PORT"
