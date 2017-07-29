const Lexer = require('../src/lexer');
const Errors = require('../src/errors');

const TestHelper = require("./test_helper.ts");
TestHelper.init();

it('very basic test', () => {
    expect(Lexer.lex('abc 1234')).toEqualWithType([new Lexer.AlphanumericIdentifierToken('abc', 0),
        new Lexer.NumericToken('1234', 4, 1234)]);
});

it('code snippet', () => {
    let testcase: string = `(* Parsercomb -- Hutton/Paulson-style parser combinators for Moscow ML.
   Fritz Henglein, Ken Friis Larsen, Peter Sestoft.
   Documentation by sestoft@dina.kvl.dk.  Version 0.4 of 2000-04-30 *)

structure Parsercomb :> Parsercomb =
struct

    datatype 'elm stream =
	S of int * (int -> ('elm * 'elm stream) option)

    type ('elm,'res) parser = 'elm stream -> ('res * 'elm stream) option

    fun stream get src =
	let fun next src n = 
	        case get src of
		    SOME(x, rest) => SOME(x, S(n+1, next rest))
		  | NONE          => NONE
	in S(0, next src) end

    fun getItem (S(n, next)) = next n

    exception Parse of string

    infix 6 $-- --$ #-- --#
    infix 5 --
    infix 3 >> >>*
    infix 2 >>=
    infix 0 ||

    fun commitChar expected par (strm as S(n, next)) = 
	case par strm of 
	    NONE => 
		raise Parse (String.concat 
			     ["Expected <", expected, "> but found <", 
			      (case next n of
				   NONE       => "eof>"
				 | SOME(c, _) => str c ^ ">"),
			      " at character number ", Int.toString n]) 
	  | res as SOME _ => res

    fun commitElem expected show par (strm as S(n, next)) = 
	case par strm of 
	    NONE => 
		raise Parse (String.concat 
			     ["Expected <", expected, "> but found <", 
			      (case next n of
				   NONE         => "eof>"
				 | SOME(elm, _) => show elm ^ ">"),
			      " at element number ", Int.toString n]) 
	  | res as SOME _ => res
		    
    fun scan (scanner : ('a, 'a stream) StringCvt.reader -> 'a stream -> 'b) =
	scanner getItem 

    fun (par1 >>= parf2) strm =
	case par1 strm of
	    SOME(b, strm1) => parf2 b strm1
	  | NONE           => NONE

    fun success x strm = SOME(x, strm)

    fun failure strm = NONE

    fun eof r strm = 
	case getItem strm of
	    NONE       => SOME(r, strm)
	  | SOME(c, _) => NONE

    (* fun (par >> f) = par >>= (success o f) *)

    fun (par >> f) strm = 
	case par strm of
	    SOME(x, strm1) => SOME(f x, strm1)
	  | _              => NONE

    fun (par >>* f) strm = 
	case par strm of
	    SOME(x, strm1) => 
		(case f x of 
		     SOME y => SOME(y, strm1)
		   | NONE   => NONE)
	  | _              => NONE

    (* fun (par1 -- par2) = par1 >>= (fn r1 => par2 >> (fn r2 => (r1, r2))) *)

    fun (par1 -- par2) strm =
	case par1 strm of
	    SOME(r1, strm1) => (case par2 strm1 of
				    SOME(r2 , strm2) => SOME((r1,r2), strm2)
				  | NONE => NONE)
	  | NONE => NONE
		
    (* fun (par1 #-- par2) = (par1 -- par2) >> #2 *)

    (* Define explicitly to make par2 a tail call; possible because no
       backtracking over par1: *)

    fun (par1 #-- par2) strm = 
	case par1 strm of
	    SOME (_, strm1) => par2 strm1
	  | NONE            => NONE

    fun (par1 --# par2) = (par1 -- par2) >> #1 
	
    fun (par1 || par2) strm =
	case par1 strm of
	    NONE => par2 strm
	  | res  => res

    fun skipWS par strm = par (StringCvt.skipWS getItem strm)

    fun optional par strm0 =
	case par strm0 of
	    SOME(x, strm1) => SOME(SOME x, strm1)
	  | NONE           => SOME(NONE,   strm0)
		
    fun repeat0 par strm =
	let fun loop strm0 res =
	        case par strm0 of
		    SOME(x, strm1) => loop strm1 (x::res)
		  | NONE           => SOME(List.rev res, strm0)
	in loop strm [] end

    fun repeat1 par = par -- repeat0 par

    fun $ s strm0 =
	let val len = size s
	    val sub = String.sub
	    infix sub
	    fun loop n strm =
		if n = len then SOME(s, strm)
		else (case getItem strm of
			  SOME(c, rest) => 
			      if c = (s sub n) then loop (n+1) rest
			      else NONE
			| NONE => NONE)
	in loop 0 strm0 end
    
    fun (s $-- par) = $ s -- par >> #2

    fun (par --$ s) = par -- $ s >> #1

    fun getChar pred strm =
	case getItem strm of
	    res as SOME(c, src) => if pred c then res 
				   else NONE
	  | NONE => NONE

    fun $# elm strm = 
	case getItem strm of
	    res as SOME(x, src) => if x = elm then res 
				   else NONE
	  | NONE => NONE

    val getLit = $#

    fun getChars0 pred strm = 
	SOME(StringCvt.splitl pred getItem strm)

    fun getChars1 pred strm =
	case StringCvt.splitl pred getItem strm of
	    ("", _) => NONE
	  | res     => SOME res

    fun getChars1 pred = 
	repeat1 (getChar pred) >> op:: >> String.implode
	
    val getElem = getChar

    fun getElems0 pred = repeat0 (getElem pred) 

    fun getElems1 pred = repeat1 (getElem pred)  

    fun compose(par1, par2) strm = 
	let val par1stream = stream par1 strm
	in par2 par1stream end

    fun parse (par : ('a, 'b) parser) (strm : 'a stream) : 'b option = 
	case par strm of
	    NONE          => NONE
	  | SOME (res, _) => SOME res

    fun scanSubstr par sus = parse par (stream Substring.getc sus)

    fun scanString par s = scanSubstr par (Substring.all s)

    fun scanList par cs = parse par (stream List.getItem cs)
end`

    Lexer.lex(testcase);
});

