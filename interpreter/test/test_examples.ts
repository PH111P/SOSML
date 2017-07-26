const Lexer = require("../src/lexer");
const Parser = require("../src/parser");
const Errors = require("../src/errors");

const API = require("../src/main.ts");

const State = require("../src/state.ts");
const InitialState = require("../src/initialState.ts");
const Expr = require("../src/expressions.ts");
const Decl = require("../src/declarations.ts");
const Type = require("../src/types.ts");
const Val = require("../src/values.ts");

const TestHelper = require("./test_helper.ts");
TestHelper.init();

function createBasicStdlib(): State.State {
    let [state, unused1, unused2] = API.Interpreter.interpret(
        'exception Domain;' +
        'exception Overflow; ' +
        'exception Empty; ' +
        'exception Subscript; ' +
        'exception Size; ' +
        'exception Chr; ' +

        'fun o (f,g) x = f (g x); ' +
        'infix 3 o; ' +

        'datatype order = LESS | EQUAL | GREATER; ' +

        'fun Int.compare (x, y: int) = if x<y then LESS else if x>y then GREATER else EQUAL;' +
        'fun Real.compare (x, y: real) = if x<y then LESS else if x>y then GREATER else EQUAL;' +

        'exception Option.Option; ' +
        'datatype \'a option = NONE | SOME of \'a; ' +
        'fun valOf (SOME x) = x ' +
        '  | valOf NONE = raise Option.Option; ' +
        'fun isSome NONE = false ' +
        '  | isSome (SOME _) = true; ' +

        'val Int.minInt = SOME ~1073741824; ' +
        'val Int.maxInt = SOME 1073741823; ' +

        'fun hd nil = raise Empty ' +
        '| hd (x::xr) = x; ' +
        'fun tl nil = raise Empty ' +
        '| tl (x::xr) = xr; ' +
        'fun null nil = true ' +
        '| null (x::xr) = false; ' +

        'fun map f nil = nil ' +
        '  | map f (x::xr) = (f x) :: (map f xr); ' +

        //TODO use infix version!!
        //'infixr 5 @; ' +
        //'fun nil @ ys = ys ' +
        //'| (x::xr) @ ys = x::(xr @ ys); ' +

        'fun @ (nil,ys) = ys ' +
        '| @((x::xr),ys) = x:: @(xr,ys); ' +
        'infixr 5 @; ' +

        'fun length nil = 0 ' +
        '  | length (x::xr) = 1 + length xr; ' +

        'fun rev nil = nil ' +
        '  | rev (x::xr) = rev xr @ [x]; ' +

        'fun List.concat nil = nil ' +
        '  | List.concat (x::xr) = x @ List.concat xr; ' +

        'fun foldr f e []      = e ' +
        '  | foldr f e (x::xr) = f(x, foldr f e xr); ' +

        'fun foldl f e []      = e ' +
        '  | foldl f e (x::xr) = foldl f (f(x, e)) xr; ' +

        'fun List.tabulate (n, f) = ' +
        '  let fun h i = if i<n then f i :: h (i+1) else [] ' +
        '  in if n<0 then raise Size else h 0 end; ' +

        'fun List.exists p []      = false ' +
        '  | List.exists p (x::xr) = p x orelse List.exists p xr; ' +

        'fun List.all p []      = true ' +
        '  | List.all p (x::xr) = p x andalso List.all p xr; ' +

        'fun List.filter p []      = [] ' +
        '  | List.filter p (x::xr) = if p x then x :: List.filter p xr else List.filter p xr; ' +

        'fun List.collate (compare : \'a * \'a -> order) p = case p of ' +
        '    (nil, _::_) => LESS ' +
        '  | (nil, nil) => EQUAL ' +
        '  | (_::_, nil) => GREATER ' +
        '  | (x::xr, y::yr) => case compare(x,y) of ' +
        '         EQUAL => List.collate compare (xr,yr) ' +
        '       | s => s; ' +

        '', InitialState.getInitialState(), true);
    state = state.getNestedState();

    state.setDynamicValue('Math.sqrt', new Val.PredefinedFunction('Math.sqrt', (val: Val.Value) => {
        if (val instanceof Val.Real) {
            let value = (<Val.Real> val).value;
            if (value < 0)
                return [new Val.ExceptionConstructor('Domain').construct(), true];
            return [new Val.Real(Math.sqrt(value)), false];
        } else {
            throw new Errors.InternalInterpreterError('std type mismatch');
        }
    }));
    state.setStaticValue('Math.sqrt', [new Type.FunctionType(new Type.PrimitiveType('real'), new Type.PrimitiveType('real'))]);

    state.setDynamicValue('ord', new Val.PredefinedFunction('ord', (val: Val.Value) => {
        if (val instanceof Val.CharValue) {
            let value = (<Val.CharValue> val).value;
            return [new Val.Integer(value.charCodeAt()), false];
        } else {
            throw new Errors.InternalInterpreterError('std type mismatch');
        }
    }));
    state.setStaticValue('ord', [new Type.FunctionType(new Type.PrimitiveType('char'), new Type.PrimitiveType('int'))]);

    state.setDynamicValue('chr', new Val.PredefinedFunction('chr', (val: Val.Value) => {
        if (val instanceof Val.Integer) {
            let value = (<Val.Interpreter> val).value;
            if (value < 0 || value > 255)
                return [new Val.ExceptionConstructor('Chr').construct(), true];
            return [new Val.CharValue(String.fromCharCode(value)), false];
        } else {
            throw new Errors.InternalInterpreterError('std type mismatch');
        }
    }));
    state.setStaticValue('chr', [new Type.FunctionType(new Type.PrimitiveType('int'), new Type.PrimitiveType('char'))]);

    state.setDynamicValue('Math.pi', new Val.Real(3.14159265359));
    state.setStaticValue('Math.pi', [new Type.PrimitiveType('real'));

    return state;
}

//TODO determine actual types
function run_test(commands): void {
    let oldTests = [];
    let state = createBasicStdlib();
    let exception;
    let value;
    //TODO use a real stdlib instead of a preamble
    state = createBasicStdlib();
    for(let step of commands) {
        step[1](() => { [state, exception, value] = API.Interpreter.interpret(step[0], state, true); });

        step[2](state, exception, value);

        for(let test of oldTests)
            test[1](test[0][0], test[0][1], test[0][2]);

        oldTests.push([[state, exception, value], step[2]]);
    }
}

function createTuple(list: Val.Value[]): Val.RecordValue {
    let map = new Map<string, Val.Value>();

    for(let i = 0; i < list.length; ++i)
        map.set(''+(i+1), list[i]);

    return new Val.RecordValue(map);
}

function createList(list: Val.Value[]): Val.Value {
    let ret: Val.Value = new Val.ConstructedValue('nil');

    for(let i = list.length - 1; i >= 0; --i)
        ret = new Val.ConstructedValue('::', createTuple([list[i], ret]));

    return ret;
}

//TODO maybe explicitly check the all functions? (currently only != undefined)

it("1.1", () => {
    /*
val x = 4*7+3;
val y = x*(x-29);

val x = 7+4;
val y = x*(x-1);
val z = ~x*(y-2);
     */
    //TODO test types
    run_test([
        ['val x = 4*7+3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(31));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val y = x*(x-29);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('y')).toEqualWithType(new Val.Integer(62));
            //expect(state.getStaticValue('y')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val x = 7+4;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(11));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val y = x*(x-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('y')).toEqualWithType(new Val.Integer(110));
            //expect(state.getStaticValue('y')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val z = ~x*(y-2);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('z')).toEqualWithType(new Val.Integer(-1188));
            //expect(state.getStaticValue('z')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("1.2", () => {
    /*
val x = 4*7+3;
val y = (x-29)*x;

val a = x-y;
val b = x+y;

val a = x-y val b = x+y;
     */
    //TODO test types
    run_test([
        ['val x = 4*7+3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(31));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val y = (x-29)*x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('y')).toEqualWithType(new Val.Integer(62));
            //expect(state.getStaticValue('y')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val a = x-y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('a')).toEqualWithType(new Val.Integer(-31));
            //expect(state.getStaticValue('a')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val b = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('b')).toEqualWithType(new Val.Integer(93));
            //expect(state.getStaticValue('b')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val a = x-y val b = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('a')).toEqualWithType(new Val.Integer(-31));
            //expect(state.getStaticValue('a')).toEqualWithType(new Type.PrimitiveType('int'));
            expect(state.getDynamicValue('b')).toEqualWithType(new Val.Integer(93));
            //expect(state.getStaticValue('b')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("1.2.1", () => {
    /*
val x = 2;
val x = 3;
val y = x*x;
     */
    //TODO test types
    run_test([
        ['val x = 2;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(2));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val x = 3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(3));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val y = x*x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('y')).toEqualWithType(new Val.Integer(9));
            //expect(state.getStaticValue('y')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("1.2.2", () => {
    /*
val it = 4*7+3;
4*7+3;
val x = it+it;
it+it;
it-60;
     */
    //TODO test types
    run_test([
        ['val it = 4*7+3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(31));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['4*7+3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(31));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val x = it+it;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(62));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['it+it;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(62));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitveType('int'));
        }],
        ['it-60;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(2));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
    ]);
});

it("1.2.3", () => {
    /*
vall x = 5;
     */
    run_test([
        ['vall x = 5;', (x) => { expect(x).toThrow(Errors.EvaluationError); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
        }]
    ]);
});

it("1.3", () => {
    /*
fun quadrat (x:int) = x*x;

quadrat(2+3);
quadrat 4;

quadrat 2 + 3;
(quadrat 2) + 3;

quadrat 2 + quadrat 3;
quadrat (2 + quadrat 3);
quadrat (quadrat 3);

fun quadrat' (y:int) = y*(y-1)+y;
     */
    //TODO test types
    run_test([
        ['fun quadrat (x:int) = x*x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('quadrat')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['quadrat(2+3);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(25));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['quadrat 4;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(16));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['quadrat 2 + 3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(7));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['(quadrat 2) + 3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(7));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['quadrat 2 + quadrat 3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(13));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['quadrat (2 + quadrat 3);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(121));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['quadrat (quadrat 3);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(81));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun quadrat\' (y:int) = y*(y-1)+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('quadrat\'')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('quadrat\'')).toEqualWithType(TODO);
        }]
    ]);
});

it("1.4", () => {
    /*
3<3;
3<=3;
3>=3;
3=3;
3<>3;

if false then 5 else 7;
if true then 5 else 7;

if 4<2 then 3*5 else 7*1;
if 4=2*2 then 3*5 else 7*1;

fun betrag (x:int) = if x<0 then ~x else x;
betrag ~3;

if 4<2 then 3 else if 2<3 then ~1 else 1;
     */
    //TODO test types
    run_test([
        ['3<3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(false));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['3<=3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['3>=3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['3=3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['3<>3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(false));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['if false then 5 else 7;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(7));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['if true then 5 else 7;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(5));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['if 4<2 then 3*5 else 7*1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(7));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['if 4=2*2 then 3*5 else 7*1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(15));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun betrag (x:int) = if x<0 then ~x else x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('betrag')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['betrag ~3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(3));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['if 4<2 then 3 else if 2<3 then ~1 else 1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(-1));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("1.5", () => {
    /*
val a = 2*2;
val b = a*a;
val c = b*b;

fun hoch8 (x:int) =
    let
        val a = x*x
        val b = a*a
    in
        b*b
    end;
hoch8 2;

fun q (y:int) = y*y;
fun hoch8 (x:int) = q (q (q x));
     */
    //TODO test types
    run_test([
        ['val a = 2*2;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('a')).toEqualWithType(new Val.Integer(4));
            //expect(state.getStaticValue('a')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val b = a*a;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('b')).toEqualWithType(new Val.Integer(16));
            //expect(state.getStaticValue('b')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val c = b*b;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('c')).toEqualWithType(new Val.Integer(256));
            //expect(state.getStaticValue('c')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun hoch8 (x:int) = let val a = x*x val b = a*a in b*b end;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('hoch8')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('hoch8')).toEqualWithType(TODO);
        }],
        ['hoch8 2;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(256));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun q (y:int) = y*y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('q')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('q')).toEqualWithType(TODO);
        }],
        ['fun hoch8 (x:int) = q (q (q x));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('hoch8')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('hoch8')).toEqualWithType(TODO);
        }]
    ]);
});

it("1.6", () => {
    /*
(7, 2, true, 2);
(7+2, 2*7);

();

val x = (5-2, 1<2, 2*2);
#3 x;
#2 x;
     */
    //TODO test types
    run_test([
        ['(7, 2, true, 2);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.RecordValue(new Map([
                ['1', new Val.Integer(7)],
                ['2', new Val.Integer(2)],
                ['3', new Val.BoolValue(true)],
                ['4', new Val.Integer(2)]
            ])));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['(7+2, 2*7);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.RecordValue(new Map([
                ['1', new Val.Integer(9)],
                ['2', new Val.Integer(14)]
            ])));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['();', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.RecordValue(new Map([])));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['val x = (5-2, 1<2, 2*2);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.RecordValue(new Map([
                ['1', new Val.Integer(3)],
                ['2', new Val.BoolValue(true)],
                ['3', new Val.Integer(4)]
            ])));
            //expect(state.getStaticValue('x')).toEqualWithType(TODO);
        }],
        ['#3 x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(4));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['#2 x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }]
    ]);
});

