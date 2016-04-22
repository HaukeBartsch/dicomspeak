{
    //
    // This grammar is used to create an abstract syntax tree (AST). PEGjs is a great
    // tool for creating these domain specific languages.
    //
    // Examples:
    //   read values from IP 128.54.39.72 and PORT 11112
    //   print data
    //   for each subject with more than 1 study
    //   for each subject with more than 1 study and less than 4 studies
    //
    //   for each subject with more than 1 study select first series that matches "3D-T1" in its SeriesDescription
    //   for each subject with more than 1 study select all series
}

start
  = command

command
    = readdata
    / printdata
    / printselected
    / move
    / foreach
    / help
    / quit

move
    = ws move_word ws "to" ws dest:word ws "\n" { return [{ 'action': 'move', 'destinationAETitle': dest.join("") }]; }

foreach
    = ws for_word ws each_word ws tar:target ws "with" ws wi:with_statements ws se:selects "\n" {
        return [{ 'action': 'foreach', 'target': tar, 'with': wi, 'select': se }];
    }

help
    = ws "help" ws what:word ws "\n" {
        return [{ 'action': 'help', 'what': what }];
    }

quit
    = ws "quit" ws "\n" {
        return [{ 'action': 'quit' }];
    }

target
    = "subject"  { return 'subject'; }
    / "subjects" { return 'subject'; }
    / "patient"  { return 'subject'; }
    / "patients" { return 'subject'; }
    / "series"   { return 'series'; }
    / "study"    { return 'study'; }
    / "studies"  { return 'study'; }

selects
    = "select" ws se:select_statements { return se; }
    / ws { return []; }

select_statements
    = left:select_statement rest:(ws ("and" / "or") ws select_statement)* {
	if (rest.length == 0)
	    return { 'chain': [left] };
	else {
	     var l = [left];
	     for(var i = 0; i < rest.length; i++) {
	        rest[i][3].action = rest[i][1];
	        l.push(rest[i][3]);
	     }
   	     return { 'chain': l };
        }
    }

select_statement
    = qal:qualifiers ws tar:target ws th:that_statements { return { 'qualifier': qal, 'target': tar, 'limitTo': th }; }

that_statements
    = "that" ws left:that_statement rest:(ws ("and" / "or") ws that_statement)* {
	if (rest.length == 0)
	    return { 'chain': [left] };
	else {
	     var l = [left];
	     for(var i = 0; i < rest.length; i++) {
	        rest[i][3].action = rest[i][1];
	        l.push(rest[i][3]);
	     }
   	     return { 'chain': l };
	}
    }
    / ws { return []; }

that_statement
    = "matches" ws val:string ws in_word ws tag:DicomTag {
        return { 'qualifier': { 'operator': 'equals', 'value': val, 'tag': tag}, 'target': 'series' };
    }

DicomTag
    = chars:[a-zA-Z0-9\.]+ { return chars.join(""); }

string
    = '"' chars:[a-zA-Z0-9_\-]+ '"' { return chars.join(""); }
    / '\'' chars:[a-zA-Z0-9_\-]+ '\'' { return chars.join(""); }

with_statements
    = left:with_statement rest:(ws ("and" / "or") ws with_statement)* {
	if (rest.length == 0)
	    return { 'chain': [left] };
	else {
	     var l = [left];
	     for(var i = 0; i < rest.length; i++) {
	        rest[i][3].action = rest[i][1];
	        l.push(rest[i][3]);
	     }
   	     return { 'chain': l };
        }
    }

with_statement
    = qual:qualifiers ws tar:target { return { 'action': 'and', 'qualifier': qual, 'target': tar }; }
    / "not" ws qual:qualifiers ws tar:target { return { 'action': 'and', 'qualifier': qual, 'target': tar, 'logical': 'negate' }; }

qualifiers
    = "more" ws "than" ws num:number { return { 'operator': 'morethan', 'value': num }; }
    / "less" ws "than" ws num:number { return { 'operator': 'lessthan', 'value': num }; }
    / first_word { return { 'operator': 'first' }; }
    / last_word { return { 'operator': 'last' }; }
    / "one" { return { 'operator': 'first' }; }
    / "all" { return { 'operator': 'all' }; }

printdata
    = ws "print" ws data_word ind:index "\n" {
        if (ind.value == 'all')
           return [{ 'action' : 'print', 'what': 'all' }];
	else
	   return [{ 'action' : 'print', 'what': parseInt(ind.value) }];
    }

printselected
    = ws "print" ws "selected" ind:index "\n" {
        if (ind.value == 'all')
           return [{ 'action' : 'printselected', 'what': 'all' }];
	else
	   return [{ 'action' : 'printselected', 'what': parseInt(ind.value) }];
    }

index
    = '[' num:number ']' { return { 'value': num}; }
    / ws  { return { 'value': 'all'}; }

readdata
    = ws "read" ws data_word ws from_word ws IP_word ws ipl:ip ws and_word ws port_word ws portl:port ws "\n" {
         return [{ 'action': 'dataFromDicomNode', 'ip': ipl, 'port': portl }];
    }

move_word
    = "move" ws "selected"
    / "move"

in_word
    = "in" ws "its"
    / "in"

first_word
    = "the" ws "first"
    / "first"

last_word
    = "the" ws "last"
    / "last"

for_word
    = "for"

each_word
    = "each"

IP_word
    = "IP"
    / "ip"
    ws

port_word
    = "PORT"
    / "port"
    / ws

and_word
    = "and"
    / ws

data_word
    = "data"
    / "values"
    / "value"
    / ws

from_word
    = "from"
    / ws

ip "ip"
  = ipnumber:[0-9\.]+ { return ipnumber.join(""); }

port "port"
  = portnumber:[0-9]+ { return portnumber.join(""); }


ws "ws"
  = [ \t]*

dot "dot"
  = "."

number "number"
  = num:[\-\+0-9]+ { return parseInt(num.join("")); }

word
  = [a-zA-Z0-9_\.]+