it('strings', () => {
    let testcase: string = ' "bla bla\\   \\ blub" "" "\\\\ \\" "';
    expect(Lexer.lex(testcase)).toEqualWithType([
        new Lexer.StringConstantToken('"bla bla\\   \\ blub"', 1, 'bla bla blub'),
        new Lexer.StringConstantToken('""', 21, ''),
        new Lexer.StringConstantToken('"\\\\ \\" "', 24, '\\ \" ')
    ]);
});

it('char with multiple characters', () => {
    let testcase: string = ` #"test" "`;
    expect(() => { Lexer.lex(testcase); }).toThrow(Errors.LexerError);
});

it('floating point numbers', () => {
    let testcase: string = '1e2 1e 2'

    expect(Lexer.lex(testcase)).toEqualWithType([
        new Lexer.RealConstantToken('1e2', 0, 100),
        new Lexer.NumericToken('1', 4, 1),
        new Lexer.AlphanumericIdentifierToken('e', 5),
        new Lexer.NumericToken('2', 7, 2)
    ])
});

it('dots', () => {
    let testcase1: string = '.';
    let testcase2: string = '..';
    let testcase3: string = '...';

    expect(() => { Lexer.lex(testcase1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase2); }).toThrow(Errors.LexerError);

    expect(Lexer.lex(testcase3)).toEqualWithType([
        new Lexer.KeywordToken('...', 0)
    ]);
});