it("1.7", () => {
    /*
val (x,y) = (3,4);

val (x,y) = (y,x);

fun swap (p:int*int) = (#2p, #1p);
fun swap (p:int*int) = let val (x,y) = p in (y,x) end;
fun swap (x:int, y:int) = (y,x);

fun max (x:int, y:int) = if x<y then y else x;
max (5,3);
max (~5,3);
     */
    //TODO test types
    run_test([
        ['val (x,y) = (3,4);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(3));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
            expect(state.getDynamicValue('y')).toEqualWithType(new Val.Integer(4));
            //expect(state.getStaticValue('y')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val (x,y) = (y,x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(4));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
            expect(state.getDynamicValue('y')).toEqualWithType(new Val.Integer(3));
            //expect(state.getStaticValue('y')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun swap (p:int*int) = (#2p, #1p);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('swap')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('swap')).toEqualWithType(TODO);
        }],
        ['fun swap (p:int*int) = let val (x,y) = p in (y,x) end;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('swap')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('swap')).toEqualWithType(TODO);
        }],
        ['fun swap (x:int, y:int) = (y,x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('swap')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('swap')).toEqualWithType(TODO);
        }],
        ['fun max (x:int, y:int) = if x<y then y else x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('max')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('max')).toEqualWithType(TODO);
        }],
        ['max (5,3);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(5));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['max (~5,3);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(3));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("1.8", () => {
    /*
12 div 3;
12 mod 3;
12 div 5;
12 mod 5;

1 div 0;
     */
    //TODO test types
    run_test([
        ['12 div 3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(4));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['12 mod 3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(0));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['12 div 5;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(2));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['12 mod 5;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(2));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['1 div 0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Div'));
        }]
    ]);
});

it("1.9", () => {
    /*
fun potenz (x:int, n:int) : int =
    if n>0 then x*potenz(x,n-1) else 1;

potenz (2,10);
     */
    //TODO test types
    run_test([
        ['fun potenz (x:int, n:int) : int = if n>0 then x*potenz(x,n-1) else 1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('potenz')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('potenz')).toEqualWithType(TODO);
        }],
        ['potenz (2,10);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(1024));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("1.10", () => {
    /*
fun w (k:int,n:int) : int = if k*k>n then k else w(k+1,n);
fun wurzel (n:int) = w(1,n)-1;
wurzel 15;
     */
    //TODO test types
    run_test([
        ['fun w (k:int,n:int) : int = if k*k>n then k else w(k+1,n);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('w')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('w')).toEqualWithType(TODO);
        }],
        ['fun wurzel (n:int) = w(1,n)-1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('wurzel')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('wurzel')).toEqualWithType(TODO);
        }],
        ['wurzel 15;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(3));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("1.11", () => {
    /*
fun w (k:int, n:int) : int = if k*k>n then k else w(k+1,n);

fun p (a:int, x:int, n:int) : int = if n<1 then a else p(a*x,x,n-1);
fun potenz (x:int, n:int) = p(1,x,n);
     */
    //TODO test types
    run_test([
        ['fun w (k:int,n:int) : int = if k*k>n then k else w(k+1,n);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('w')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('w')).toEqualWithType(TODO);
        }],
        ['fun p (a:int, x:int, n:int) : int = if n<1 then a else p(a*x,x,n-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('p')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('p')).toEqualWithType(TODO);
        }],
        ['fun potenz (x:int, n:int) = p(1,x,n);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('potenz')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('potenz')).toEqualWithType(TODO);
        }]
    ]);
});

it("1.12", () => {
    /*
fun p (x:int) : int = p x;

fun q (x:int) : int = 0 + q x;

val it = q 0;
     */
    //TODO test types
    run_test([
        ['fun p (x:int) : int = p x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('p')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('p')).toEqualWithType(TODO);
        }],
        ['fun q (x:int) : int = 0 + q x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('q')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('q')).toEqualWithType(TODO);
        }],
        /*
        ['val it = q 0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            //TODO how to check for timeout?
        }]*/
    ]);
});

it("1.13.1", () => {
    /*
4*1073741823;
     */
    //TODO maybe this is no overflow for us yet?
    run_test([
        ['4*1073741823;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Overflow'));
        }]
    ]);
});

