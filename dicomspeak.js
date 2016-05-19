#!/usr/bin/env node
//
// This program is supposed to work with the following input (enter at the programs prompt):
//   > read data from IP 192.168.0.1 PORT 104
//   > for each subject with more than 1 study select the first series that matches "3D-T1" in its SeriesDescription
//   > print selected series
//   > move selected to "BREWERDATA"
//
// I hope these commands are largely self-explanatory.
//
// The first line reads data from a DICOM node such as one provided by OsiriX or another PACS
// system. The actual logic executed is to ask the node for all its studies (study instance UID).
// For each study a query will request information for all series. The implementation of this
// logic is in an external python file list_subjects.py which depends on the dcmtk tools.
//
// The data is received by an asynchronous process. It may take some seconds dependent on the number
// of series stored on the remote system. The resulting json list can be displayed on the command line
// by a 'print data'. Attempts to print the data before a full receive will result in an empty list.
//
// The second line, the 'for each' was written as a statement of work, before this program
// was written. You will notice that it could have been written as an SQL statement. Which would
// have removed all the fun in creating a domain specific language.
//
// The filter implemented by 'for each' results in a selected subset of series that can be printed
// using a 'print selected series' statement.
//
// Lastly the selected series can be moved from the source DICOM system (specified by 'read data') to
// another DICOM aware computer. The target system has to be known by the source system and is
// referenced using a DICOM Application Entity Title (AETitle).
//

//
// todo: query the dicom node offline, cache the results
// todo: keep a list of data sources (more than dicom, add XNAT and REDCap)
//

var repl = require('repl');
var PEG  = require('pegjs');
var fs   = require('fs');
var parser = 0;

var exec = require('child_process').exec;
// We will have two sets of data, the raw data loaded from the PACS system
// and the selected data that we can process further (i.e. move somewhere).
var data = [];
var selected = [];
var fromDataIP   = "";
var fromDataPort = "";

function getDataFromDicomNode(ip, port) {
    var child;
    child = exec("/usr/local/bin/python list_subjects.py " + ip + " " + port, { maxBuffer: 1024 * 50000 }, function (error, stdout, stderr) {
		if (error !== null) {
			console.log('exec error: ' + error);
		} else {
			setData(JSON.parse(stdout));
			console.log('\nfinished reading ' + data.length + ' entries from ' + ip + ' port ' + port);
			fromDataIP = ip;
			fromDataPort = port;
		}
    });
}

function setData(dat) {
    data = dat;
}

function printData(arg) {
    if (arg == 'all')
	return JSON.stringify(data, null, 2);
    else if (arg < 0) {
	var toprint = data.slice(arg, arg - 1);
	return JSON.stringify(toprint, null, 2);
    } else {
	var toprint = data.slice(arg, arg + 1);
	return JSON.stringify(toprint, null, 2);
    }
}
function printSelected(arg) {
    if (arg == 'all')
	return JSON.stringify(selected, null, 2);
    else {
	var toprint = selected.slice(arg, arg + 1);
	return JSON.stringify(toprint, null, 2);
    }
}

function parse(cmd, context, filename, callback) {
    // use the parser now on cmd
    var result = parser.parse(cmd);

    // now execute result
    for (var i = 0; i < result.length; i++) {
	//console.log("a result in " + JSON.stringify(result[i],2));
	var action = result[i];
	if (action.action == 'print') {
	    console.log(printData(action.what));
        } else if (action.action == 'nothing') {
            process.stdout.write('dicomspeak > '); // we do nothing
	} else if (action.action == 'dataFromDicomNode') {
	    getDataFromDicomNode(action.ip, action.port);
	} else if (action.action == 'foreach') {
	    console.log(JSON.stringify(action, null, 2));
	    doForEach(action);
	} else if (action.action == 'printselected') {
	    console.log(printSelected(action.what));
	} else if (action.action == 'move') {
	    console.log('starting moving data to new machine...');
	    move(selected, action.destinationAETitle, 0);
    } else if (action.action == 'help') {
        console.log('help for ' + action.what.join("") + ' requested.');
        console.log('valid commands are \'read\', \'print\', \'foreach\', and \'move\'.');
        console.log('Example:');
        console.log('  > read data from IP 192.168.0.1 PORT 104');
        console.log('  > for each subject with more than 1 study select the first series that matches "3D-T1" in its SeriesDescription');
        console.log('  > print selected series');
        console.log('  > move selected to "AET01"');
    } else if (action.action == 'quit') {
        console.log('ok, bye!');
        process.exit(0);
	} else {
	    console.log('unknown action: ' + JSON.stringify(action, null, 2));
	    return;
	}
    }
}