it('reserved words core', () => {
    let testcase: string = 'abstype and andalso as case datatype do else end exception fn fun handle if in infix infixr let local nonfix of op open orelse raise rec then type val with withtype while ( ) [ ] { } , : ; ... _ | = => -> #';

    expect(Lexer.lex(testcase)).toEqualWithType([
        new Lexer.KeywordToken('abstype', 0),
        new Lexer.KeywordToken('and', 8),
        new Lexer.KeywordToken('andalso', 12),
        new Lexer.KeywordToken('as', 20),
        new Lexer.KeywordToken('case', 23),
        new Lexer.KeywordToken('datatype', 28),
        new Lexer.KeywordToken('do', 37),
        new Lexer.KeywordToken('else', 40),
        new Lexer.KeywordToken('end', 45),
        new Lexer.KeywordToken('exception', 49),
        new Lexer.KeywordToken('fn', 59),
        new Lexer.KeywordToken('fun', 62),
        new Lexer.KeywordToken('handle', 66),
        new Lexer.KeywordToken('if', 73),
        new Lexer.KeywordToken('in', 76),
        new Lexer.KeywordToken('infix', 79),
        new Lexer.KeywordToken('infixr', 85),
        new Lexer.KeywordToken('let', 92),
        new Lexer.KeywordToken('local', 96),
        new Lexer.KeywordToken('nonfix', 102),
        new Lexer.KeywordToken('of', 109),
        new Lexer.KeywordToken('op', 112),
        new Lexer.KeywordToken('open', 115),
        new Lexer.KeywordToken('orelse', 120),
        new Lexer.KeywordToken('raise', 127),
        new Lexer.KeywordToken('rec', 133),
        new Lexer.KeywordToken('then', 137),
        new Lexer.KeywordToken('type', 142),
        new Lexer.KeywordToken('val', 147),
        new Lexer.KeywordToken('with',151),
        new Lexer.KeywordToken('withtype', 156),
        new Lexer.KeywordToken('while', 165),
        new Lexer.KeywordToken('(', 171),
        new Lexer.KeywordToken(')', 173),
        new Lexer.KeywordToken('[', 175),
        new Lexer.KeywordToken(']', 177),
        new Lexer.KeywordToken('{', 179),
        new Lexer.KeywordToken('}', 181),
        new Lexer.KeywordToken(',', 183),
        new Lexer.KeywordToken(':', 185),
        new Lexer.KeywordToken(';', 187),
        new Lexer.KeywordToken('...', 189),
        new Lexer.KeywordToken('_', 193),
        new Lexer.KeywordToken('|', 195),
        new Lexer.EqualsToken(197),
        new Lexer.KeywordToken('=>', 199),
        new Lexer.KeywordToken('->', 202),
        new Lexer.KeywordToken('#', 205)
    ])
});

it('integer constants decimal', () => {
    let testcase_zero: string = '0';
    let testcase_nonint: string = '~';
    let testcase_pos: string = '42';
    let testcase_neg: string = '~69';
    let testcase_pos_leadingzero: string = '0000042';
    let testcase_neg_leadingzero: string = '~0000023';
    let testcase_bigzero: string = '000000';

    expect(Lexer.lex(testcase_zero)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_zero, 0, 0)
    ]);
    expect(Lexer.lex(testcase_nonint)).toEqualWithType([
        new Lexer.IdentifierToken('~', 0)
    ]);
    expect(Lexer.lex(testcase_pos)).toEqualWithType([
        new Lexer.NumericToken(testcase_pos, 0, 42)
    ]);
    expect(Lexer.lex(testcase_neg)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_neg, 0, -69)
    ]);
    expect(Lexer.lex(testcase_pos_leadingzero)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_pos_leadingzero, 0, 42)
    ]);
    expect(Lexer.lex(testcase_neg_leadingzero)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_neg_leadingzero, 0, -23)
    ]);
    expect(Lexer.lex(testcase_bigzero)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_bigzero, 0, 0)
    ]);
});

it('integer constants hexadecimal wellformed', () => {
    let testcase_pos: string = '0x4a';
    let testcase_neg: string = '~0x6E';
    let testcase_pos_leadingzero: string = '0x000004F';
    let testcase_neg_leadingzero: string = '~0x00a';
    let testcase_bigzero: string = '0x00000';
    let testcase_all_chars1: string = '0x0123456789';
    let testcase_all_chars2: string = '0xabcdef';
    let testcase_all_chars3: string = '0xABCDEF';

    expect(Lexer.lex(testcase_pos)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_pos, 0, 0x4a)
    ]);
    expect(Lexer.lex(testcase_neg)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_neg, 0, -0x6e)
    ]);
    expect(Lexer.lex(testcase_pos_leadingzero)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_pos_leadingzero, 0, 0x4f)
    ]);
    expect(Lexer.lex(testcase_neg_leadingzero)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_neg_leadingzero, 0, -0xa)
    ]);
    expect(Lexer.lex(testcase_bigzero)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_bigzero, 0, 0)
    ]);
    expect(Lexer.lex(testcase_all_chars1)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_all_chars1, 0, 0x123456789)
    ]);
    expect(Lexer.lex(testcase_all_chars2)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_all_chars2, 0, 0xabcdef)
    ]);
    expect(Lexer.lex(testcase_all_chars3)).toEqualWithType([
        new Lexer.IntegerConstantToken(testcase_all_chars3, 0, 0xabcdef)
    ]);
});