it("1.13.2", () => {
    /*
4.5 + 2.0 * 5.5;

2 * 5.5;
     */
    //TODO test types
    run_test([
        ['4.5 + 2.0 * 5.5;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(15.5));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
        ['2 * 5.5;', (x) => { expect(x).toThrow(Errors.ElaborationError); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
        }]
    ]);
});

it("1.13.3", () => {
    /*
1.0 / 3.0;
2.0 * 5.00000000001;
     */
    //TODO test types
    run_test([
        ['1.0 / 3.0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(0.3333333333333333));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
        ['2.0 * 5.00000000001;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(10.00000000002));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }]
    ]);
});

it("1.13.4", () => {
    /*
fun newton (a:real, x:real, n:int) : real =
    if n<1 then a else newton (0.5*(a+x/a), x, n-1);

fun sqrt (x:real) = newton (x/2.0, x , 5);

sqrt 4.0;
sqrt 2.0;
sqrt 81.0;
     */
    //TODO test types
    run_test([
        ['fun newton (a:real, x:real, n:int) : real = if n<1 then a else newton (0.5*(a+x/a), x, n-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('newton')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('newton')).toEqualWithType(TODO);
        }],
        ['fun sqrt (x:real) = newton (x/2.0, x , 5);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('sqrt')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('sqrt')).toEqualWithType(TODO);
        }],
        ['sqrt 4.0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(2));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
        ['sqrt 2.0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(1.414213562373095));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
        ['sqrt 81.0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(9.000009415515176));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }]
    ]);
});

it("1.14", () => {
    /*
Math.sqrt 4.0;
Real.fromInt 45;
Real.round 1.5;

Math.pi;
     */
    //TODO add the real test once we have modules
});


it("2.2.1", () => {
    /*
     fun f (t: int*int*int) =  #1t=0 then #2t else 2*(#3t);
     */
    //TODO test types
    run_test([
        ['fun f (t: int*int*int) =  #1t=0 then #2t else 2*(#3t);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("2.4", () => {
    /*
     fun p (x:int) = x;
     fun q (x:int) = 3+(p x);

     fun f (x:int) : int =  x<1 then 1 else x*f(x-1);

     */
    //TODO test types
    run_test([
        ['fun p (x:int) = x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun p (x:int) = x; fun q (x:int) = 3+(p x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun f (x:int) : int =  x<1 then 1 else x*f(x-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("2.5", () => {
    /*
     val a = 2*7;
     fun p (x:int) = x+a;

     val a = 2*7;
     fun p (x:int) = x+a;
     fun q (x:int) = x + p x;

     fun p (x:int) = x;
     fun q (x:int) = p x;
     fun p (x:int) = 2*x;
     val a = (p 5, q 5);

     */
    //TODO test types
    run_test([
        ['val a = 2*7;fun p (x:int) = x+a;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['val a = 2*7; fun p (x:int) = x+a; fun q (x:int) = x + p x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun p (x:int) = x; fun q (x:int) = p x; fun p (x:int) = 2*x; val a = (p 5, q 5);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("2.6", () => {
    /*
     fun f (x:int) : int =  x<y then 1 else x*f(x-1);

     val y = 1;
     fun f (x:int) : int =  x<y then 1 else x*f(x-1);


     */
    //TODO test types
    run_test([
        ['fun f (x:int) : int =  x<y then 1 else x*f(x-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
        }],
        ['val y = 1; fun f (x:int) : int =  x<y then 1 else x*f(x-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("2.9", () => {
    /*
     fun p (x:int, y:int) = x+y;
     fun p (y:int, x:int) = x+y;

     val x = 999999999;
     val y = x;
     val z = (x-y)*(x-y);

     val z = x*x - 2*x*y + y*y;

     fun p (x:int, y:int) = (x+y)*(x+y);
     fun q (x:int, y:int) = x*x + 2*x*y + y*y;

     */
    //TODO test types
    run_test([
        ['fun p (x:int, y:int) = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun p (y:int, x:int) = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['val x = 999999999; val y = x; val z = (x-y)*(x-y);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['val x = 999999999; val y = x; val z = x*x - 2*x*y + y*y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['val x = 999999999; val y = x; fun p (x:int, y:int) = (x+y)*(x+y);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['val x = 999999999; val y = x; fun q (x:int, y:int) = x*x + 2*x*y + y*y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

//TODO Chapter 2



it("3.1", () => {
    /*
fn (x:int) => x*x;
(fn (x:int) => x*x) 7;
fn (x:int, y:int) => x*y;
(fn (x:int, y:int) => x*y) (4,7);

fun mul (x:int) = fn (y:int) => x*y;
mul 7;
it 3;
mul 7 5;

fun mul (x:int, y:int) = x*y;
mul (7,5);

fun f (x:int) (y:int) (z:int) = x+y+z;
fun f (x:int) = fn (y:int) => fn (z:int) => x+y+z;
     */
    //TODO test types
    run_test([
        ['fn (x:int) => x*x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['(fn (x:int) => x*x) 7;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(49));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fn (x:int, y:int) => x*y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['(fn (x:int, y:int) => x*y) (4,7);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(28));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun mul (x:int) = fn (y:int) => x*y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('mul')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('mul')).toEqualWithType(TODO);
        }],
        ['mul 7;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['it 3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(21));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['mul 7 5;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(35));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun mul (x:int, y:int) = x*y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('mul')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('mul')).toEqualWithType(TODO);
        }],
        ['mul (7,5);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(35));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun f (x:int) (y:int) (z:int) = x+y+z;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }],
        ['fun f (x:int) = fn (y:int) => fn (z:int) => x+y+z;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }]
    ]);
});

it("3.2", () => {
    /*
fun f (x:int) (y:int) = x+y;
val g = f 7;

fun f (x:int) (y:int) : int = f x y;
val g = f 7;
     */
    //TODO test types
    run_test([
        ['fun f (x:int) (y:int) = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }],
        ['val g = f 7;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('g')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('g')).toEqualWithType(TODO);
        }],
        ['fun f (x:int) (y:int) : int = f x y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }],
        ['val g = f 7;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('g')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('g')).toEqualWithType(TODO);
        }]
    ]);
});

it("3.3", () => {
    /*
fun sum (f:int->int) (n:int) : int =
    if n<1 then 0 else sum f (n-1) + f n;

sum (fn (i:int) => i) 100;

sum (fn (i:int) => i*i) 10;

val gauss = sum (fn (i:int) => i);
     */
    //TODO test types
    run_test([
        ['fun sum (f:int->int) (n:int) : int = if n<1 then 0 else sum f (n-1) + f n;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('sum')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('sum')).toEqualWithType(TODO);
        }],
        ['sum (fn (i:int) => i) 100;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(5050));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['sum (fn (i:int) => i*i) 10;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(385));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val gauss = sum (fn (i:int) => i);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('gauss')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('gauss')).toEqualWithType(TODO);
        }]
    ]);
});

it("3.3.1", () => {
    /*
fun iter (n:int) (s:int) (f:int->int) : int =
    if n<1 then s else iter (n-1) (f s) f;

fun power (x:int) (n:int) = iter n 1 (fn (a:int) => a*x);
power 2 10;
     */
    //TODO test types
    run_test([
        ['fun iter (n:int) (s:int) (f:int->int) : int = if n<1 then s else iter (n-1) (f s) f;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('iter')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('iter')).toEqualWithType(TODO);
        }],
        ['fun power (x:int) (n:int) = iter n 1 (fn (a:int) => a*x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('power')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('power')).toEqualWithType(TODO);
        }],
        ['power 2 10;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(1024));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("3.3.2", () => {
    /*
fun first (s:int) (p:int->bool) : int =
    if p s then s else first (s+1) p;

fun sqrt (x:int) = first 1 (fn (k:int) => k*k>x) - 1;
sqrt 15;
     */
    //TODO test types
    run_test([
        ['fun first (s:int) (p:int->bool) : int = if p s then s else first (s+1) p;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('first')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('first')).toEqualWithType(TODO);
        }],
        ['fun sqrt (x:int) = first 1 (fn (k:int) => k*k>x) - 1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('sqrt')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('sqrt')).toEqualWithType(TODO);
        }],
        ['sqrt 15;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(3));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("3.4", () => {
    /*
fun 'a iter (n:int) (s:'a) (f:'a->'a) : 'a =
    if n<1 then s else iter (n-1) (f s) f;

fun power (x:int) (n:int) = iter n 1 (fn (a:int) => a*x);
power 2 10;
fun power' (x:real) (n:int) = iter n 1.0 (fn (a:real) => a*x);
power' 2.0 10;

fun gauss (n:int) =
    #2(iter n (1,0) (fn (i:int, a:int) => (i+1, a+i)));
gauss 10;
     */
    //TODO test types
    run_test([
        ['fun \'a iter (n:int) (s:\'a) (f:\'a->\'a) : \'a = if n<1 then s else iter (n-1) (f s) f;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('iter')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('iter')).toEqualWithType(TODO);
        }],
        ['fun power (x:int) (n:int) = iter n 1 (fn (a:int) => a*x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('power')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('power')).toEqualWithType(TODO);
        }],
        ['power 2 10;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(1024));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun power\' (x:real) (n:int) = iter n 1.0 (fn (a:real) => a*x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('power')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('power')).toEqualWithType(TODO);
        }],
        ['power\' 2.0 10;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(1024));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
        ['fun gauss (n:int) = #2(iter n (1,0) (fn (i:int, a:int) => (i+1, a+i)));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('gauss')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('gauss')).toEqualWithType(TODO);
        }],
        ['gauss 10;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(55));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("3.5", () => {
    /*
fun ('a,'b) project2 (x:'a, y:'b) = y;
project2 (1,~1);
project2 (1,true);
     */
    //TODO test types
    run_test([
        ['fun (\'a,\'b) project2 (x:\'a, y:\'b) = y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('project2')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('project2')).toEqualWithType(TODO);
        }],
        ['project2 (1,~1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(-1));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['project2 (1,true);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }]
    ]);
});

it("3.5.1", () => {
    /*
fun 'a id (x:'a) = x;

val x = id 5;

val x = id 5.0;

val x = id(id 3, id 5.0);
     */
    //TODO test types
    run_test([
        ['fun \'a id (x:\'a) = x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('id')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('id')).toEqualWithType(TODO);
        }],
        ['val x = id 5;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(5));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val x = id 5.0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Real(5));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
        ['val x = id(id 3, id 5.0);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.RecordValue(new Map([
                ['1', new Val.Integer(3)],
                ['2', new Val.Real(5)]
            ])));
            //expect(state.getStaticValue('x')).toEqualWithType(TODO);
        }]
    ]);
});

it("3.5.2", () => {
    /*
fun 'a id (x:'a) = x;

val f = id id;

val z = f 5;

val f = id id;
val z = f 5;

val f = id id;
val z = f 5;
val u = f 5.0;

val g = id;
     */
    //TODO we can't really test this unless we have ambigue types
});

it("3.6", () => {
    /*
fun con x y = if x then y else false;
fun sum f n = if n<1 then 0 else sum f (n-1) + f n;
val sqsum = sum (fn i => i*i);
fun id x = x;
fun iter n s f = if n<1 then s else iter (n-1) (f s) f;
fun power x n = iter n 1 (fn a => a*x);

fun plus x y = x+y;

fun plus (x:real) y = x+y;

fun plus x y : real = x+y;

fun plus (x:real) (y:real) : real = x+y;

fn (x,y) => (x+y : real) * x;
(fn x => x) : bool -> bool;

val f : real -> real = fn x => x;
     */
    //TODO test types
    run_test([
        ['fun con x y = if x then y else false;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('con')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('con')).toEqualWithType(TODO);
        }],
        ['fun sum f n = if n<1 then 0 else sum f (n-1) + f n;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('sum')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('sum')).toEqualWithType(TODO);
        }],
        ['val sqsum = sum (fn i => i*i);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('sqsum')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('sqsum')).toEqualWithType(TODO);
        }],
        ['fun id x = x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('id')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('id')).toEqualWithType(TODO);
        }],
        ['fun iter n s f = if n<1 then s else iter (n-1) (f s) f;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('iter')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('iter')).toEqualWithType(TODO);
        }],
        ['fun power x n = iter n 1 (fn a => a*x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('power')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('power')).toEqualWithType(TODO);
        }],
        ['fun plus x y = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('plus')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('plus')).toEqualWithType(TODO);
        }],
        ['fun plus (x:real) y = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('plus')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('plus')).toEqualWithType(TODO);
        }],
        ['fun plus x y : real = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('plus')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('plus')).toEqualWithType(TODO);
        }],
        ['fun plus (x:real) (y:real) : real = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('plus')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('plus')).toEqualWithType(TODO);
        }],
        ['fn (x,y) => (x+y : real) * x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['(fn x => x) : bool -> bool;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['val f : real -> real = fn x => x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("3.7", () => {
    /*
fun eq x y = x = y;
fun neq x y = x <> y;
fun f (x,y,z) = if x=y then x else z;
(fn x => 2*x) = (fn x => 2*x);
     */
    //TODO test types
    run_test([
        ['fun eq x y = x = y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('eq')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('eq')).toEqualWithType(TODO);
        }],
        ['fun neq x y = x <> y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('neq')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('neq')).toEqualWithType(TODO);
        }],
        ['fun f (x,y,z) = if x=y then x else z;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }],
        ['(fn x => 2*x) = (fn x => 2*x);', (x) => { expect(x).toThrow(Errors.ElaborationError); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
        }]
    ]);
});

it("3.8.1", () => {
    /*
fn x => fn y => z x (y x);
     */
    run_test([
        ['fn x => fn y => z x (y x);', (x) => { expect(x).toThrow(Errors.ElaborationError); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
        }]
    ]);
});

it("3.8.2", () => {
    /*
let
    val x = 2*x
    val x = 2*x
    fun f x = if x<2 then x
        else f(x-1)
    val f = fn x => f x
in
    f x - y
end;
     */
    run_test([
        ['let val x = 2*x val x = 2*x fun f x = if x<2 then x else f(x-1) val f = fn x => f x in f x - y end;', (x) => { expect(x).toThrow(Errors.ElaborationError); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
        }]
    ]);
});

it("3.8.3", () => {
    /*
val x = 4*5;
fun f y = if y then x else ~x;
fun id z = z;
     */
    //TODO test types
    run_test([
        ['val x = 4*5;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('x')).toEqualWithType(new Val.Integer(20));
            //expect(state.getStaticValue('x')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun f y = if y then x else ~x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }],
        ['fun id z = z;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('id')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('id')).toEqualWithType(TODO);
        }]
    ]);
});

it("3.10", () => {
    /*
fun forall m n p = m>n orelse (p m andalso forall (m+1) n p);

fun snd (_, y) = y;

op+(8,9);
op+(8.0, 9.0);
op+;
     */
    //TODO test types
    run_test([
        ['fun forall m n p = m>n orelse (p m andalso forall (m+1) n p);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('forall')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('forall')).toEqualWithType(TODO);
        }],
        ['fun snd (_, y) = y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('snd')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('snd')).toEqualWithType(TODO);
        }],
        ['op+(8,9);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(17));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['op+(8.0, 9.0);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(17));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
        ['op+;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("3.11", () => {
    /*
fun iter (n:int) (s:int) (f:int->int) : int =
    if n<1 then s else iter (n-1) (f s) f;
fun first (s:int) (p:int->bool) : int =
    if p s then s else first (s+1) p;
fun sqrt (x:int) = first 1 (fn (k:int) => k*k>x) - 1;
fun forall m n p = m>n orelse (p m andalso forall (m+1) n p);

fun prime x = x>=2 andalso
                forall 2 (sqrt x) (fn k => x mod k <> 0);

fun nextprime x = first (x+1) prime;

fun nthprime n = iter n 1 nextprime;
nthprime 100;
     */
    //TODO test types
    run_test([
        ['fun iter (n:int) (s:int) (f:int->int) : int = if n<1 then s else iter (n-1) (f s) f;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('iter')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('iter')).toEqualWithType(TODO);
        }],
        ['fun first (s:int) (p:int->bool) : int = if p s then s else first (s+1) p;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('first')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('first')).toEqualWithType(TODO);
        }],
        ['fun sqrt (x:int) = first 1 (fn (k:int) => k*k>x) - 1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('sqrt')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('sqrt')).toEqualWithType(TODO);
        }],
        ['fun forall m n p = m>n orelse (p m andalso forall (m+1) n p);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('forall')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('forall')).toEqualWithType(TODO);
        }],
        ['fun prime x = x>=2 andalso forall 2 (sqrt x) (fn k => x mod k <> 0);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('prime')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('prime')).toEqualWithType(TODO);
        }],
        ['fun nextprime x = first (x+1) prime;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('nextprime')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('nextprime')).toEqualWithType(TODO);
        }],
        ['fun nthprime n = iter n 1 nextprime;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('nthprime')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('nthprime')).toEqualWithType(TODO);
        }],
        ['nthprime 100;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(541));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("3.12", () => {
    /*
fun compose f g x = f (g x);

fun plus x y = x+y;
fun times x y = x*y;
val foo = compose (plus 2) (times 3);
foo 4;

val foo = (plus 2) o (times 3);
foo 7;
op o;
     */
    //TODO test types
    run_test([
        ['fun compose f g x = f (g x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('compose')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('compose')).toEqualWithType(TODO);
        }],
        ['fun plus x y = x+y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('plus')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('plus')).toEqualWithType(TODO);
        }],
        ['fun times x y = x*y;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('times')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('times')).toEqualWithType(TODO);
        }],
        ['val foo = compose (plus 2) (times 3);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('foo')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('foo')).toEqualWithType(TODO);
        }],
        ['foo 4;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(14));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['val foo = (plus 2) o (times 3);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('foo')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('foo')).toEqualWithType(TODO);
        }],
        ['foo 7;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(23));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['op o;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("3.13", () => {
    /*
fun iterup m n s f = if m>n then s else iterup (m+1) n (f(m,s)) f;
fun iterdn n m s f = if n<m then s else iterdn (n-1) m (f(n,s)) f;
     */
    //TODO test types
    run_test([
        ['fun iterup m n s f = if m>n then s else iterup (m+1) n (f(m,s)) f;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('iterup')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('iterup')).toEqualWithType(TODO);
        }],
        ['fun iterdn n m s f = if n<m then s else iterdn (n-1) m (f(n,s)) f;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('iterdn')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('iterdn')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.1.1", () => {
    /*
[1, 2, 3];
[2, 3] @ [4, 5, 6];
op@;
[1.0, 2.0, 3.0];
[(2,3), (5,1), (7,2)];
[[2, 3], [4, 5, 6], []];

[1,2,3,4] = [1] @ [2,3,4];
     */
    //TODO test types
    run_test([
        ['[1, 2, 3];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(1),
                new Val.Integer(2),
                new Val.Integer(3)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['[2, 3] @ [4, 5, 6];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(2),
                new Val.Integer(3),
                new Val.Integer(4),
                new Val.Integer(5),
                new Val.Integer(6)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['op@;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['[1.0, 2.0, 3.0];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Real(1),
                new Val.Real(2),
                new Val.Real(3)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['[(2,3), (5,1), (7,2)];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                createTuple([new Val.Integer(2), new Val.Integer(3)]),
                createTuple([new Val.Integer(5), new Val.Integer(1)]),
                createTuple([new Val.Integer(7), new Val.Integer(2)])
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['[[2, 3], [4, 5, 6], []];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                createList([new Val.Integer(2), new Val.Integer(3)]),
                createList([new Val.Integer(4), new Val.Integer(5), new Val.Integer(6)]),
                createList([])
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['[1,2,3,4] = 1 :: [2,3,4];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }]
    ]);
});

it("4.1.2", () => {
    /*
(1,(2,()));

val xs = 1::(2::nil);
val ys = 0::xs;

1::2::3::nil = [1,2,3];
1::2::3::nil = 1::[2,3];
[1,2,3] @ [3,5,6] @ [2,6,9];
1::2::3::nil @ 4::5::nil;
     */
    //TODO test types
    run_test([
        ['(1,(2,()));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createTuple([
                new Val.Integer(1),
                createTuple([
                    new Val.Integer(2),
                    createTuple([])
                ])
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['val xs = 1::(2::nil);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('xs')).toEqualWithType(createList([
                new Val.Integer(1),
                new Val.Integer(2)
            ]));
            //expect(state.getStaticValue('xs')).toEqualWithType(TODO);
        }],
        ['val ys = 0::xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('ys')).toEqualWithType(createList([
                new Val.Integer(0),
                new Val.Integer(1),
                new Val.Integer(2)
            ]));
            //expect(state.getStaticValue('ys')).toEqualWithType(TODO);
        }],
        ['1::2::3::nil = [1,2,3];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['1::2::3::nil = 1::[2,3];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['[1,2,3] @ [3,5,6] @ [2,6,9];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(1),
                new Val.Integer(2),
                new Val.Integer(3),
                new Val.Integer(3),
                new Val.Integer(5),
                new Val.Integer(6),
                new Val.Integer(2),
                new Val.Integer(6),
                new Val.Integer(9)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['1::2::3::nil @ 4::5::nil;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(1),
                new Val.Integer(2),
                new Val.Integer(3),
                new Val.Integer(4),
                new Val.Integer(5)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.1.3", () => {
    /*
fun length nil = 0
  | length (x::xr) = 1 + length xr;
length [1,1,1,1];
     */
    //TODO test types
    run_test([
        ['fun length nil = 0 | length (x::xr) = 1 + length xr;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('length')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('length')).toEqualWithType(TODO);
        }],
        ['length [1,1,1,1];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(4));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("4.2", () => {
    /*
fun append (nil, ys) = ys
  | append (x::xr, ys) = x::append(xr,ys);
append([2,3], [6,7,8]);

fun rev nil = nil
  | rev (x::xr) = rev xr @ [x];
rev [1, 2, 3, 4];

fun concat nil = nil
  | concat (x::xr) = x @ concat xr;


fun iterdn n m s f = if n<m then s else iterdn (n-1) m (f(n,s)) f;

fun tabulate (n,f) = iterdn (n-1) 0 nil (fn (i,xs) => f i::xs);

tabulate(5, fn x => x);
tabulate(5, fn x => x*x)

(* length, rev, List.concat, List.tabulate have to be predefined *)
     */
    //TODO test types
    run_test([
        ['fun append (nil, ys) = ys | append (x::xr, ys) = x::append(xr,ys);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('append')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('append')).toEqualWithType(TODO);
        }],
        ['append([2,3], [6,7,8]);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(2),
                new Val.Integer(3),
                new Val.Integer(6),
                new Val.Integer(7),
                new Val.Integer(8)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun rev nil = nil | rev (x::xr) = rev xr @ [x];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('rev')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('rev')).toEqualWithType(TODO);
        }],
        ['rev [1, 2, 3, 4];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(4),
                new Val.Integer(3),
                new Val.Integer(2),
                new Val.Integer(1)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun concat nil = nil | concat (x::xr) = x @ concat xr;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('concat')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('concat')).toEqualWithType(TODO);
        }],
        ['fun iterdn n m s f = if n<m then s else iterdn (n-1) m (f(n,s)) f;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('iterdn')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('iterdn')).toEqualWithType(TODO);
        }],
        ['fun tabulate (n,f) = iterdn (n-1) 0 nil (fn (i,xs) => f i::xs);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('tabulate')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('tabulate')).toEqualWithType(TODO);
        }],
        ['tabulate(5, fn x => x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(0),
                new Val.Integer(1),
                new Val.Integer(2),
                new Val.Integer(3),
                new Val.Integer(4)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['tabulate(5, fn x => x*x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(0),
                new Val.Integer(1),
                new Val.Integer(4),
                new Val.Integer(9),
                new Val.Integer(16)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.3", () => {
    /*
(* map + List.filter + List.exists + List.all should also be predefined *)
fun map f nil = nil
  | map f (x::xr) = (f x) :: (map f xr);

map (fn x => 2*x) [2, 4, 11, 34];
map op~ [2, 4, 11, 34];
fun minus5 xs = map (fn x => x-5) xs;
minus5 [3, 6, 99, 72];
map rev [[3, 4, 5], [2, 3], [7, 8, 9]];
map length [[3, 4, 5], [2, 3], [7, 8, 9]];

fun filter f nil = nil
  | filter f (x::xr) = if f x then x :: filter f xr
                        else filter f xr;

filter (fn x => x<0) [0, ~1, 2, ~3, ~4];
filter (fn x => x>=0) [0, ~1, 2, ~3, ~4];

fun exists f nil = false
  | exists f (x::xr) = f x orelse exists f xr;

exists (fn x => x<0) [1, 2, 3];
exists (fn x => x<0) [1, ~2, 3];

fun all f nil = true
  | all f (x::xr) = f x andalso all f xr;
all (fn x => x>0) [1, 2, 3];
all (fn x => x>0) [1, ~2, 3];
     */
    //TODO test types
    run_test([
        ['fun map f nil = nil | map f (x::xr) = (f x) :: (map f xr);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('map')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('map')).toEqualWithType(TODO);
        }],
        ['map (fn x => 2*x) [2, 4, 11, 34];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(4),
                new Val.Integer(8),
                new Val.Integer(22),
                new Val.Integer(68)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['map op~ [2, 4, 11, 34];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(-2),
                new Val.Integer(-4),
                new Val.Integer(-11),
                new Val.Integer(-34)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun minus5 xs = map (fn x => x-5) xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('minus5')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('minus5')).toEqualWithType(TODO);
        }],
        ['minus5 [3, 6, 99, 72];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(-2),
                new Val.Integer(1),
                new Val.Integer(94),
                new Val.Integer(67)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['map rev [[3, 4, 5], [2, 3], [7, 8, 9]];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                createList([new Val.Integer(5), new Val.Integer(4), new Val.Integer(3)]),
                createList([new Val.Integer(3), new Val.Integer(2)]),
                createList([new Val.Integer(9), new Val.Integer(8), new Val.Integer(7)])
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['map length [[3, 4, 5], [2, 3], [7, 8, 9]];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(3),
                new Val.Integer(2),
                new Val.Integer(3)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun filter f nil = nil | filter f (x::xr) = if f x then x :: filter f xr else filter f xr;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('filter')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('filter')).toEqualWithType(TODO);
        }],
        ['filter (fn x => x<0) [0, ~1, 2, ~3, ~4];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(-1),
                new Val.Integer(-3),
                new Val.Integer(-4)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['filter (fn x => x>=0) [0, ~1, 2, ~3, ~4];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(0),
                new Val.Integer(2)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun exists f nil = false | exists f (x::xr) = f x orelse exists f xr;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('exists')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('exists')).toEqualWithType(TODO);
        }],
        ['exists (fn x => x<0) [1, 2, 3];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(false));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['exists (fn x => x<0) [1, ~2, 3];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['fun all f nil = true | all f (x::xr) = f x andalso all f xr;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('all')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('all')).toEqualWithType(TODO);
        }],
        ['all (fn x => x>0) [1, 2, 3];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['all (fn x => x>0) [1, ~2, 3];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(false));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }]
    ]);
});

it("4.4", () => {
    /*
fun sum xs = foldl op+ 0 xs;

sum [4,3,6,2,8];

fun rev xs = foldl op:: nil xs;

fun append (xs,ys) = foldr op:: ys xs;

fun length xs = foldl (fn (x,n) => n+1) 0 xs;
fun append (xs,ys) = foldr op:: ys xs;
fun rev xs = foldl op:: nil xs;
fun concat xs = foldr op@ nil xs;
fun map f = foldr (fn (x,yr) => (f x)::yr) nil;
fun filter f = foldr (fn (x,ys) => if f x then x::ys else ys) nil;

fun foldl f s nil = s
  | foldl f s (x::xr) = foldl f (f(x,s)) xr;
fun foldr f s nil = s
  | foldr f s (x::xr) = f(x, foldr f s xr);
     */
    //TODO test types
    run_test([
        ['fun sum xs = foldl op+ 0 xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('sum')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('sum')).toEqualWithType(TODO);
        }],
        ['sum [4,3,6,2,8];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(23));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun rev xs = foldl op:: nil xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('rev')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('rev')).toEqualWithType(TODO);
        }],
        ['fun append (xs,ys) = foldr op:: ys xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('append')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('append')).toEqualWithType(TODO);
        }],
        ['fun length xs = foldl (fn (x,n) => n+1) 0 xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('length')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('length')).toEqualWithType(TODO);
        }],
        ['fun rev xs = foldl op:: nil xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('rev')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('rev')).toEqualWithType(TODO);
        }],
        ['fun concat xs = foldr op@ nil xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('concat')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('concat')).toEqualWithType(TODO);
        }],
        ['fun map f = foldr (fn (x,yr) => (f x)::yr) nil;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('map')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('map')).toEqualWithType(TODO);
        }],
        ['fun filter f = foldr (fn (x,ys) => if f x then x::ys else ys) nil;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('filter')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('filter')).toEqualWithType(TODO);
        }],
        ['fun foldl f s nil = s | foldl f s (x::xr) = foldl f (f(x,s)) xr;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('foldl')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('foldl')).toEqualWithType(TODO);
        }],
        ['fun foldr f s nil = s | foldr f s (x::xr) = f(x, foldr f s xr);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('foldr')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('foldr')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.5", () => {
    /*
hd [1,2,3,4,5];
tl [1,2,3,4,5];

hd nil;
tl nil;

fun hd nil = raise Empty
  | hd (x::xr) = x;
fun tl nil = raise Empty
  | tl (x::xr) = xr;

fun null nil = true
  | null (x::xr) = false;

fun append (xs,ys) = if null xs then ys
                    else hd xs :: append(tl xs, ys);

fun append (xs,ys) = if xs=nil then ys
                    else hd xs :: append(tl xs, ys);


fun nth(xs,n) = if n<0 orelse null xs then raise Subscript
                else if n=0 then hd xs else nth(tl xs, n-1);
nth ([3,4,5], 0);
nth ([3,4,5], 2);
nth ([3,4,5], 3);
     */
    //TODO test types
    run_test([
        ['hd [1,2,3,4,5];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(1));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['tl [1,2,3,4,5];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(2),
                new Val.Integer(3),
                new Val.Integer(4),
                new Val.Integer(5)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['hd nil;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Empty'));
        }],
        ['tl nil;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Empty'));
        }],
        ['fun hd nil = raise Empty | hd (x::xr) = x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('hd')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('hd')).toEqualWithType(TODO);
        }],
        ['fun tl nil = raise Empty | tl (x::xr) = xr;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('tl')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('tl')).toEqualWithType(TODO);
        }],
        ['fun null nil = true | null (x::xr) = false;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('null')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('null')).toEqualWithType(TODO);
        }],
        ['fun append (xs,ys) = if null xs then ys else hd xs :: append(tl xs, ys);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('append')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('append')).toEqualWithType(TODO);
        }],
        ['fun append (xs,ys) = if xs=nil then ys else hd xs :: append(tl xs, ys);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('append')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('append')).toEqualWithType(TODO);
        }],
        ['fun nth(xs,n) = if n<0 orelse null xs then raise Subscript else if n=0 then hd xs else nth(tl xs, n-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('nth')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('nth')).toEqualWithType(TODO);
        }],
        ['nth ([3,4,5], 0);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(3));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['nth ([3,4,5], 2);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(5));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['nth ([3,4,5], 3);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Subscript'));
        }]
    ]);
});

