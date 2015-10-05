{
    // read values from IP 192.168.0.110 and PORT 11112
    // print data
    // for each subject with more than 1 study
    
}

start
  = command

command
    = readdata
    / printdata
    / foreach

foreach
    = ws for_word ws each_word ws tar:target ws "with" ws wi:with_statements ws "\n" { return { 'action': 'foreach', 'target': tar, 'with': wi }; }

target
    = "subject"  { return 'subject'; }
    / "subjects" { return 'subject'; }
    / "series"   { return 'series'; }
    / "study"    { return 'study'; }
    / "studies"  { return 'study'; }

with_statements
    = left:with_statement ws rest:(ws "and" ws with_statement)* {
	if (rest.length == 0)
	    return left;
	else
	    return { 'action': 'and', 'left': left, 'right': rest  };
    }
    / left:with_statement ws rest:(ws "or" ws with_statement)* {
	if (rest.length == 0)
	    return left;
	else
	    return { 'action': 'or', 'left': left, 'right': rest  };
    }

with_statement
    = qual:qualifiers ws tar:target { return { 'action': 'with', 'qualifier': qual, 'target': tar }; }
    / "not" ws qual:qualifiers ws tar:target { return { 'action': 'with', 'qualifier': qual, 'target': tar, 'logical': 'negate' }; }

qualifiers
    = "more" ws "than" ws num:number { return { 'qualifier': 'morethan', 'value': parseInt(num) }; }
    / "less" ws "than" ws num:number { return { 'qualifier': 'lessthan', 'value': parseInt(num) }; }

printdata
    = ws "print" ws data_word "\n" { return [{ 'action' : 'print', 'what': 'all' }]; }

readdata
    = ws "read" ws data_word ws from_word ws IP_word ws ipl:ip ws and_word ws port_word ws portl:port ws "\n" { return [{ 'action': 'dataFromDicomNode', 'ip': ipl, 'port': portl }]; }

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
  = [\-0-9]+