it('integer constants hexadecimal illformed', () => {
    let testcase_nonint: string = '~0x';
    let testcase_too_long_prefix: string = '00x42';
    let testcase_too_short_prefix: string = 'x42';
    let testcase_neg_too_long_prefix: string = '~00x69';
    let testcase_neg_too_short_prefix: string = '~x42';
    let testcase_not_hex: string = '0xabcgcba';
    let testcase_missing_x: string = '04a';
    let testcase_capital_x: string = '0X4a';
    let testcase_double_x: string = '0xx4a';

    expect(Lexer.lex(testcase_nonint)).toEqualWithType([
        new Lexer.IntegerConstantToken('~0', 0, -0),
        new Lexer.AlphanumericIdentifierToken('x', 2)
    ]);
    expect(Lexer.lex(testcase_too_long_prefix)).toEqualWithType([
        new Lexer.IntegerConstantToken('00', 0, 0),
        new Lexer.AlphanumericIdentifierToken('x42', 2)
    ]);
    expect(Lexer.lex(testcase_too_short_prefix)).toEqualWithType([
        new Lexer.AlphanumericIdentifierToken('x42', 0)
    ]);
    expect(Lexer.lex(testcase_neg_too_long_prefix)).toEqualWithType([
        new Lexer.IntegerConstantToken('~00', 0, -0),
        new Lexer.AlphanumericIdentifierToken('x69', 3)
    ]);
    expect(Lexer.lex(testcase_neg_too_short_prefix)).toEqualWithType([
        new Lexer.IdentifierToken('~', 0),
        new Lexer.AlphanumericIdentifierToken('x42', 1)
    ]);
    expect(Lexer.lex(testcase_not_hex)).toEqualWithType([
        new Lexer.IntegerConstantToken('0xabc', 0, 0xabc),
        new Lexer.AlphanumericIdentifierToken('gcba', 5)
    ]);
    expect(Lexer.lex(testcase_missing_x)).toEqualWithType([
        new Lexer.IntegerConstantToken('04', 0, 4),
        new Lexer.AlphanumericIdentifierToken('a', 2)
    ]);
    expect(Lexer.lex(testcase_capital_x)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('X4a', 1)
    ]);
    expect(Lexer.lex(testcase_double_x)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('xx4a', 1)
    ]);
});

it('word constants decimal', () => {
    let testcase_noword: string = '0w';
    let testcase_pos: string = '0w42';
    let testcase_nohex: string = '0w9a';
    let testcase_capital_w: string = '0W1337';
    let testcase_zero_after_w: string = '0w01337';
    let testcase_leading_zero: string = '00w01';
    let testcase_neg: string = '~0w69';

    expect(Lexer.lex(testcase_noword)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('w', 1)
    ]);
    expect(Lexer.lex(testcase_pos)).toEqualWithType([
        new Lexer.WordConstantToken('0w42', 0, 42)
    ]);
    expect(Lexer.lex(testcase_nohex)).toEqualWithType([
        new Lexer.WordConstantToken('0w9', 0, 9),
        new Lexer.AlphanumericIdentifierToken('a', 3)
    ]);
    expect(Lexer.lex(testcase_capital_w)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('W1337', 1)
    ]);
    expect(Lexer.lex(testcase_zero_after_w)).toEqualWithType([
        new Lexer.WordConstantToken('0w01337', 0, 1337)
    ]);
    expect(Lexer.lex(testcase_leading_zero)).toEqualWithType([
        new Lexer.IntegerConstantToken('00', 0, 0),
        new Lexer.AlphanumericIdentifierToken('w01', 2)
    ]);
    expect(Lexer.lex(testcase_neg)).toEqualWithType([
        new Lexer.IntegerConstantToken('~0', 0, -0),
        new Lexer.AlphanumericIdentifierToken('w69', 2)
    ]);
});