it("4.6", () => {
    /*
fun rev nil = nil
  | rev (x::xr) = rev xr @ [x];

fun test [] = 0
  | test [(x,y)] = x+y
  | test [(x,5), (7,y)] = x*y
  | test (_::_::ps) = test ps;
     */
    //TODO test types
    //TODO maybe test the functions work?
    run_test([
        ['fun rev nil = nil | rev (x::xr) = rev xr @ [x];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('rev')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('rev')).toEqualWithType(TODO);
        }],
        ['fun test [] = 0 | test [(x,y)] = x+y | test [(x,5), (7,y)] = x*y | test (_::_::ps) = test ps;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('test')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('test')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.6.1", () => {
    /*
fun length nil = 0
  | length (_::xr) = 1 + length xr;

fun length (_::xr) = 1 + length xr
  | length nil = 0;

fun test (_::_::_) = true
  | test _ = false;

fun power (x, 0) = 1
  | power (x, n) = x * power(x, n-1);

fun potenz (x,n) = if n<1 then 1 else x*potenz(x,n-1);

fun or (false, false) = false
  | or _ = true;
     */
    //TODO test types
    //TODO maybe test the functions work?
    run_test([
        ['fun length nil = 0 | length (_::xr) = 1 + length xr;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('length')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('length')).toEqualWithType(TODO);
        }],
        ['fun length (_::xr) = 1 + length xr | length nil = 0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('length')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('length')).toEqualWithType(TODO);
        }],
        ['fun test (_::_::_) = true | test _ = false;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('test')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('test')).toEqualWithType(TODO);
        }],
        ['fun power (x, 0) = 1 | power (x, n) = x * power(x, n-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('power')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('power')).toEqualWithType(TODO);
        }],
        ['fun potenz (x,n) = if n<1 then 1 else x*potenz(x,n-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('potenz')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('potenz')).toEqualWithType(TODO);
        }],
        ['fun or (false, false) = false | or _ = true;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('or')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('or')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.6.2", () => {
    /*
fun test nil = 0
  | test [_] = 1;

exception SomethingWrong;
fun test nil = 0
  | test [_] = 1
  | test _ = raise SomethingWrong;
test [1,2];
     */
    //TODO test types
    //TODO somehow check for non exhaustive matching warning
    run_test([
        ['fun test nil = 0 | test [_] = 1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('test')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('test')).toEqualWithType(TODO);
        }],
        ['exception SomethingWrong;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('SomethingWrong')).toEqualWithType(new Val.ExceptionConstructor('SomethingWrong'));
            //expect(state.getStaticValue('SomethingWrong')).toEqualWithType(TODO);
        }],
        ['fun test nil = 0 | test [_] = 1 | test _ = raise SomethingWrong;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('test')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('test')).toEqualWithType(TODO);
        }],
        ['test [1,2];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('SomethingWrong'));
        }]
    ]);
});

