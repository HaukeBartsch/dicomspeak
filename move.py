#!/usr/bin/env python
"""

Perform a DICOM move using movescu. This module depends on the dcmtk tools
to be installed in '/Applications/dcmtk/bin/'.

Usage:
  > python move.py <from IP> <from Port> <to AETitle> <series instance UID>

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
    if len(sys.argv) == 5:
        # write a temporary file to build a dicom with the move information
        temp = tempfile.NamedTemporaryFile(mode='w+t',delete=False)
        temp2 = tempfile.NamedTemporaryFile(delete=False)
        #print "name of the temp file is:", temp.name
        temp.write("# request all images for the seriesinstanceuid\n#\n(0008,0052) CS [SERIES]     # QueryRetrieveLevel\n(0020,000e) UI ["+sys.argv[4]+"]    # SeriesInstanceUID\n")
        temp.close()
        temp2.close()
        try:
            #e = subprocess.check_output([ "/Applications/dcmtk/bin/dump2dcm", "+te", temp.name, temp2.name ])
            e = subprocess.check_output([ "dump2dcm", "+te", temp.name, temp2.name ])
        except OSError as e:
            print >>sys.stderr, "Execution of dump2dcm failed:", e

        try:
            # Here a series level findscu that seems to work for Osirix
            # cmd="/Applications/dcmtk/bin/findscu -v -S -k 0008,0052=\"SERIES\" -k 0010,0010=\"" + searchTerm + "*\" -aec myself -aet OsiriX " + sys.argv[1] + " " + sys.argv[2] + " " + temp2.name
            # Here a study level movescu
            #cmd="/Applications/dcmtk/bin/movescu --study -aem \"" + sys.argv[3] + "\" " + sys.argv[1] + " " + sys.argv[2] + " " + temp2.name
            cmd="movescu --study -aem \"" + sys.argv[3] + "\" " + sys.argv[1] + " " + sys.argv[2] + " " + temp2.name
            # data = subprocess.check_output(cmd, shell=True, stderr=sys.stdout)
            p = Popen(cmd, shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE, close_fds=True)
            data1, data = p.communicate()
        except OSError as e:
            print >>sys.stderr, "Execution of movescu failed:", e
    else:
        print "Error: wrong number of arguments, we require an IP and a PORT from the data and an AETitle that is known to that system"
