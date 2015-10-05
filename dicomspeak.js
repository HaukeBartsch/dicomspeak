#!/usr/bin/env node

// What would be nice is as a REPL:
//  read data from IP PORT
//  for each subject with more than 1 study select the first series that matches "3D-T1" in its SeriesDescription
//  show all selected series
//  move selected series to IP PORT using AETitleCalled "BREWERDATA" and AETitleCaller "ME"

var repl = require('repl');
var PEG = require('pegjs');
var fs = require('fs');
var parser = 0;

var exec = require('child_process').exec;
// a side effect of creating the AST
var data = [];

function getDataFromDicomNode( ip, port ) {
    var child;
    child = exec("/usr/local/bin/python list_subjects.py " + ip + " " + port, { maxBuffer: 1024 * 50000 }, function( error, stdout, stderr) {
	if (error !== null) {
	    console.log('exec error: ' + error);
	} else {
	    setData( JSON.parse(stdout) );
	    console.log('\nfinished reading ' + data.length + ' entries from ' + ip + ' port ' + port + '\n');
	}
    });
}

function setData( dat ) {
    data = dat;
}

function printData( arg ) {
    if (arg == 0)
	return JSON.stringify(data);
    else if (arg < 0)
	return JSON.stringify(data.slice(arg))
    else
	return JSON.stringify(data.slice(9,arg))
}

function parse(cmd, context, filename, callback) {
    // use the parser now on cmd
    var result = parser.parse(cmd);

    // now execute result
    for(var i = 0; i < result.length; i++) {
	action = result[i];
	if (action.action == 'print') {
	    console.log(data);
	} else if (action.action == 'dataFromDicomNode') {
	    getDataFromDicomNode( action.ip, action.port );
	} else {
	    console.log('unknown action: ' + JSON.stringify(action));
	}
    }
    callback(null, result);
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
}

main();