it("4.6.3", () => {
    /*
fn true => false
 | false => true;

fun test xs y = case rev xs
                of _::x::_ => x<y
                | _ => false;
     */
    //TODO test types
    //TODO maybe test the functions work?
    run_test([
        ['fn true => false | false => true;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun test xs y = case rev xs of _::x::_ => x<y | _ => false;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.6.4", () => {
    /*
fun or false false = false
  | or _ _ = true;

fun or x y = case (x,y)
            of (false, false) => false
            | ( _ , _ ) => true;

fun or (x:bool) = fn (y:bool) =>
                    (fn (false , false ) => false
                    | (a:bool, b:bool) => true ) (x,y);
     */
    //TODO test types
    //TODO maybe test the functions work?
    run_test([
        ['fun or false false = false | or _ _ = true;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('or')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('or')).toEqualWithType(TODO);
        }],
        ['fun or x y = case (x,y) of (false, false) => false | ( _ , _ ) => true;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('or')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('or')).toEqualWithType(TODO);
        }],
        ['fun or (x:bool) = fn (y:bool) => (fn (false , false ) => false | (a:bool, b:bool) => true ) (x,y);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('or')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('or')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.7", () => {
    /*
"Saarbrücken";
"4567899999999 is a large number";
"true ist ein Boolescher Wert";

#"M";
[#"S", #"M", #"L"];

explode("Hallo");
implode [#"H", #"a", #"l", #"l", #"o"];

"Programmier" ^ "sprache";
"Aller " ^ "Anfang " ^ "ist schwer.";
op^;

fn (s,s') => implode(explode s @ explode s');
     */
    //TODO test types
    run_test([
        ['"Saarbrücken";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.StringValue("Saarbrücken"));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('string'));
        }],
        ['"4567899999999 is a large number";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.StringValue("4567899999999 is a large number"));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('string'));
        }],
        ['"true ist ein Boolescher Wert";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.StringValue("true ist ein Boolescher Wert"));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('string'));
        }],
        ['#"M";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.CharValue("M"));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('char'));
        }],
        ['[#"S", #"M", #"L"];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.CharValue("S"),
                new Val.CharValue("M"),
                new Val.CharValue("L")
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['explode("Hallo");', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.CharValue("H"),
                new Val.CharValue("a"),
                new Val.CharValue("l"),
                new Val.CharValue("l"),
                new Val.CharValue("o")
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['implode [#"H", #"a", #"l", #"l", #"o"];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.StringValue("Hallo"));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('string'));
        }],
        ['"Programmier" ^ "sprache";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.StringValue("Programmiersprache"));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('string'));
        }],
        ['"Aller " ^ "Anfang " ^ "ist schwer.";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.StringValue("Aller Anfang ist schwer."));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('string'));
        }],
        ['op^;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fn (s,s\') => implode(explode s @ explode s\');', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.7.1", () => {
    /*
ord #"1";
chr 49;
map ord (explode "019abz");
chr 255;
chr 256;

"\"\\\t\na";
explode "\"\\\t\na";
     */
    //TODO test types
    run_test([
        ['ord #"1";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(49));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['chr 49;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.CharValue('1'));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('char'));
        }],
        ['map ord (explode "019abz");', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(48),
                new Val.Integer(49),
                new Val.Integer(57),
                new Val.Integer(97),
                new Val.Integer(98),
                new Val.Integer(122)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['chr 255;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.CharValue(String.fromCharCode(255)));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('char'));
        }],
        ['chr 256;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Chr'));
        }],
        ['"\\"\\\\\\t\\na";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.StringValue('\"\\\t\na'));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('string'));
        }],
        ['explode "\\"\\\\\\t\\na";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.CharValue('\"'),
                new Val.CharValue('\\'),
                new Val.CharValue('\t'),
                new Val.CharValue('\n'),
                new Val.CharValue('a')
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("4.7.2", () => {
    /*
"Adam" < "Eva";
"Adam" < "Adamo";

"rufen" < "Zukunft";

map ord (explode "ABab");
     */
    //TODO test types
    run_test([
        ['"Adam" < "Eva";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['"Adam" < "Adamo";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['"rufen" < "Zukunft";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(false));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['map ord (explode "ABab");', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(65),
                new Val.Integer(66),
                new Val.Integer(97),
                new Val.Integer(98)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("5.1", () => {
    /*
fun insert (x, nil) = [x]
  | insert (x, y::yr) = if x<=y then x::y::yr else y::insert(x,yr);
fun isort xs = foldl insert nil xs;

fun pisort compare =
    let
        fun insert (x, nil) = [x]
          | insert (x, y::yr) = case compare(x,y) of
                                GREATER => y::insert(x,yr)
                                | _ => x::y::yr
    in
        foldl insert nil
    end;

val xs = List.tabulate(5000, fn x => x);
val ys = rev xs;
     */
    //TODO test types
    run_test([
        ['fun insert (x, nil) = [x] | insert (x, y::yr) = if x<=y then x::y::yr else y::insert(x,yr);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('insert')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('insert')).toEqualWithType(TODO);
        }],
        ['fun isort xs = foldl insert nil xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('isort')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('isort')).toEqualWithType(TODO);
        }],
        ['fun pisort compare = let fun insert (x, nil) = [x] | insert (x, y::yr) = case compare(x,y) of GREATER => y::insert(x,yr) | _ => x::y::yr in foldl insert nil end;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('pisort')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('pisort')).toEqualWithType(TODO);
        }],
        ['val xs = List.tabulate(5000, fn x => x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            let res = [];
            for (let i = 0; i < 5000; ++i) {
                res.push(new Val.Integer(i));
            }
            expect(state.getDynamicValue('xs')).toEqualWithType(createList(res));
            //expect(state.getStaticValue('xs')).toEqualWithType(TODO);
        }],
        ['val ys = rev xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            let res = [];
            for (let i = 5000-1; i >= 0; --i) {
                res.push(new Val.Integer(i));
            }
            expect(state.getDynamicValue('ys')).toEqualWithType(createList(res));
            //expect(state.getStaticValue('ys')).toEqualWithType(TODO);
        }]
    ]);
});

it("5.2", () => {
    /*
fun insert (x, nil) = [x]
  | insert (x, y::yr) = if x<=y then x::y::yr else y::insert(x,yr);
fun pisort compare =
    let
        fun insert (x, nil) = [x]
          | insert (x, y::yr) = case compare(x,y) of
                                GREATER => y::insert(x,yr)
                                | _ => x::y::yr
    in
        foldl insert nil
    end;

pisort Int.compare;
pisort Int.compare [5, 2, 2, 13, 4, 9, 9, 13, ~2];
pisort Real.compare [5.0, 2.0, 2.0, 13.0, 4.0, 9.0];
     */
    //TODO test types
    run_test([
        ['fun insert (x, nil) = [x] | insert (x, y::yr) = if x<=y then x::y::yr else y::insert(x,yr);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            // copy from 5.1
        }],
        ['fun pisort compare = let fun insert (x, nil) = [x] | insert (x, y::yr) = case compare(x,y) of GREATER => y::insert(x,yr) | _ => x::y::yr in foldl insert nil end;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            // copy from 5.1
        }],
        ['pisort Int.compare;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['pisort Int.compare [5, 2, 2, 13, 4, 9, 9, 13, ~2];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(-2),
                new Val.Integer(2),
                new Val.Integer(2),
                new Val.Integer(4),
                new Val.Integer(5),
                new Val.Integer(9),
                new Val.Integer(9),
                new Val.Integer(13),
                new Val.Integer(13)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['pisort Real.compare [5.0, 2.0, 2.0, 13.0, 4.0, 9.0];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Real(2),
                new Val.Real(2),
                new Val.Real(4),
                new Val.Real(5),
                new Val.Real(9),
                new Val.Real(13)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("5.3", () => {
    /*
fun insert (x, nil) = [x]
  | insert (x, y::yr) = if x<=y then x::y::yr else y::insert(x,yr);
fun pisort compare =
    let
        fun insert (x, nil) = [x]
          | insert (x, y::yr) = case compare(x,y) of
                                GREATER => y::insert(x,yr)
                                | _ => x::y::yr
    in
        foldl insert nil
    end;

fun invert (compare : 'a * 'a -> order) (x,y) = compare (y,x);
pisort (invert Int.compare) [5, 2, 2, 13, 4, 9, 9, 13, ~2];

fun lex (compare : 'a * 'a -> order) p = case p of
                                        (nil, _::_) => LESS
                                        | (nil, nil) => EQUAL
                                        | (_::_, nil) => GREATER
                                        | (x::xr, y::yr) => case compare(x,y) of
                                        EQUAL => lex compare (xr,yr)
                                        | s => s;

pisort (lex Int.compare) [[4,1], [], [4], [4,1,~8]];
     */
    //TODO test types
    run_test([
        ['fun insert (x, nil) = [x] | insert (x, y::yr) = if x<=y then x::y::yr else y::insert(x,yr);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            // copy from 5.1
        }],
        ['fun pisort compare = let fun insert (x, nil) = [x] | insert (x, y::yr) = case compare(x,y) of GREATER => y::insert(x,yr) | _ => x::y::yr in foldl insert nil end;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            // copy from 5.1
        }],
        ['fun invert (compare : \'a * \'a -> order) (x,y) = compare (y,x);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('invert')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('invert')).toEqualWithType(TODO);
        }],
        ['pisort (invert Int.compare) [5, 2, 2, 13, 4, 9, 9, 13, ~2];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(13),
                new Val.Integer(13),
                new Val.Integer(9),
                new Val.Integer(9),
                new Val.Integer(5),
                new Val.Integer(4),
                new Val.Integer(2),
                new Val.Integer(2),
                new Val.Integer(-2)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun lex (compare : \'a * \'a -> order) p = case p of (nil, _::_) => LESS | (nil, nil) => EQUAL | (_::_, nil) => GREATER | (x::xr, y::yr) => case compare(x,y) of EQUAL => lex compare (xr,yr) | s => s;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('lex')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('lex')).toEqualWithType(TODO);
        }],
       ['pisort (lex Int.compare) [[4,1], [], [4], [4,1,~8]];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
           expect(state.getDynamicValue('it')).toEqualWithType(createList([
               createList([]),
               createList([new Val.Integer(4)]),
               createList([new Val.Integer(4),new Val.Integer(1)]),
               createList([new Val.Integer(4),new Val.Integer(1),new Val.Integer(-8)])
           ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("5.4", () => {
    /*
fun split xs = foldl (fn (x, (ys,zs)) => (zs, x::ys))
                    (nil, nil) xs;
fun merge (nil , ys ) = ys
 | merge (xs , nil ) = xs
 | merge (x::xr, y::yr) = if x<=y then x::merge(xr,y::yr)
                            else y::merge(x::xr,yr);
fun msort [] = []
  | msort [x] = [x]
  | msort xs = let val (ys,zs) = split xs
                in merge(msort ys, msort zs) end;
     */
    //TODO test types
    run_test([
        ['fun split xs = foldl (fn (x, (ys,zs)) => (zs, x::ys)) (nil, nil) xs;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('split')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('split')).toEqualWithType(TODO);
        }],
        ['fun merge (nil , ys ) = ys | merge (xs , nil ) = xs | merge (x::xr, y::yr) = if x<=y then x::merge(xr,y::yr) else y::merge(x::xr,yr);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('merge')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('merge')).toEqualWithType(TODO);
        }],
        ['fun msort [] = [] | msort [x] = [x] | msort xs = let val (ys,zs) = split xs in merge(msort ys, msort zs) end;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('msort')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('msort')).toEqualWithType(TODO);
        }]
    ]);
});

it("5.6", () => {
    /*
fun pf'(k,n) = if k*k>n then [n] else
                if n mod k = 0 then k::pf'(k, n div k)
                else pf'(k+1,n);
fun pf n = pf'(2,n);
pf 1989;
     */
    //TODO test types
    run_test([
        ['fun pf\'(k,n) = if k*k>n then [n] else if n mod k = 0 then k::pf\'(k, n div k) else pf\'(k+1,n);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('pf\'')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('pf\'')).toEqualWithType(TODO);
        }],
        ['fun pf n = pf\'(2,n);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('pf')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('pf')).toEqualWithType(TODO);
        }],
        ['pf 1989;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.Integer(3),
                new Val.Integer(3),
                new Val.Integer(13),
                new Val.Integer(17)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

it("6.1", () => {
    /*
datatype shape =
    Circle of real
  | Square of real
  | Triangle of real * real * real;

Circle 4.0;
Square 3.0;
Triangle (4.0, 3.0, 5.0);

fun area (Circle r) = Math.pi*r*r
  | area (Square a) = a*a
  | area (Triangle(a,b,c)) = let val s = (a+b+c)/2.0
                            in Math.sqrt(s*(s-a)*(s-b)*(s-c))
                            end;
area (Square 3.0);
area (Triangle(6.0, 6.0, Math.sqrt 72.0));
     */
    //TODO test types
    run_test([
        ['datatype shape = Circle of real | Square of real | Triangle of real * real * real;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Circle')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Circle')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Square')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Square')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Triangle')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Triangle')).toEqualWithType(TODO);
        }],
        ['Circle 4.0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('Circle', new Val.Real(4)));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['Square 3.0;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('Square', new Val.Real(3)));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['Triangle (4.0, 3.0, 5.0);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('Triangle',
                new Val.RecordValue(new Map([
                    ['1', new Val.Real(4)],
                    ['2', new Val.Real(3)],
                    ['3', new Val.Real(5)]
                ]))
            ));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun area (Circle r) = Math.pi*r*r | area (Square a) = a*a | area (Triangle(a,b,c)) = let val s = (a+b+c)/2.0 in Math.sqrt(s*(s-a)*(s-b)*(s-c)) end;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('area')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('area')).toEqualWithType(TODO);
        }],
        ['area (Square 3.0);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(9));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
        ['area (Triangle(6.0, 6.0, Math.sqrt 72.0));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Real(17.99999999999999));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }],
    ]);
});

it("6.2", () => {
    /*
datatype day = Monday | Tuesday | Wednesday
            | Thursday | Friday | Saturday | Sunday;

fun weekend Saturday = true
  | weekend Sunday = true
  | weekend _ = false;

weekend Saturday;
map weekend [Monday, Wednesday, Friday, Saturday, Sunday];

(* rebinding is NOT allowed here *)
datatype bool = false | true;
datatype order = LESS | EQUAL | GREATER;
     */
    //TODO test types
    //TODO maybe test the forbidden rebinding
    run_test([
        ['datatype day = Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Monday')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Monday')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Tuesday')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Tuesday')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Wednesday')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Wednesday')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Thursday')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Thursday')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Friday')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Friday')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Saturday')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Saturday')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Sunday')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Sunday')).toEqualWithType(TODO);
        }],
        ['fun weekend Saturday = true | weekend Sunday = true | weekend _ = false;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('weekend')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('weekend')).toEqualWithType(TODO);
        }],
        ['weekend Saturday;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['map weekend [Monday, Wednesday, Friday, Saturday, Sunday];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.BoolValue(false),
                new Val.BoolValue(false),
                new Val.BoolValue(false),
                new Val.BoolValue(true),
                new Val.BoolValue(true)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('real'));
        }]
    ]);
});