it('word constants hexadecimal', () => {
    let testcase_noword: string = '0wx';
    let testcase_pos: string = '0wx4aA';
    let testcase_capital_w: string = '0Wx1337';
    let testcase_zero_after_w: string = '0wx01337';
    let testcase_leading_zero: string = '00wx01';
    let testcase_neg: string = '~0wx69';
    let testcase_capital_x: string = '0wX4aA';
    let testcase_wrong_order: string = '0xwabc';
    let testcase_double_w: string = '0wwabc';

    expect(Lexer.lex(testcase_noword)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('wx', 1)
    ]);
    expect(Lexer.lex(testcase_pos)).toEqualWithType([
        new Lexer.WordConstantToken(testcase_pos, 0, 0x4aa)
    ]);
    expect(Lexer.lex(testcase_capital_w)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('Wx1337', 1)
    ]);
    expect(Lexer.lex(testcase_zero_after_w)).toEqualWithType([
        new Lexer.WordConstantToken(testcase_zero_after_w, 0, 0x1337)
    ]);
    expect(Lexer.lex(testcase_leading_zero)).toEqualWithType([
        new Lexer.IntegerConstantToken('00', 0, 0),
        new Lexer.AlphanumericIdentifierToken('wx01', 2)
    ]);
    expect(Lexer.lex(testcase_neg)).toEqualWithType([
        new Lexer.IntegerConstantToken('~0', 0, -0),
        new Lexer.AlphanumericIdentifierToken('wx69', 2)
    ]);
    expect(Lexer.lex(testcase_capital_x)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('wX4aA', 1)
    ]);
    expect(Lexer.lex(testcase_wrong_order)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('xwabc', 1)
    ]);
    expect(Lexer.lex(testcase_double_w)).toEqualWithType([
        new Lexer.IntegerConstantToken('0', 0, 0),
        new Lexer.AlphanumericIdentifierToken('wwabc', 1)
    ]);
});

it('floating point constants', () => {
    let testcase_good1: string = '0.0e0';
    let testcase_good2: string = '0.0';
    let testcase_good3: string = '0E0';
    let testcase_leading_zero: string = '004e1';
    let testcase_hex1: string = '0x1.09e03';
    let testcase_hex2: string = '01.0x9e03';
    let testcase_hex3: string = '01.09e0x3';
    let testcase_double_dot: string = '12.34.56';
    let testcase_double_e: string = '12e34e56';
    let testcase_wrong_order: string = '12e34.56';
    let testcase_missing_component1: string = '.34e56';
    let testcase_missing_component2: string = '12.e56';
    let testcase_missing_component3: string = '12.34e';

    expect(Lexer.lex(testcase_good1)).toEqualWithType([
        new Lexer.RealConstantToken(testcase_good1, 0, 0)
    ]);
    expect(Lexer.lex(testcase_good2)).toEqualWithType([
        new Lexer.RealConstantToken(testcase_good2, 0, 0)
    ]);
    expect(Lexer.lex(testcase_good3)).toEqualWithType([
        new Lexer.RealConstantToken(testcase_good3, 0, 0)
    ]);
    expect(Lexer.lex(testcase_leading_zero)).toEqualWithType([
        new Lexer.RealConstantToken(testcase_leading_zero, 0, 40)
    ]);
    expect(() => { Lexer.lex(testcase_hex1); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_hex2)).toEqualWithType([
        new Lexer.RealConstantToken('01.0', 0, 1),
        new Lexer.AlphanumericIdentifierToken('x9e03', 4)
    ]);
    expect(Lexer.lex(testcase_hex3)).toEqualWithType([
        new Lexer.RealConstantToken('01.09e0', 0, 1.09),
        new Lexer.AlphanumericIdentifierToken('x3', 7)
    ]);
    expect(() => { Lexer.lex(testcase_double_dot); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_double_e)).toEqualWithType([
        new Lexer.RealConstantToken('12e34', 0, 12e34),
        new Lexer.AlphanumericIdentifierToken('e56', 5)
    ]);
    expect(() => { Lexer.lex(testcase_wrong_order); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_missing_component1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_missing_component2); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_missing_component3)).toEqualWithType([
        new Lexer.RealConstantToken('12.34', 0, 12.34),
        new Lexer.AlphanumericIdentifierToken('e', 5)
    ]);
});

