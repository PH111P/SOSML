// A proof-of-concept CLI for SOSML
// Build with `npm run cli`
// Run with `node sosml_cli.js`

import { getFirstState, interpret, InterpreterOptions, PrintOptions } from './main';
import { IncompleteError } from './errors';

import * as readline from 'readline';

let opts: InterpreterOptions = {
    'allowSuccessorML': true,
    'allowVector': true,
    'disableElaboration': false,
    'disableEvaluation': false,
    'strictMode': false,
    'allowUnicode': true,
    'allowUnicodeTypeVariables': true,
};
let printOpts: PrintOptions = {
    'fullSymbol': 'SOSML>',
    'emptySymbol': '     > ',
    'boldText': ((text: string) => '\x1b[1m' + text + '\x1b[0m'),
    'italicText': ((text: string) => '\x1b[3m' + text + '\x1b[0m'),
    'showTypeVariablesAsUnicode': true
}

let state = getFirstState( );
printOpts.stopId = getFirstState( ).id + 1;

console.log('SOSML> Welcome to SOSML. Please enter your code.\n');
let tmp = '';

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Input> '
});
rl.prompt( );


rl.on( 'line', ( line: string ) => {
    try {
        tmp = tmp + line;
        let out = '';
        let res = interpret( tmp, state, opts );

        if( res.evaluationErrored ) {
            out += 'SOSML>　There was a problem with your code:\n'
                +  '     >  \x1b[31;40;1m' + res.error + '\x1b[39;49;0m\n';
            tmp = '';
        } else {
            out += res.state.toString( printOpts );
            printOpts.stopId = res.state.id + 1;
            state = res.state;
            tmp = '';
        }
        if( res.warnings !== undefined ) {
            for( let i = 0; i < res.warnings.length; ++i ) {
                if( res.warnings[ i ].type >= -1 ) {
                    out += 'Attention: ' + res.warnings[ i ].message;
                } else {
                    out += 'Message: ' + res.warnings[ i ].message;
                }
            }
        }
        console.log( out );
    } catch (e) {
        if( !( e instanceof IncompleteError ) ) {
            console.log( 'SOSML> There was a problem with your code:\n'
                + '     > \x1b[31;40;1m' + e + '\x1b[39;49;0m\n' );
            tmp = '';
        }
    }
    rl.prompt( );
}).on('close', () => {
    console.log( '\nSOSML> Thank you for using SOSML. Have a nice day.' );
    process.exit( 0 );
});