it("6.3", () => {
    /*
type point = real * real;

datatype object = Circle of point * real
                | Triangle of point * point * point;

fun mirror ((x,y):point) = (x,~y);

datatype point = Point of real * real;

Point (2.0, 3.0);
fun mirror (Point(x,y)) = Point(x,~y);
     */
    //TODO test types
    run_test([
        ['type point = real * real;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            //TODO check type point is set
        }],
        ['datatype object = Circle of point * real | Triangle of point * point * point;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Circle')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Circle')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Triangle')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Triangle')).toEqualWithType(TODO);
        }],
        ['fun mirror ((x,y):point) = (x,~y);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('mirror')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('mirror')).toEqualWithType(TODO);
        }],
        ['datatype point = Point of real * real;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Point')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Point')).toEqualWithType(TODO);
        }],
        ['Point (2.0, 3.0);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('Point', new Val.RecordValue(new Map([
                ['1', new Val.Real(2)],
                ['2', new Val.Real(3)]
            ]))));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun mirror (Point(x,y)) = Point(x,~y);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('mirror')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('mirror')).toEqualWithType(TODO);
        }]
    ]);
});

it("6.4", () => {
    /*
type var = string;

datatype exp = C of int | V of var | A of exp * exp | M of exp * exp;

val e = M(A(M(C 2, V "x"), V "y"), A(V "x", C 3));
     */
    //TODO test types
    run_test([
        ['type var = string;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
        }],
        ['datatype exp = C of int | V of var | A of exp * exp | M of exp * exp;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('C')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('C')).toEqualWithType(TODO);
            expect(state.getDynamicValue('V')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('V')).toEqualWithType(TODO);
            expect(state.getDynamicValue('A')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('A')).toEqualWithType(TODO);
            expect(state.getDynamicValue('M')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('M')).toEqualWithType(TODO);
        }],
        ['val e = M(A(M(C 2, V "x"), V "y"), A(V "x", C 3));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('e')).toEqualWithType(new Val.ConstructedValue('M', new Val.RecordValue(new Map([
                ['1', new Val.ConstructedValue('A', new Val.RecordValue(new Map([
                    ['1', new Val.ConstructedValue('M', new Val.RecordValue(new Map([
                        ['1', new Val.ConstructedValue('C',
                            new Val.Integer(2)
                        )],
                        ['2', new Val.ConstructedValue('V',
                            new Val.StringValue('x')
                        )]
                    ])))],
                    ['2', new Val.ConstructedValue('V',
                        new Val.StringValue('y')
                    )]
                ])))],
                ['2', new Val.ConstructedValue('A', new Val.RecordValue(new Map([
                    ['1', new Val.ConstructedValue('V',
                        new Val.StringValue('x')
                    )],
                    ['2', new Val.ConstructedValue('C',
                        new Val.Integer(3)
                    )],
                ]))))]
            ]))));
            //expect(state.getStaticValue('e')).toEqualWithType(TODO);
        }]
    ]);
});

it("6.4.1", () => {
    /*
type var = string;
datatype exp = C of int | V of var | A of exp * exp | M of exp * exp;

fun components (A(e,e')) = [e, e']
  | components (M(e,e')) = [e, e']
  | components _ = nil;

components (A(C 3, V "z"));

fun subexps e = e::
    (case e of
        A(e1,e2) => subexps e1 @ subexps e2
      | M(e1,e2) => subexps e1 @ subexps e2
      | _ => nil);
     */
    //TODO test types
    run_test([
        ['type var = string;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // copy from 6.4
        }],
        ['datatype exp = C of int | V of var | A of exp * exp | M of exp * exp;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // copy from 6.4
        }],
        ['fun components (A(e,e\')) = [e, e\'] | components (M(e,e\')) = [e, e\'] | components _ = nil;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('components')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('components')).toEqualWithType(TODO);
        }],
        ['components (A(C 3, V "z"));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createList([
                new Val.ConstructedValue('C', new Val.Integer(3)),
                new Val.ConstructedValue('V', new Val.StringValue('z')),
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun subexps e = e::(case e of A(e1,e2) => subexps e1 @ subexps e2 | M(e1,e2) => subexps e1 @ subexps e2 | _ => nil);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('subexps')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('subexps')).toEqualWithType(TODO);
        }]
    ]);
});

it("6.4.2", () => {
    /*
type var = string;
datatype exp = C of int | V of var | A of exp * exp | M of exp * exp;
val e = M(A(M(C 2, V "x"), V "y"), A(V "x", C 3));

type env = var -> int;

exception Unbound;

val env = fn "x" => 5 | "y" => 3 | _ => raise Unbound;

fun eval env (C c) = c
  | eval env (V v) = env v
  | eval env (A(e,e')) = eval env e + eval env e'
  | eval env (M(e,e')) = eval env e * eval env e';

eval env e;
     */
    //TODO test types
    run_test([
        ['type var = string;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // copy from 6.4
        }],
        ['datatype exp = C of int | V of var | A of exp * exp | M of exp * exp;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // copy from 6.4
        }],
        ['val e = M(A(M(C 2, V "x"), V "y"), A(V "x", C 3));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // copy from 6.4
        }],
        ['type env = var -> int;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            //TODO check if type env is set
        }],
        ['exception Unbound;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Unbound')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('Unbound')).toEqualWithType(TODO);
        }],
        ['val env = fn "x" => 5 | "y" => 3 | _ => raise Unbound;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('env')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('env')).toEqualWithType(TODO);
        }],
        ['fun eval env (C c) = c | eval env (V v) = env v | eval env (A(e,e\')) = eval env e + eval env e\' | eval env (M(e,e\')) = eval env e * eval env e\';', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('eval')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('eval')).toEqualWithType(TODO);
        }],
        ['eval env e;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(104));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("6.5", () => {
    /*
raise Empty;

Empty;

exception New;

exception Newer of int;

(Overflow, New, Newer);
fun test New = 0
  | test (Newer x) = x
  | test _ = ~1;
test Overflow;
test (Newer 13);
     */
    //TODO test types
    run_test([
        ['raise Empty;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Empty'));
        }],
        ['Empty;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ExceptionValue('Empty'));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['exception New;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('New')).toEqualWithType(new Val.ExceptionConstructor('New'));
            //expect(state.getStaticValue('New')).toEqualWithType(TODO);
        }],
        ['exception Newer of int;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Newer')).toEqualWithType(new Val.ExceptionConstructor('Newer', 1));
            //expect(state.getStaticValue('Newer')).toEqualWithType(TODO);
        }],
        ['(Overflow, New, Newer);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createTuple([
                new Val.ExceptionValue('Overflow'),
                new Val.ExceptionValue('New'),
                new Val.ExceptionConstructor('Newer', 1)
            ]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['fun test New = 0 | test (Newer x) = x | test _ = ~1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('test')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('test')).toEqualWithType(TODO);
        }],
        ['test Overflow;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(-1));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['test (Newer 13);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(13));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }]
    ]);
});

it("6.5.1", () => {
    /*
exception New;

raise New;

fun f x y = if x then y else raise New;
     */
    //TODO test types
    run_test([
        ['exception New;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('New')).toEqualWithType(new Val.ExceptionConstructor('New'));
            //expect(state.getStaticValue('New')).toEqualWithType(TODO);
        }],
        ['raise New;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('New'));
        }],
        ['fun f x y = if x then y else raise New;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }]
    ]);
});

it("6.5.2", () => {
    /*
exception New;
exception Newer of int;

exception Unbound;

(raise New) handle New => ();
(raise Newer 7) handle Newer x => x;
fun test f = f() handle Newer x => x | Overflow => ~1;
test (fn () => raise Newer 6);
fun fac n = if n<1 then 1 else n*fac(n-1);
fac 15;
test (fn () => fac 15);

fun adjoin env env' x = env' x handle Unbound => env x;
     */
    //TODO test types
    run_test([
        ['exception New;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // copy from 6.5
        }],
        ['exception Newer of int;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // copy from 6.5
        }],
        ['exception Unbound;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Unbound')).toEqualWithType(new Val.ExceptionConstructor('Unbound'));
            //expect(state.getStaticValue('Unbound')).toEqualWithType(TODO);
        }],
        ['(raise New) handle New => ();', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(createTuple([]));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['(raise Newer 7) handle Newer x => x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(7));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun test f = f() handle Newer x => x | Overflow => ~1;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('test')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('test')).toEqualWithType(TODO);
        }],
        ['test (fn () => raise Newer 6);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(6));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun fac n = if n<1 then 1 else n*fac(n-1);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('fac')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('fac')).toEqualWithType(TODO);
        }],
        ['fac 15;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Overflow'));
        }],
        ['test (fn () => fac 15);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(-1));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun adjoin env env\' x = env\' x handle Unbound => env x;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(state.getDynamicValue('adjoin')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('adjoin')).toEqualWithType(TODO);
        }]
    ]);
});

it("6.5.3", () => {
    /*
exception New;

(raise Overflow, raise Subscript);

(5 ; 7);
(raise New ; 7);

fun testOverflow x y = (x*y ; false) handle Overflow => true;
testOverflow 2 3;
testOverflow 100000 100000;
     */
    //TODO test types
    run_test([
        ['exception New;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // copy from 6.5
        }],
        ['(raise Overflow, raise Subscript);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Overflow'));
        }],
        ['(5 ; 7);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(7));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun testOverflow x y = (x*y ; false) handle Overflow => true;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('testOverflow')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('testOverflow')).toEqualWithType(TODO);
        }],
        ['testOverflow 2 3;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(false));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }],
        ['testOverflow 100000 100000;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.BoolValue(true));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('bool'));
        }]
    ]);
});