it('string constants', () => {
    let testcase_empty: string = '""';
    let testcase_non_ending1: string = '"';
    let testcase_non_ending2: string = '"\\';
    let testcase_non_ending3: string = '"\\^';
    let testcase_non_ending4: string = '"\\"';
    let testcase_basic_string: string = '"The quick brown fox jumps over the lazy dog"';
    let testcase_newline: string = '"The quick brown fox \n jumps over the lazy dog"';
    let testcase_all_basic_escapes: string = '"\\a \\b \\t \\n \\v \\f \\r \\" \\\\"';
    let testcase_control_escapes: string = '"\\^@\\^J\\^^\\^_"';
    let testcase_invalid_control_escapes1: string = '"\\^?"';
    let testcase_invalid_control_escapes2: string = '"\\^j"';
    let testcase_invalid_control_escapes3: string = '"\\^`"';
    let testcase_invalid_escapes1: string = '"\\ "';
    let testcase_invalid_escapes2: string = '"\\,"';
    let testcase_invalid_escapes3: string = '"\\c"';
    let testcase_decimal_escape: string = '"\\042\\069\\106"';
    let testcase_decimal_escape_too_short1: string = '"\\42"';
    let testcase_decimal_escape_too_short2: string = '"\\4"';
    let testcase_decimal_escape_too_short3: string = '"\\0"';
    let testcase_decimal_escape_overlapping: string = '"\\000000"';
    let testcase_hex_escape: string = '"\\u0040\\u004a\\u004A"';
    let testcase_hex_escape_too_short1: string = '"\\u004"';
    let testcase_hex_escape_too_short2: string = '"\\u00"';
    let testcase_hex_escape_too_short3: string = '"\\u0"';
    let testcase_hex_escape_too_short4: string = '"\\u"';
    let testcase_capital_u: string = '"\\U0040"';
    let testcase_formatting_ignore1: string = '"\\ \\"';
    let testcase_formatting_ignore2: string = '"\\ \t\n \\working?"';
    let testcase_formatting_incomplete: string = '"\\ \n \t \t';
    let testcase_formatting_ignore_wrong: string = '"\\   a\\"';
    let testcase_bell_escape1: string = '"\\a"';
    let testcase_bell_escape2: string = '"\\^G"';

    expect(Lexer.lex(testcase_empty)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_empty, 0, '')
    ]);
    expect(() => { Lexer.lex(testcase_non_ending1); }).toThrow(Lexer.IncompleteError);
    expect(() => { Lexer.lex(testcase_non_ending2); }).toThrow(Lexer.IncompleteError);
    expect(() => { Lexer.lex(testcase_non_ending3); }).toThrow(Lexer.IncompleteError);
    expect(() => { Lexer.lex(testcase_non_ending4); }).toThrow(Lexer.IncompleteError);
    expect(Lexer.lex(testcase_basic_string)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_basic_string, 0, 'The quick brown fox jumps over the lazy dog')
    ]);
    expect(() => { Lexer.lex(testcase_newline); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_all_basic_escapes)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_all_basic_escapes, 0, '\x07 \b \t \n \v \f \r " \\')
    ]);
    expect(Lexer.lex(testcase_control_escapes)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_control_escapes, 0, '\x00\x0A\x1E\x1F')
    ]);
    expect(() => { Lexer.lex(testcase_invalid_control_escapes1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_invalid_control_escapes2); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_invalid_control_escapes3); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_invalid_escapes1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_invalid_escapes2); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_invalid_escapes3); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_decimal_escape)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_decimal_escape, 0, '*Ej')
    ]);
    expect(() => { Lexer.lex(testcase_decimal_escape_too_short1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_decimal_escape_too_short2); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_decimal_escape_too_short3); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_decimal_escape_overlapping)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_decimal_escape_overlapping, 0, '\x00000')
    ]);
    expect(Lexer.lex(testcase_hex_escape)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_hex_escape, 0, '@JJ')
    ]);
    expect(() => { Lexer.lex(testcase_hex_escape_too_short1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_hex_escape_too_short2); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_hex_escape_too_short3); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_hex_escape_too_short4); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_capital_u); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_formatting_ignore1)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_formatting_ignore1, 0, '')
    ]);
    expect(Lexer.lex(testcase_formatting_ignore2)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_formatting_ignore2, 0, 'working?')
    ]);
    expect(() => { Lexer.lex(testcase_formatting_incomplete); }).toThrow(Lexer.IncompleteError);
    expect(() => { Lexer.lex(testcase_formatting_ignore_wrong); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_bell_escape1)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_bell_escape1, 0, '\x07')
    ]);
    expect(Lexer.lex(testcase_bell_escape2)).toEqualWithType([
        new Lexer.StringConstantToken(testcase_bell_escape2, 0, '\x07')
    ]);
});