function processChain(data, indexToData, chain) {

    var selected = [];
    var selectGroups = [];
    var idxBySubject = indexToData;
    for (var i = 0; i < idxBySubject.length; i++) {
	//console.log("work on this subject: " + JSON.stringify(idxBySubject[i]));
	if (typeof (idxBySubject[i]) == 'undefined' || idxBySubject[i].data.length == 0)
	    continue; // ignore
	// now we have a list of indices into data for the current subject
	var subj = idxBySubject[i].PatientName;
	var dataIdx = idxBySubject[i].data;
	var dataIdxResult = dataIdx;
	
	// now run the with section of the action to filter out series for each group
	var goodGroup = true;
        var studies = {};
        var series = {};
	var patients = {};
	for (var s = 0; s < dataIdx.length; s++) {
	    studies[data[dataIdx[s]].StudyInstanceUID] = 1;
	    series[data[dataIdx[s]].SeriesInstanceUID] = 1;
	    patients[data[dataIdx[s]].PatientName] = 1;
	}
	//console.log("chain " + JSON.stringify(chain) + " should be array, length is: " + chain.length);
	for (var idxWith = 0; idxWith < chain.length; idxWith++) {
	    var entry = chain[idxWith];
	    var target = entry.target;
	    var targetNum = 0;
	    if (target == "study") {
		targetNum = Object.keys(studies).length;
	    } else if (target == "series") {
		targetNum = Object.keys(series).length;
	    } else if (target == "patient") {
		targetNum = Object.keys(patients).length;
	    } else {
		console.log("Error: target needs to be series, study or patient, found: " + target);
	    }
	    if (entry.qualifier.operator == 'lessthan') {
		if (targetNum >= entry.qualifier.value)
		    goodGroup = false;
	    } else if (entry.qualifier.operator == 'morethan') {
		if (targetNum <= entry.qualifier.value)
		    goodGroup = false;
	    } else if (entry.qualifier.operator == 'first') {
		dataIdxResult = [dataIdx[0]];
	    } else if (entry.qualifier.operator == 'last') {
		// reduce the group to the last of the dataIdx entries (assumes they are sorted by SeriesDate)
		dataIdxResult = [dataIdx[dataIdx.length - 1]];
	    } else if (entry.qualifier.operator == 'equals') {
		dataIdxResult = [];
		for (var c = 0; c < dataIdx.length; c++) {
		    var re = new RegExp(entry.qualifier.value);
		    var res = data[dataIdx[c]][entry.qualifier.tag].match(re);
		    if (res != null) {
			dataIdxResult.push(dataIdx[c]);
		    }
		}
	    } else {
		console.log("Error: unknown operator in with \"" + entry.qualifier.operator + "\"");
	    }
	}
	
	if (goodGroup) {
	    selectGroups.push(dataIdxResult);
	}
    }
    
    // go through the selected list and copy all found
    for (var i = 0; i < selectGroups.length; i++) {
	for (var j = 0; j < selectGroups[i].length; j++) {
	    selected.push(data[selectGroups[i][j]]);
	}
    }
    console.log("selected " + selected.length + " out of " + data.length + " entries from data for selected");
    return selected;
}