it("6.5.5", () => {
    /*
exception Double;
fun mask compare p = case compare p of
    EQUAL => raise Double | v => v;
fun testDouble compare xs =
    (List.sort (mask compare) xs ; false)
    handle Double => true;
     */
    //TODO test types
    //TODO maybe test that testDouble also works?
    run_test([
        ['exception Double;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Double')).toEqualWithType(new Val.ExceptionConstructor('Double'));
            //expect(state.getStaticValue('Double')).toEqualWithType(TODO);
        }],
        ['fun mask compare p = case compare p of EQUAL => raise Double | v => v;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('mask')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('mask')).toEqualWithType(TODO);
        }],
        ['fun testDouble compare xs = (List.sort (mask compare) xs ; false) handle Double => true;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('testDouble')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('testDouble')).toEqualWithType(TODO);
        }]
    ]);
});

it("6.6", () => {
    /*
datatype 'a mylist = Nil | Cons of 'a * 'a mylist;
     */
    //TODO test types
    //TODO maybe test that mylist is usable?
    run_test([
        ['datatype \'a mylist = Nil | Cons of \'a * \'a mylist;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Nil')).toEqualWithType(new Val.ValueConstructor('Nil'));
            //expect(state.getStaticValue('Nil')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Cons')).toEqualWithType(new Val.ValueConstructor('Cons', 1));
            //expect(state.getStaticValue('Cons')).toEqualWithType(TODO);
        }]
    ]);
});

it("6.7", () => {
    /*
(* should be predefined *)
datatype 'a option = NONE | SOME of 'a;

fun nth n xs = if n<0 orelse null xs then NONE
                else if n=0 then SOME (hd xs) else nth (n-1) (tl xs);
nth 2 [3,4,5];
nth 3 [3,4,5];

(* should be predefined *)
fun valOf (SOME x) = x
  | valOf NONE = raise Option.Option;

valOf (nth 2 [3,4,5]);

(* should be predefined *)
fun isSome NONE = false
  | isSome (SOME _) = true;

Int.minInt;

Int.maxInt;
valOf Int.minInt + valOf Int.maxInt;

fun findDouble compare xs = let
    exception Double of 'a
    fun compare' (x,y) = case compare (x,y) of
        EQUAL => raise Double x | v => v
in
    (List.sort compare' xs ; NONE)
    handle Double x => SOME x
end;
     */
    //TODO test types
    //TODO maybe test that findDouble is usable?
    run_test([
        ['datatype \'a option = NONE | SOME of \'a;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('NONE')).toEqualWithType(new Val.ValueConstructor('NONE'));
            //expect(state.getStaticValue('NONE')).toEqualWithType(TODO);
            expect(state.getDynamicValue('SOME')).toEqualWithType(new Val.ValueConstructor('SOME', 1));
            //expect(state.getStaticValue('SOME')).toEqualWithType(TODO);
        }],
        ['fun nth n xs = if n<0 orelse null xs then NONE else if n=0 then SOME (hd xs) else nth (n-1) (tl xs);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('nth')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('nth')).toEqualWithType(TODO);
        }],
        ['nth 2 [3,4,5];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('SOME', new Val.Integer(5)));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['nth 3 [3,4,5];', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('NONE'));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['Int.minInt;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('SOME', new Val.Integer(-1073741824)));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['Int.maxInt;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('SOME', new Val.Integer(1073741823)));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['valOf Int.minInt + valOf Int.maxInt;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(-1));
            //expect(state.getStaticValue('it')).toEqualWithType(new Type.PrimitiveType('int'));
        }],
        ['fun findDouble compare xs = let exception Double of \'a fun compare\' (x,y) = case compare (x,y) of EQUAL => raise Double x | v => v in (List.sort compare\' xs ; NONE) handle Double x => SOME x end;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('findDouble')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('findDouble')).toEqualWithType(TODO);
        }]
    ]);
});

//TODO Chapter 7

it('7.1', () => {
    /*
datatype tree = T of tree list
val t1 = T[];
val t2 = T[t1, t1, t1];
val t3 = T[T[t2], t1, t2]; */
    let t1 = new Val.ConstructedValue('T', createList([]));
    let t2 = new Val.ConstructedValue('T', createList([t1, t1, t1]));
    let t3 = new Val.ConstructedValue('T', createList([new Val.ConstructedValue('T', createList([t2])), t1, t2]));
    run_test([['datatype tree = T of tree list;',
        (x) => {
            x();
        }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            expect(hasThrown).toEqual(false);
            // TODO: check that state contains datatype tree
        }], ['val t1 = T[];',
        (x) => {
            x();
        }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('t1')).toEqualWithType(t1);
            // expect(state.getStaticValue('t1')).toEqualWithType(TODO: tree);
        }], ['val t2 = T[t1, t1, t1];',
        (x) => {
            x();
        }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('t2')).toEqualWithType(t2);
            // expect(state.getStaticValue('t2')).toEqualWithType(TODO: tree);
        }], ['val t3 = T[T[t2], t1, t2];',
        (x) => {
            x();
        }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('t3')).toEqualWithType(t3);
            // expect(state.getStaticValue('t3')).toEqualWithType(TODO: tree);
        }]
    ]);
});

it('7.1.1', () => {
    /*
datatype tree = T of tree list;

val t1 = T[];
val t2 = T[t1, t1, t1];
val t3 = T[T[t2], t1, t2];

fun arity (T ts) = length ts;
arity t3;
fun dst (T ts) k = List.nth(ts, k-1);
dst t3 3;
     */
    let t1 = new Val.ConstructedValue('T', createList([]));
    let t2 = new Val.ConstructedValue('T', createList([t1, t1, t1]));
    let t3 = new Val.ConstructedValue('T', createList([new Val.ConstructedValue('T', createList([t2])), t1, t2]));
    run_test([['datatype tree = T of tree list;',
        (x) => {
            x();
        }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            // see 7.1
        }], ['val t1 = T[];',
        (x) => {
            x();
        }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            // see 7.1
        }], ['val t2 = T[t1, t1, t1];',
        (x) => {
            x();
        }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            // see 7.1
        }], ['val t3 = T[T[t2], t1, t2];',
        (x) => {
            x();
        }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            // see 7.1
        }], ['fun arity (T ts) = length ts;', (x) => { x(); },
        (state : State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('arity')).not.toEqualWithType(undefined);
            // expect(state.getStaticValue('arity')).toEqualWithType(TODO: tree -> int);
        }], ['arity t3;',
        (x) => { x(); }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.Integer(3));
            // expect(state.getStaticValue('it')).toEqualWithType(TODO: int);
        }], ['fun dst (T ts) k = List.nth(ts, k-1);',
        (x) => { x(); }, (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('dst')).not.toEqualWithType(undefined);
            // expect(state.getStaticValue('dst')).toEqualWithType(TODO: tree -> int -> tree);

        }], ['dst t3 3;', (x) => { x(); },
        (state: State.State, hasThrown: boolean, exceptionValue: Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(t2);
            // expect(state.getDynamicValue('it').toEqualWithType(TODO: tree));
        }],
    ]);
});

it("12.1", () => {
    /*
datatype con = False | True | IC of int (* constants *)
type id = string (* identifiers *)
datatype opr = Add | Sub | Mul | Leq (* operators *)
datatype ty = (* types *)
    Bool
  | Int
  | Arrow of ty * ty (* procedure type *)
datatype exp = (* expressions *)
    Con of con (* constant *)
  | Id of id (* identifier *)
  | Opr of opr * exp * exp (* operator application *)
  | If of exp * exp * exp (* conditional *)
  | Abs of id * ty * exp (* abstraction *)
  | App of exp * exp (* procedure application *)
;

val e1 = Opr(Leq, Id"n", Con(IC 0));
     */
    //TODO test types
    run_test([
        ['datatype con = False | True | IC of int (* constants *) ' +
            'type id = string (* identifiers *) ' +
            'datatype opr = Add | Sub | Mul | Leq (* operators *) ' +
            'datatype ty = (* types *) ' +
            '    Bool ' +
            '  | Int ' +
            '  | Arrow of ty * ty (* procedure type *) ' +
            'datatype exp = (* expressions *) ' +
            '    Con of con (* constant *) ' +
            '  | Id of id (* identifier *) ' +
            '  | Opr of opr * exp * exp (* operator application *) ' +
            '  | If of exp * exp * exp (* conditional *) ' +
            '  | Abs of id * ty * exp (* abstraction *) ' +
            '  | App of exp * exp (* procedure application *) ' +
            ';', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('False')).toEqualWithType(new Val.ValueConstructor('False'));
            //expect(state.getStaticValue('False')).toEqualWithType(TODO);
            expect(state.getDynamicValue('True')).toEqualWithType(new Val.ValueConstructor('True'));
            //expect(state.getStaticValue('True')).toEqualWithType(TODO);
            expect(state.getDynamicValue('IC')).toEqualWithType(new Val.ValueConstructor('IC', 1));
            //expect(state.getStaticValue('IC')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Add')).toEqualWithType(new Val.ValueConstructor('Add'));
            //expect(state.getStaticValue('Add')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Sub')).toEqualWithType(new Val.ValueConstructor('Sub'));
            //expect(state.getStaticValue('Sub')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Mul')).toEqualWithType(new Val.ValueConstructor('Mul'));
            //expect(state.getStaticValue('Mul')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Leq')).toEqualWithType(new Val.ValueConstructor('Leq'));
            //expect(state.getStaticValue('Leq')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Bool')).toEqualWithType(new Val.ValueConstructor('Bool'));
            //expect(state.getStaticValue('Bool')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Int')).toEqualWithType(new Val.ValueConstructor('Int'));
            //expect(state.getStaticValue('Int')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Arrow')).toEqualWithType(new Val.ValueConstructor('Arrow', 1));
            //expect(state.getStaticValue('Arrow')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Con')).toEqualWithType(new Val.ValueConstructor('Con', 1));
            //expect(state.getStaticValue('Con')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Id')).toEqualWithType(new Val.ValueConstructor('Id', 1));
            //expect(state.getStaticValue('Id')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Opr')).toEqualWithType(new Val.ValueConstructor('Opr', 1));
            //expect(state.getStaticValue('Opr')).toEqualWithType(TODO);
            expect(state.getDynamicValue('If')).toEqualWithType(new Val.ValueConstructor('If', 1));
            //expect(state.getStaticValue('If')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Abs')).toEqualWithType(new Val.ValueConstructor('Abs', 1));
            //expect(state.getStaticValue('Abs')).toEqualWithType(TODO);
            expect(state.getDynamicValue('App')).toEqualWithType(new Val.ValueConstructor('App', 1));
            //expect(state.getStaticValue('App')).toEqualWithType(TODO);
        }],
        ['val e1 = Opr(Leq, Id"n", Con(IC 0));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('e1')).toEqualWithType(new Val.ConstructedValue('Opr', createTuple([
                new Val.ConstructedValue('Leq'),
                new Val.ConstructedValue('Id', new Val.StringValue('n')),
                new Val.ConstructedValue('Con', new Val.ConstructedValue('IC', new Val.Integer(0)))
            ])));
            //expect(state.getStaticValue('e1')).toEqualWithType(TODO);
        }]
    ]);
});

