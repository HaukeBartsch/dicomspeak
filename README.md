# dicomspeak
Pull DICOM images from a PACS system, filter and send to another destination.

## Usage
This program is supposed to work with the following input (enter at the programs prompt):
```
> read data from IP 192.168.0.1 PORT 104
> for each subject with more than 1 study select the first series that matches "3D-T1" in its SeriesDescription
> print selected series
> move selected to "BREWERDATA"
```

I hope these commands are largely self-explanatory.

The first line reads data from a DICOM node such as one provided by OsiriX or another PACS
system. The actual logic executed is to ask the node for all its studies (study instance UID).
For each study a query will request information for all series. The implementation of this
logic is in an external python file list_subjects.py which depends on the dcmtk tools.

The data is received by an asynchronous process. It may take some seconds dependent on the number
of series stored on the remote system. The resulting json list can be displayed on the command line
by a 'print data'. Attempts to print the data before a full receive will result in an empty list.

The second line, the 'for each' was written as a statement of work, before this program
was written. You will notice that it could have been written as an SQL statement. Which would
have removed all the fun in creating a domain specific language.

The filter implemented by 'for each' results in a selected subset of series that can be printed
using a 'print selected series' statement.

Lastly the selected series can be moved from the source DICOM system (specified by 'read data') to
another DICOM aware computer. The target system has to be known by the source system and is
referenced using a DICOM Application Entity Title (AETitle).