// Now evaluate the abstract syntax tree.
function doForEach(action) {
    if (!(action.action == "foreach")) {
	console.log("Error: this is not a foreach action");
	return;
    }
    selected = []; // a subset of elements in data
    
    // now perform a filtering step based on each subject, or study or series
    if (action.target == "subject") {
	var idxBySubject = indexBySubject(data);
	selected = processChain(data, idxBySubject, action.with.chain); // we will have less entries now in selected
    } else if (action.action == "study") {
	var idxByStudy = indexByStudy(data);
	selected = processChain(data, idxByStudy, action.with.chain); // we will have less entries now in selected
    } else if (action.action == "series") {
	var idxBySeries = indexBySeries(data);
	selected = processChain(data, idxBySeries, action.with.chain); // we will have less entries now in selected
    } else {
	console.log("Error: action " + action.action + " should be either study, series, or subject");
    }
    
    // now select some entries from everything in selected
    if (typeof(action.select) == 'undefined' || typeof(action.select.chain) == 'undefined')
	return; // skip the last step
    
    var selected2 = [];
    for (var s = 0; s < action.select.chain.length; s++) {
	// first we apply the limitTo chain
	selected2 = selected;
	for (var c = 0; c < action.select.chain.length; c++) {
	    // first do the limitTo
	    var idxBy = [];
	    if (action.select.chain[s].target == "subject") {
		idxBy = indexBySubject(selected2);
	    } else if (action.select.chain[s].target == "study") {
		idxBy = indexByStudy(selected2);
	    } else if (action.select.chain[s].target == "series") {
		idxBy = indexBySeries(selected2);
	    } else {
		console.log("Error: unknown level " + action.select.chain[s].target + " should be either subject, susty or series");
	    }
	    
	    selected2 = processChain(selected2, idxBy, action.select.chain[c].limitTo.chain);
	    // next we apply the select chain itself
	    var idxBySeries2 = indexBy(selected2);
	    if (action.select.chain[c].target == 'series') { // switch to sort by study (to group series together)
		idxBySeries2 = indexByStudy(selected2);
	    } else if (action.select.chain[c].target == 'study') {
		idxBySeries2 = indexBySubject(selected2);
	    } else {

	    }
	    selected2 = processChain(selected2, idxBySeries2, [action.select.chain[c]]);
	}
	selected = selected2;
    }
}

function indexByStudy(data) {
    // what are the subjects we have
    var studies = {};
    for (var i = 0; i < data.length; i++) {
	studies[data[i].StudyInstanceUID] = 1;
    }
    var studies = Object.keys(studies);
    var res = Array.apply(null, Array(studies.length)).map(function () { });
    for (var i = 0; i < data.length; i++) {
	var idx = studies.indexOf(data[i].StudyInstanceUID);
	if (typeof res[idx] == 'undefined') {
	    res[idx] = { 'StudyInstanceUID': data[i].StudyInstanceUID, 'data': [] };
	}
	res[idx].data.push(i); // build a list for each subject with 
    }
    return res;
}

function indexBySeries(data) {
    var res = [];
    for (var i = 0; i < data.length; i++) { // data is by series so this should be all we need
	res.push({ 'SeriesInstanceUID': data[i].SeriesInstanceUID, 'data': [i] });
    }
    
    return res; // nothing to do
}

// todo: we will run into problems here if we get a PatientName that is null
function indexBySubject(data) {
    // what are the subjects we have
    var subj = {};
    for (var i = 0; i < data.length; i++) {
	subj[data[i].PatientName] = 1;
    }
    var subjects = Object.keys(subj);
    var res = Array.apply(null, Array(subjects.length)).map(function () { });
    for (var i = 0; i < data.length; i++) {
	var idx = subjects.indexOf(data[i].PatientName);
	if (idx == -1)
	    continue;
	//console.log("index is:" + idx + " for " + data[i].PatientName + " length of array is " + res.length + " " + JSON.stringify(res[idx]));
	if (typeof res[idx] == 'undefined') {
	    res[idx] = { 'PatientName': data[i].PatientName, 'data': [] };
	}
	res[idx].data.push(i); // build a list for each subject with 
    }
    return res;
}

// Moving data requires the system we are talking to to know the destination. Because of this we can
// address it by its AETitle only.
function move(data, destinationAETitle, count) {
    // lets send the first entry, wait for it to be finished and send the next
    var child;
    console.log("Send " + count + " of " + data.length + "...");
    child = exec("/usr/local/bin/python move.py " + fromDataIP + " " + fromDataPort + " " + destinationAETitle + " " + data[count].SeriesInstanceUID, { maxBuffer: 1024 * 50000 }, function (error, stdout, stderr) {
	if (error !== null) {
	    console.log('exec error: ' + error); // stops all further computations
	} else { // on success send the next entry
	    move(data, ip, port, destinationAETitle, count+1); // call recursive
	}
    });
    if (count == data.length-1)
  	console.log('\nfinished moving ' + data.length + ' entries from ' + fromDataIP + ' port ' + fromDataPort + " to " + destinationAETitle);
}

function main() {
    parser = PEG.buildParser(fs.readFileSync("language.pegjs", "utf8"));
    
    console.log("Yes, Mathter...");
    
    var r = repl.start({
	prompt: 'dicomspeak > ',
	input: process.stdin,
	output: process.stdout,
	eval: parse
    });
    r.on('exit', function () {
	console.log("bye!");
	process.exit();
    });
    require('repl.history')(r, process.env.HOME + '/.node_history');
}

main();