it('character constants', () => {
    let testcase_empty: string = '#""';
    let testcase_non_ending1: string = '#"';
    let testcase_non_ending2: string = '#"a';
    let testcase_good: string = '#"a"';
    let testcase_escape: string = '#"\\u004A"';
    let testcase_ignores: string = '#"\\ \n \t  \\\\123\\   \n\\"';
    let testcase_too_long: string = '#"\\\\x"';

    expect(() => { Lexer.lex(testcase_empty); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_non_ending1); }).toThrow(Errors.IncompleteError);
    expect(() => { Lexer.lex(testcase_non_ending2); }).toThrow(Errors.IncompleteError);
    expect(Lexer.lex(testcase_good)).toEqualWithType([
        new Lexer.CharacterConstantToken(testcase_good, 0, 'a')
    ]);
    expect(Lexer.lex(testcase_escape)).toEqualWithType([
        new Lexer.CharacterConstantToken(testcase_escape, 0, 'J')
    ]);
    expect(Lexer.lex(testcase_ignores)).toEqualWithType([
        new Lexer.CharacterConstantToken(testcase_ignores, 0, '{')
    ]);
    expect(() => { Lexer.lex(testcase_too_long); }).toThrow(Errors.LexerError);
});

it('comments', () => {
    let testcase_empty_comment: string = '(**)test';
    let testcase_normal_comment: string = '(*this is a comment *)test';
    let testcase_nested_comment: string = '(*this is a (* nested (* ? *) *) comment *)test';
    let testcase_non_ending1: string = '(* incomplete';
    let testcase_non_ending2: string = '(*';
    let testcase_unmatched: string = '*)test';

    expect(Lexer.lex(testcase_empty_comment)).toEqualWithType([
        new Lexer.AlphanumericIdentifierToken('test', 4, 'test')
    ]);
    expect(Lexer.lex(testcase_normal_comment)).toEqualWithType([
        new Lexer.AlphanumericIdentifierToken('test', 22, 'test')
    ]);
    expect(Lexer.lex(testcase_nested_comment)).toEqualWithType([
        new Lexer.AlphanumericIdentifierToken('test', 43, 'test')
    ]);
    expect(() => { Lexer.lex(testcase_non_ending1); }).toThrow(Errors.IncompleteError);
    expect(() => { Lexer.lex(testcase_non_ending2); }).toThrow(Errors.IncompleteError);
});