it("12.4", () => {
    /*
datatype con = False | True | IC of int (* constants *)
type id = string (* identifiers *)
datatype opr = Add | Sub | Mul | Leq (* operators *)
datatype ty = (* types *)
    Bool
  | Int
  | Arrow of ty * ty (* procedure type *)
datatype exp = (* expressions *)
    Con of con (* constant *)
  | Id of id (* identifier *)
  | Opr of opr * exp * exp (* operator application *)
  | If of exp * exp * exp (* conditional *)
  | Abs of id * ty * exp (* abstraction *)
  | App of exp * exp (* procedure application *)
;

type 'a env = id -> 'a (* environments *)
exception Unbound of id
fun empty x = raise Unbound x
fun update env x a y = if y=x then a else env y
exception Error of string
fun elabCon True = Bool
  | elabCon False = Bool
  | elabCon (IC _) = Int
fun elabOpr Add Int Int = Int
  | elabOpr Sub Int Int = Int
  | elabOpr Mul Int Int = Int
  | elabOpr Leq Int Int = Bool
  | elabOpr ___= raise Error "T Opr"
fun elab f (Con c) = elabCon c
  | elab f (Id x) = f x
  | elab f (Opr(opr,e1,e2)) = elabOpr opr (elab f e1) (elab f e2)
  | elab f (If(e1,e2,e3)) =
            (case (elab f e1, elab f e2, elab f e3) of
            (Bool, t2, t3) => if t2=t3 then t2
                              else raise Error "T If1"
            | _ => raise Error "T If2")
  | elab f (Abs(x,t,e)) = Arrow(t, elab (update f x t) e)
  | elab f (App(e1,e2)) = (case elab f e1 of
                          Arrow(t,t') => if t = elab f e2 then t'
                                          else raise Error "T App1"
                          | _ => raise Error "T App2")
;

val f = update (update empty "x" Int) "y" Bool;

f "y";
f "z";

val f = update (update empty "x" Int) "y" Bool;
val e = Abs("y", Int, Opr(Leq, Id"x", Id"y"));
elab f e;

datatype elab = T of ty | SE of string;
fun elab' f e = T(elab f e) handle
    Unbound s => SE("Unbound "^s)
  | Error s => SE("Error "^s);
elab' f e;
elab' f (App(Id"x", Id"x"));
elab' empty (Id "x");
     */
    //TODO test types
    run_test([
        ['datatype con = False | True | IC of int (* constants *) ' +
            'type id = string (* identifiers *) ' +
            'datatype opr = Add | Sub | Mul | Leq (* operators *) ' +
            'datatype ty = (* types *) ' +
            '    Bool ' +
            '  | Int ' +
            '  | Arrow of ty * ty (* procedure type *) ' +
            'datatype exp = (* expressions *) ' +
            '    Con of con (* constant *) ' +
            '  | Id of id (* identifier *) ' +
            '  | Opr of opr * exp * exp (* operator application *) ' +
            '  | If of exp * exp * exp (* conditional *) ' +
            '  | Abs of id * ty * exp (* abstraction *) ' +
            '  | App of exp * exp (* procedure application *) ' +
            ';', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
                // copy from 12.1
        }],
        ['type \'a env = id -> \'a (* environments *) ' +
            'exception Unbound of id ' +
            'fun empty x = raise Unbound x ' +
            'fun update env x a y = if y=x then a else env y ' +
            'exception Error of string ' +
            'fun elabCon True = Bool ' +
            '  | elabCon False = Bool ' +
            '  | elabCon (IC _) = Int ' +
            'fun elabOpr Add Int Int = Int ' +
            '  | elabOpr Sub Int Int = Int ' +
            '  | elabOpr Mul Int Int = Int ' +
            '  | elabOpr Leq Int Int = Bool ' +
            '  | elabOpr ___= raise Error "T Opr" ' +
            'fun elab f (Con c) = elabCon c ' +
            '  | elab f (Id x) = f x ' +
            '  | elab f (Opr(opr,e1,e2)) = elabOpr opr (elab f e1) (elab f e2) ' +
            '  | elab f (If(e1,e2,e3)) = ' +
            '            (case (elab f e1, elab f e2, elab f e3) of ' +
            '            (Bool, t2, t3) => if t2=t3 then t2 ' +
            '                              else raise Error "T If1" ' +
            '            | _ => raise Error "T If2") ' +
            '  | elab f (Abs(x,t,e)) = Arrow(t, elab (update f x t) e) ' +
            '  | elab f (App(e1,e2)) = (case elab f e1 of ' +
            '                          Arrow(t,t\') => if t = elab f e2 then t\' ' +
            '                                          else raise Error "T App1" ' +
            '                          | _ => raise Error "T App2") ' +
            '; ' +
            '', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('Unbound')).toEqualWithType(new Val.ExceptionConstructor('Unbound', 1));
            //expect(state.getStaticValue('Unbound')).toEqualWithType(TODO);
            expect(state.getDynamicValue('empty')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('empty')).toEqualWithType(TODO);
            expect(state.getDynamicValue('update')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('update')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Error')).toEqualWithType(new Val.ExceptionConstructor('Error', 1));
            //expect(state.getStaticValue('Error')).toEqualWithType(TODO);
            expect(state.getDynamicValue('elabCon')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('elabCon')).toEqualWithType(TODO);
            expect(state.getDynamicValue('elabOpr')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('elabOpr')).toEqualWithType(TODO);
            expect(state.getDynamicValue('elab')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('elab')).toEqualWithType(TODO);
        }],
        ['val f = update (update empty "x" Int) "y" Bool;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }],
        ['f "y";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('Bool'));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['f "z";', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(true);
            expect(exceptionValue).toEqualWithType(new Val.ExceptionValue('Unbound', new Val.StringValue('z')));
        }],
        ['val f = update (update empty "x" Int) "y" Bool;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }],
        ['val e = Abs("y", Int, Opr(Leq, Id"x", Id"y"));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('e')).toEqualWithType(new Val.ConstructedValue('Abs', createTuple([
                new Val.StringValue('y'),
                new Val.ConstructedValue('Int'),
                new Val.ConstructedValue('Opr', createTuple([
                    new Val.ConstructedValue('Leq'),
                    new Val.ConstructedValue('Id', new Val.StringValue('x')),
                    new Val.ConstructedValue('Id', new Val.StringValue('y'))
                ]))
            ])));
            //expect(state.getStaticValue('e')).toEqualWithType(TODO);
        }],
        ['elab f e;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('Arrow', createTuple([
                new Val.ConstructedValue('Int'),
                new Val.ConstructedValue('Bool')
            ])));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['datatype elab = T of ty | SE of string;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('T')).toEqualWithType(new Val.ValueConstructor('T', 1));
            //expect(state.getStaticValue('T')).toEqualWithType(TODO);
            expect(state.getDynamicValue('SE')).toEqualWithType(new Val.ValueConstructor('SE', 1));
            //expect(state.getStaticValue('SE')).toEqualWithType(TODO);
        }],
        ['fun elab\' f e = T(elab f e) handle Unbound s => SE("Unbound "^s) | Error s => SE("Error "^s);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('elab\'')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('elab\'')).toEqualWithType(TODO);
        }],
        ['elab\' f e;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('T',
                new Val.ConstructedValue('Arrow', createTuple([
                    new Val.ConstructedValue('Int'),
                    new Val.ConstructedValue('Bool')
                ]))
            ));
        }],
        ['elab\' f (App(Id"x", Id"x"));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('SE', new Val.StringValue("Error T App2")));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
        ['elab\' empty (Id "x");', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('SE', new Val.StringValue("Unbound x")));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }],
    ]);
});

it("12.5", () => {
    /*
datatype con = False | True | IC of int (* constants *)
type id = string (* identifiers *)
datatype opr = Add | Sub | Mul | Leq (* operators *)
datatype ty = (* types *)
    Bool
  | Int
  | Arrow of ty * ty (* procedure type *)
datatype exp = (* expressions *)
    Con of con (* constant *)
  | Id of id (* identifier *)
  | Opr of opr * exp * exp (* operator application *)
  | If of exp * exp * exp (* conditional *)
  | Abs of id * ty * exp (* abstraction *)
  | App of exp * exp (* procedure application *)
;

type 'a env = id -> 'a (* environments *)
exception Unbound of id
fun empty x = raise Unbound x
fun update env x a y = if y=x then a else env y
;

datatype value =
    IV of int
  | Proc of id * exp * value env
fun evalCon False = IV 0
  | evalCon True = IV 1
  | evalCon (IC x) = IV x
fun evalOpr Add (IV x1) (IV x2) = IV(x1+x2)
  | evalOpr Sub (IV x1) (IV x2) = IV(x1-x2)
  | evalOpr Mul (IV x1) (IV x2) = IV(x1*x2)
  | evalOpr Leq (IV x1) (IV x2) = IV(if x1<=x2 then 1 else 0)
  | evalOpr _ _ _ = raise Error "R Opr"
fun eval f (Con c) = evalCon c
  | eval f (Id x) = f x
  | eval f (Opr(opr,e1,e2)) = evalOpr opr (eval f e1) (eval f e2)
  | eval f (If(e1,e2,e3)) = (case eval f e1 of
                              IV 1 => eval f e2
                            | IV 0 => eval f e3
                            | _ => raise Error "R If")
  | eval f (Abs(x,t,e)) = Proc(x, e, f)
  | eval f (App(e1,e2)) = (case (eval f e1, eval f e2) of
                          (Proc(x,e,f'), v) => eval (update f' x v) e
                            | _ => raise Error "R App")
;

val f = update empty "x" (IV 5);
val e = Opr(Leq, Id"x", Con(IC 7));
eval f e;
     */
    //TODO test types
    run_test([
        ['datatype con = False | True | IC of int (* constants *) ' +
            'type id = string (* identifiers *) ' +
            'datatype opr = Add | Sub | Mul | Leq (* operators *) ' +
            'datatype ty = (* types *) ' +
            '    Bool ' +
            '  | Int ' +
            '  | Arrow of ty * ty (* procedure type *) ' +
            'datatype exp = (* expressions *) ' +
            '    Con of con (* constant *) ' +
            '  | Id of id (* identifier *) ' +
            '  | Opr of opr * exp * exp (* operator application *) ' +
            '  | If of exp * exp * exp (* conditional *) ' +
            '  | Abs of id * ty * exp (* abstraction *) ' +
            '  | App of exp * exp (* procedure application *) ' +
            ';', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
                // copy from 12.1
        }],
        ['datatype value = ' +
            '    IV of int ' +
            '  | Proc of id * exp * value env ' +
            'fun evalCon False = IV 0 ' +
            '  | evalCon True = IV 1 ' +
            '  | evalCon (IC x) = IV x ' +
            'fun evalOpr Add (IV x1) (IV x2) = IV(x1+x2) ' +
            '  | evalOpr Sub (IV x1) (IV x2) = IV(x1-x2) ' +
            '  | evalOpr Mul (IV x1) (IV x2) = IV(x1*x2) ' +
            '  | evalOpr Leq (IV x1) (IV x2) = IV(if x1<=x2 then 1 else 0) ' +
            '  | evalOpr _ _ _ = raise Error "R Opr" ' +
            'fun eval f (Con c) = evalCon c ' +
            '  | eval f (Id x) = f x ' +
            '  | eval f (Opr(opr,e1,e2)) = evalOpr opr (eval f e1) (eval f e2) ' +
            '  | eval f (If(e1,e2,e3)) = (case eval f e1 of ' +
            '                             IV 1 => eval f e2 ' +
            '                           | IV 0 => eval f e3 ' +
            '                           | _ => raise Error "R If") ' +
            '  | eval f (Abs(x,t,e)) = Proc(x, e, f) ' +
            '  | eval f (App(e1,e2)) = (case (eval f e1, eval f e2) of ' +
            '                          (Proc(x,e,f\'), v) => eval (update f\' x v) e ' +
            '                           | _ => raise Error "R App") ' +
            ';', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('IV')).toEqualWithType(new Val.ValueConstructor('IV', 1));
            //expect(state.getStaticValue('IV')).toEqualWithType(TODO);
            expect(state.getDynamicValue('Proc')).toEqualWithType(new Val.ValueConstructor('Proc', 1));
            //expect(state.getStaticValue('Proc')).toEqualWithType(TODO);
            expect(state.getDynamicValue('evalCon')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('evalCon')).toEqualWithType(TODO);
            expect(state.getDynamicValue('evalOpr')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('evalOpr')).toEqualWithType(TODO);
            expect(state.getDynamicValue('eval')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('eval')).toEqualWithType(TODO);
        }],
        ['type \'a env = id -> \'a (* environments *) ' +
            'exception Unbound of id ' +
            'fun empty x = raise Unbound x ' +
            'fun update env x a y = if y=x then a else env y ' +
            ';', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
                // copy from 12.4
        }],
        ['val f = update empty "x" (IV 5);', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('f')).not.toEqualWithType(undefined);
            //expect(state.getStaticValue('f')).toEqualWithType(TODO);
        }],
        ['val e = Opr(Leq, Id"x", Con(IC 7));', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('e')).toEqualWithType(new Val.ConstructedValue('Opr', createTuple([
                new Val.ConstructedValue('Leq'),
                new Val.ConstructedValue('Id', new Val.StringValue('x')),
                new Val.ConstructedValue('Con', new Val.ConstructedValue('IC', new Val.Integer(7))),
            ])));
            //expect(state.getStaticValue('e')).toEqualWithType(TODO);
        }],
        ['eval f e;', (x) => { x(); },  (state : State.State, hasThrown : bool, exceptionValue : Val.Exception) => {
            expect(hasThrown).toEqual(false);
            expect(state.getDynamicValue('it')).toEqualWithType(new Val.ConstructedValue('IV', new Val.Integer(1)));
            //expect(state.getStaticValue('it')).toEqualWithType(TODO);
        }]
    ]);
});

//TODO Chapter 13

//TODO Chapter 14

//TODO Exercises
