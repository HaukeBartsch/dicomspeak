#!/usr/bin/env python
"""
Query a DICOM node using findscu, returns list of subjects. In order to support long
queries the script will query for all study instance uids first. For each of those a
second query for the series is performed. No query using patient information is used
because OsiriX for example only supports Study and Series level findscu queries.

This script depends on the dcmtk tools to be available in '/Applications/dcmtk/bin/'.

Usage:
 > python list_subjects.py 128.54.39.72 11112
 [
  {
    "StudyInstanceUID": "1.3.12.2.1107.5.2.6.23556.30000010060722383567100000623", 
    "SeriesInstanceUID": "1.3.6.1.4.1.21767.1276273464547.1000153281.4258", 
    "PatientID": "0370543 "
  },
  ...
 ]

Examples:

Get a list of subjects only:
> python list_subjects.py 128.54.39.72 11112 | jq ".[].PatientID" | sort | uniq

Get studyinstanceuid for a single subject:
> python list_subjects.py 128.54.39.72 11112 | jq '[.[] | select(.PatientID|match("^9071628"))] | [.[].StudyInstanceUID] | unique'

or to get a list of all series that start with "3D-T1" in their series description:
> python list_subjects.py 128.54.39.72 11112 | jq '[.[] | select(.SeriesDescription| match("^3D-T1"))]'

or to get a string of studyinstance uid etc from the matching entries:
> python list_subjects.py 128.54.39.72 11112 | jq '[.[] | select(.SeriesDescription| match("^3D-T1"))]' | jq ".[] | [.StudyInstanceUID, .SeriesInstanceUID, .PatientID, .SeriesDescription]" | jq  'map("\(.) ") | add'

TODO: A single query for all study instance uids could be too large (hit max on returned entries). In that case we
      should query for subsets of Studies - can this be done by time? (findscu question)
"""
import dicom
import tempfile
import subprocess
import sys
import re
import json
import string
from subprocess import Popen, PIPE

if __name__ == "__main__":
    if len(sys.argv) == 3:
        # write a temporary file to build a dicom with the query information
        temp = tempfile.NamedTemporaryFile(mode='w+t',delete=False)
        temp2 = tempfile.NamedTemporaryFile(delete=False)
        #print "name of the temp file is:", temp.name
        temp.write("# Query all patient names and IDs with Patient Root model\n#\n(0008,0052) CS [PATIENT]     # QueryRetrieveLevel\n(0010,0010) PN []    # PatientsName\n(0010,0020) LO []    # PatientID\n(0020,000d) UI []    # StudyInstanceUID\n(0020,000e) UI []    # SeriesInstanceUID\n(0008,103e) LD []    # StudyInstanceUID\n(0008,0020) DA []    # StudyDate")
        temp.close()
        temp2.close()
        try:
            # e = subprocess.check_output([ "/Applications/dcmtk/bin/dump2dcm", "+te", temp.name, temp2.name ])
            e = subprocess.check_output([ "dump2dcm", "+te", temp.name, temp2.name ])
        except OSError as e:
            print >>sys.stderr, "Execution of dump2dcm failed:", e

        try:
            # here a series level findscu for Osirix
            # cmd="/Applications/dcmtk/bin/findscu -v -S -k 0008,0052=\"SERIES\" -k 0010,0010=\"" + searchTerm + "*\" -aec myself -aet OsiriX " + sys.argv[1] + " " + sys.argv[2] + " " + temp2.name
            # now a study level scu
            #cmd="/Applications/dcmtk/bin/findscu -v -S -k 0008,0052=\"STUDY\" -aec myself -aet OsiriX " + sys.argv[1] + " " + sys.argv[2] + " " + temp2.name
            cmd="findscu -v -S -k 0008,0052=\"STUDY\" -aec myself -aet OsiriX " + sys.argv[1] + " " + sys.argv[2] + " " + temp2.name
            # data = subprocess.check_output(cmd, shell=True, stderr=sys.stdout)
            p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE, close_fds=True)
            data1, data = p.communicate()
            #print "returned data is: \"", data, "\""
        except OSError as e:
            print >>sys.stderr, "Execution of findscu failed:", e
        # now use the study instance uids to query for the series
        vars = re.compile(r'\(0020,000d\) UI \[([^\]]+)\]', re.MULTILINE)
        studies = []
        for match in vars.finditer(data):
            studyinstanceuid = match.groups()
            siuid = studyinstanceuid[0].replace('\x00', '')
            studies.append( siuid )

        # now query for each study its series
        data2 = []
        for study in studies:
            #cmd=["findscu", "-v", "-S", "-k", "0008,0052=\"SERIES\"", "-k", "0020,000d=\"" + study + "\"", "-aec", "myself",  "-aet",  "OsiriX", sys.argv[1],sys.argv[2],temp2.name]
            cmd="findscu -v -S -k 0008,0052=\"SERIES\" -k 0020,000d=\"" + study + "\" -aec myself -aet OsiriX" + " " + sys.argv[1] + " " + sys.argv[2] + " " + temp2.name
            #print cmd
            try:
                # data = subprocess.check_output(cmd, shell=True, stderr=sys.stdout)
                p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE, close_fds=True)
                data1, data = p.communicate()                 
            except OSError as e:
                print >>sys.stderr, "Execution of findscu failed:", e
            except TypeError as e:
                print >>sys.stderr, "findscu failed with TypeError: ", e, " on \"", cmd, "\""
                continue
            #print >>sys.stderr, "findscu worked without TypeError on \"", cmd, "\""
                
            # split into different sections
            vars = re.compile(r'W: # Dicom-Data-Set', re.MULTILINE)
            for m in re.split(r'W: # Dicom-Data-Set', data):
                
                studydate = re.search(r'\(0008,0020\) DA \[([^\]]+)\]', m)
                if studydate:
                    studydate = studydate.group(1)
                seriesdescription = re.search(r'\(0008,103e\) LO \[([^\]]+)\]', m)
                if seriesdescription:
                    seriesdescription = seriesdescription.group(1)
                patientname = re.search(r'\(0010,0010\) PN \[([^\]]+)\]', m)
                if patientname:
                    patientname = patientname.group(1)
                patientid = re.search(r'\(0010,0020\) LO \[([^\]]+)\]', m)
                if patientid:
                    patientid = patientid.group(1)
                studyinstanceuid = re.search(r'\(0020,000d\) UI \[([^\]]+)\]', m)
                if studyinstanceuid:
                    studyinstanceuid = studyinstanceuid.group(1)
                seriesinstanceuid = re.search(r'\(0020,000e\) UI \[([^\]]+)\]', m)
                if seriesinstanceuid:
                    seriesinstanceuid = seriesinstanceuid.group(1)
                if (studydate == None and patientid == None and patientname == None):
                    continue
                data2.append( { 'PatientName': patientname, 
                                'PatientID': patientid, 
                                'StudyInstanceUID': studyinstanceuid, 
                                'SeriesInstanceUID': seriesinstanceuid, 
                                'SeriesDescription': seriesdescription, 
                                'StudyDate': studydate } );

        val = json.dumps(data2,indent=2)
        print(val)

        #erg = re.findall( r'\(0010,0010\) PN \[([^\]]+)\]', data)
        #print erg
        #val=json.dumps(erg,indent=2)
    else:
        print "Error: wrong number of arguments, we require an IP and a PORT"