it('identifiers', () => {
    let testcase_empty: string = '';
    let testcase_alphanum: string = 'u12idADU12IA\'\'\'123';
    let testcase_symbolic: string = '!%&$#+-/:<=>?@\\~`^|*';
    let testcase_prime: string = '\'';
    let testcase_prime_symbolic: string = '\'!%!\'==';
    let testcase_double_prime: string = '\'\'';
    let testcase_triple_prime: string = '\'\'\'';
    let testcase_spacing: string = ' test identifier';
    let testcase_mixed: string = 'test!identifier';
    let testcase_underscore: string = '__hi';

    expect(Lexer.lex(testcase_empty)).toEqualWithType([]);
    expect(Lexer.lex(testcase_alphanum)).toEqualWithType([
        new Lexer.AlphanumericIdentifierToken(testcase_alphanum, 0, testcase_alphanum)
    ]);
    expect(Lexer.lex(testcase_symbolic)).toEqualWithType([
        new Lexer.IdentifierToken(testcase_symbolic, 0, testcase_symbolic)
    ]);
    expect(JSON.stringify(Lexer.lex(testcase_prime))).toEqualWithType(JSON.stringify([
        new Lexer.TypeVariableToken(testcase_prime, 0, testcase_prime)
    ]));
    expect(Lexer.lex(testcase_prime_symbolic)).toEqualWithType([
        new Lexer.TypeVariableToken('\'', 0, '\''),
        new Lexer.IdentifierToken('!%!', 1, '!%!'),
        new Lexer.TypeVariableToken('\'', 4, '\''),
        new Lexer.IdentifierToken('==', 5, '==')
    ]);
    expect(Lexer.lex(testcase_double_prime)).toEqualWithType([
        new Lexer.EqualityTypeVariableToken(testcase_double_prime, 0, testcase_double_prime)
    ]);
    expect(Lexer.lex(testcase_triple_prime)).toEqualWithType([
        new Lexer.EqualityTypeVariableToken(testcase_triple_prime, 0, testcase_triple_prime)
    ]);
    expect(Lexer.lex(testcase_spacing)).toEqualWithType([
        new Lexer.AlphanumericIdentifierToken('test', 1, 'test'),
        new Lexer.AlphanumericIdentifierToken('identifier', 6, 'identifier')
    ]);
    expect(Lexer.lex(testcase_underscore)).toEqualWithType([
        new Lexer.KeywordToken('_', 0)
        new Lexer.KeywordToken('_', 1)
        new Lexer.AlphanumericIdentifierToken('hi', 2, 'hi')
    ]);
});

it('long identifiers', () => {
    let testcase_small: string = 'lon.ident';
    let testcase_long: string = 'lon.hey10.der.ident';
    let testcase_space1: string = 'lon.hey10 .der.ident';
    let testcase_space2: string = 'lon.hey10. der.ident';
    let testcase_numeric: string = 'xxx0.10';
    let testcase_prime1: string = '\'lon.ident';
    let testcase_prime2: string = 'lon.\'ident';
    let testcase_double_prime1: string = '\'lon.ident';
    let testcase_double_prime2: string = 'lon.\'ident';
    let testcase_symbolic_good: string = 'lon.==';
    let testcase_symbolic_bad: string = '==.ident';

    expect(Lexer.lex(testcase_small)).toEqualWithType([
        new Lexer.LongIdentifierToken(testcase_small, 0, [
            new Lexer.AlphanumericIdentifierToken('lon', 0, 'lon')
        ], new Lexer.AlphanumericIdentifierToken('ident', 4, 'ident'))
    ]);
    expect(Lexer.lex(testcase_long)).toEqualWithType([
        new Lexer.LongIdentifierToken(testcase_long, 0, [
            new Lexer.AlphanumericIdentifierToken('lon', 0, 'lon'),
            new Lexer.AlphanumericIdentifierToken('hey10', 4, 'hey10'),
            new Lexer.AlphanumericIdentifierToken('der', 10, 'der')
        ], new Lexer.AlphanumericIdentifierToken('ident', 14, 'ident'))
    ]);
    expect(() => { Lexer.lex(testcase_space1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_space2); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_numeric); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_prime1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_prime2); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_double_prime1); }).toThrow(Errors.LexerError);
    expect(() => { Lexer.lex(testcase_double_prime2); }).toThrow(Errors.LexerError);
    expect(Lexer.lex(testcase_symbolic_good)).toEqualWithType([
        new Lexer.LongIdentifierToken(testcase_symbolic_good, 0, [
            new Lexer.AlphanumericIdentifierToken('lon', 0, 'lon')
        ], new Lexer.IdentifierToken('==', 4, '=='))
    ]);
    expect(() => { Lexer.lex(testcase_symbolic_bad); }).toThrow(Errors.LexerError);
});

it('reserved words module', () => {
    let testcase: string = 'eqtype functor signature struct include sharing structure where sig :>';

    expect(Lexer.lex(testcase)).toEqualWithType([
        new Lexer.KeywordToken('eqtype', 0),
        new Lexer.KeywordToken('functor', 7),
        new Lexer.KeywordToken('signature', 15),
        new Lexer.KeywordToken('struct', 25),
        new Lexer.KeywordToken('include', 32),
        new Lexer.KeywordToken('sharing', 40),
        new Lexer.KeywordToken('structure', 48),
        new Lexer.KeywordToken('where', 58),
        new Lexer.KeywordToken('sig', 64),
        new Lexer.KeywordToken(':>', 68),
    ]);
});
