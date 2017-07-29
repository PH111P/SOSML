const Lexer = require("../src/lexer");
const Parser = require("../src/parser");
const Errors = require("../src/errors");

const State = require("../src/state.ts");
const InitialState = require("../src/initialState.ts");
const Expr = require("../src/expressions.ts");
const Decl = require("../src/declarations.ts");
const Type = require("../src/types.ts");

const TestHelper = require("./test_helper.ts");
TestHelper.init();

function createItExpression(exp: Expr.Expression): void {
    return new Decl.SequentialDeclaration(0, [
        new Decl.ValueDeclaration(0, [], [
            new Decl.ValueBinding(0, false,
                new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                exp
            )
        ], 2)
    ], 1);
}

function pattern_tester(pattern: Expr.Pattern, pos42: Errors.Position): Decl.Declaration {
    return new Decl.SequentialDeclaration(0, [
        new Decl.ValueDeclaration(0, [], [
            new Decl.ValueBinding(4, false, pattern, get42(pos42))
        ], 2)
    ], 1);
}

function create_infix(position: Errors.Position, id: number) {
    return new Decl.InfixDeclaration(
        position,
        [
            new Lexer.AlphanumericIdentifierToken("x", position+6)
        ], 0, id
    )
}

function create_infixr(position: Errors.Position) {
    return new Decl.InfixRDeclaration(
        position,
        [
            new Lexer.AlphanumericIdentifierToken("x", position+7)
        ]
    )
}

function prefixWithOp(tok: Lexer.IdentifierToken): Lexer.IdentifierToken {
    tok.opPrefixed = true;
    return tok;
}

function get42(pos: Errors.Position): Expr.Expresion {
    return new Expr.Constant(pos, new Lexer.NumericToken('42', pos, 42));
}

const sampleExpression1: string = 'if 5 then 9 else 7';
function createSampleExpression1(pos: Errors.Position): Expr.Expression {
    return new Expr.Conditional(pos,
            new Expr.Constant(pos+3, new Lexer.NumericToken('5', pos+3, 5)),
            new Expr.Constant(pos+10, new Lexer.NumericToken('9', pos+10, 9)),
            new Expr.Constant(pos+17, new Lexer.NumericToken('7', pos+17, 7))
        );
    );
}

const sampleExpression2: string = 'if 1 then 2 else 3';
function createSampleExpression2(pos: Errors.Position): Expr.Expression {
    return new Expr.Conditional(pos,
            new Expr.Constant(pos+3, new Lexer.NumericToken('1', pos+3, 1)),
            new Expr.Constant(pos+10, new Lexer.NumericToken('2', pos+10, 2)),
            new Expr.Constant(pos+17, new Lexer.NumericToken('3', pos+17, 3))
        );
    );
}

function parse(str: string): Decl.Declaration {
    return Parser.parse(Lexer.lex(str), InitialState.getInitialState());
}

it("basic", () => {
    let testcase_empty: string = ';';
    let testcase_simple1: string = 'val x = 42;';
    let testcase_sample_expr1: string = sampleExpression1 + ';';
    let testcase_sample_expr2: string = sampleExpression2 + ';';

    expect(parse(testcase_empty)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [], 1)
    );
    expect(parse(testcase_simple1)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(4, false,
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('x', 4)),
                    get42(8)
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_sample_expr1)).toEqualWithType(createItExpression(
        createSampleExpression1(0)
    ));
    expect(parse(testcase_sample_expr2)).toEqualWithType(createItExpression(
        createSampleExpression2(0)
    ));
});

it("atomic expression - special constant", () => {
    let testcase_special_zero: string = '0;';
    let testcase_special_int: string = '42;';
    let testcase_special_real: string = '42.0;';
    let testcase_special_word: string = '0w42;';
    let testcase_special_char: string = '#"c";';
    let testcase_special_string: string = '"str";';

    expect(parse(testcase_special_zero)).toEqualWithType(createItExpression(
        new Expr.Constant(0, new Lexer.IntegerConstantToken('0', 0, 0))
    ));
    expect(parse(testcase_special_int)).toEqualWithType(createItExpression(
        get42(0)
    ));
    expect(parse(testcase_special_real)).toEqualWithType(createItExpression(
        new Expr.Constant(0, new Lexer.RealConstantToken('42.0', 0, 42.0))
    ));
    expect(parse(testcase_special_word)).toEqualWithType(createItExpression(
        new Expr.Constant(0, new Lexer.WordConstantToken('0w42', 0, 42))
    ));
    expect(parse(testcase_special_char)).toEqualWithType(createItExpression(
        new Expr.Constant(0, new Lexer.CharacterConstantToken('#"c"', 0, 'c'))
    ));
    expect(parse(testcase_special_string)).toEqualWithType(createItExpression(
        new Expr.Constant(0, new Lexer.StringConstantToken('"str"', 0, 'str'))
    ));
});

it("atomic expression - value identifier", () => {
    let testcase_vid_with_op: string = 'op +;';
    let testcase_vid_with_op_long: string = 'op Math.pow;';
    let testcase_vid_without_op: string = 'blub;';
    let testcase_vid_without_op_long: string = 'Reals.nan;';
    let testcase_star: string = 'op*;';
    let testcase_equals: string = 'op=;';

    expect(parse(testcase_vid_with_op)).toEqualWithType(createItExpression(
        new Expr.ValueIdentifier(0,
            prefixWithOp(new Lexer.IdentifierToken('+', 3))
        )
    ));
    expect(parse(testcase_vid_with_op_long)).toEqualWithType(createItExpression(
        new Expr.ValueIdentifier(0,
            prefixWithOp(new Lexer.LongIdentifierToken('Math.pow', 3, [
                    new Lexer.AlphanumericIdentifierToken('Math', 3)
                ],
                new Lexer.AlphanumericIdentifierToken('pow', 8)
            ))
        )
    ));
    expect(parse(testcase_vid_without_op)).toEqualWithType(createItExpression(
        new Expr.ValueIdentifier(0,
            new Lexer.AlphanumericIdentifierToken('blub', 0)
        )
    ))
    expect(parse(testcase_vid_without_op_long)).toEqualWithType(createItExpression(
        new Expr.ValueIdentifier(0,
            new Lexer.LongIdentifierToken('Reals.nan', 0, [
                    new Lexer.AlphanumericIdentifierToken('Reals', 0)
                ],
                new Lexer.AlphanumericIdentifierToken('nan', 6)
            )
        )
    ));

    expect(parse(testcase_star)).toEqualWithType(createItExpression(
        new Expr.ValueIdentifier(0, prefixWithOp(new Lexer.StarToken(2)))
    ));

    expect(parse(testcase_equals)).toEqualWithType(createItExpression(
        new Expr.ValueIdentifier(0, prefixWithOp(new Lexer.EqualsToken(2)))
    ));
});

it("atomic expression - records", () => {
    let testcase_rec_empty: string = '{};';
    let testcase_rec_single: string = '{ 1 = hello };';
    let testcase_rec_multiple: string = '{ 1 = hello, world = 42, what = ever};';

    expect(parse(testcase_rec_empty)).toEqualWithType(createItExpression(
        new Expr.Record(1,
            true,
            []
        )
    ));
    expect(parse(testcase_rec_single)).toEqualWithType(createItExpression(
        new Expr.Record(2,
            true,[
                ['1', new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('hello', 6)]
            ]
        )
    ));
    expect(parse(testcase_rec_multiple)).toEqualWithType(createItExpression(
        new Expr.Record(2,
            true,[
                ['1', new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('hello', 6)],
                ['world', get42(21)],
                ['what', new Expr.ValueIdentifier(32, new Lexer.AlphanumericIdentifierToken('ever', 32)]
            ]
        )
    ));
});


it("atomic expression - record selector", () => {
    let testcase_sel_alphanum: string = '#hi;';
    let testcase_sel_numeric: string = '#42;';
    let testcase_sel_non_alphanum: string = '# ###;';
    let testcase_sel_star: string = '# *;';

    expect(parse(testcase_sel_alphanum)).toEqualWithType(createItExpression(
        new Expr.RecordSelector(0, new Lexer.AlphanumericIdentifierToken('hi', 1))
    ));
    expect(parse(testcase_sel_numeric)).toEqualWithType(createItExpression(
        new Expr.RecordSelector(0, new Lexer.NumericToken('42', 1. 42))
    ));
    expect(parse(testcase_sel_non_alphanum)).toEqualWithType(createItExpression(
        new Expr.RecordSelector(0, new Lexer.IdentifierToken('###', 2))
    ));
    expect(parse(testcase_sel_star)).toEqualWithType(createItExpression(
        new Expr.RecordSelector(0, new Lexer.StarToken(2))
    ));
});

it("atomic expression - 0 tuple", () => {
    let testcase_empty_tuple: string = '();';

    expect(parse(testcase_empty_tuple)).toEqualWithType(createItExpression(
        new Expr.Tuple(0, [])
    ));
});

it("atomic expression - n tuple", () => {
    let testcase_no_single_tuple: string = '(42);';
    let testcase_2_tuple: string = '(42, ' + sampleExpression1 + ');';
    let testcase_3_tuple: string = '(42, ' + sampleExpression1 + ', ' + sampleExpression2 + ');';

    expect(parse(testcase_no_single_tuple)).toEqualWithType(createItExpression(
        get42(1)
    ));
    expect(parse(testcase_2_tuple)).toEqualWithType(createItExpression(
        new Expr.Tuple(0, [
            get42(1),
            createSampleExpression1(5)
        ])
    ));
    expect(parse(testcase_3_tuple)).toEqualWithType(createItExpression(
        new Expr.Tuple(0, [
            get42(1),
            createSampleExpression1(5)
            createSampleExpression2(25)
        ])
    ));
});

it("atomic expression - list", () => {
    let testcase_empty_list: string = '[];';
    let testcase_1_list: string = '[42];';
    let testcase_2_list: string = '[42, ' + sampleExpression1 + '];';
    let testcase_3_list: string = '[42, ' + sampleExpression1 + ', ' + sampleExpression2 + '];';

    expect(parse(testcase_empty_list)).toEqualWithType(createItExpression(
        new Expr.List(0, [
        ])
    ));
    expect(parse(testcase_1_list)).toEqualWithType(createItExpression(
        new Expr.List(0, [
            get42(1)
        ])
    ));
    expect(parse(testcase_2_list)).toEqualWithType(createItExpression(
        new Expr.List(0, [
            get42(1),
            createSampleExpression1(5)
        ])
    ));
    expect(parse(testcase_3_list)).toEqualWithType(createItExpression(
        new Expr.List(0, [
            get42(1),
            createSampleExpression1(5)
            createSampleExpression2(25)
        ])
    ));
});

it("atomic expression - sequence", () => {
    let testcase_2_seq: string = '(42; ' + sampleExpression1 + ');';
    let testcase_3_seq: string = '(42; ' + sampleExpression1 + '; ' + sampleExpression2 + ');';

    expect(parse(testcase_2_seq)).toEqualWithType(createItExpression(
        new Expr.Sequence(0, [
            get42(1),
            createSampleExpression1(5)
        ])
    ));
    expect(parse(testcase_3_seq)).toEqualWithType(createItExpression(
        new Expr.Sequence(0, [
            get42(1),
            createSampleExpression1(5)
            createSampleExpression2(25)
        ])
    ));
});

it("atomic expression - local declaration", () => {
    let testcase_single_exp = 'let val it = 42 in 42 end;';
    let testcase_multiple: string = 'let val it = 42; in 42; ' + sampleExpression1 + '; ' + sampleExpression2 + ' end;';
    let testcase_surplus_semicolon = 'let 42 in 42; end;';
    let testcase_infix1 = 'infix f; let infixr f in a f b f c end; a f b f c;';
    let testcase_infix2 = 'infixr f; let infix f in a f b f c end; a f b f c;';
    let testcase_infix3 = 'infix f; let nonfix f in a f b f c end; a f b f c;';
    let testcase_infix4 = 'let infix f in a f b f c end; a f b f c;';

    expect(parse(testcase_single_exp)).toEqualWithType(createItExpression(
        new Expr.LocalDeclarationExpression(0,
            new Decl.SequentialDeclaration(4, [
                new Decl.ValueDeclaration(4, [], [
                    new Decl.ValueBinding(8, false,
                        new Expr.ValueIdentifier(8, new Lexer.AlphanumericIdentifierToken('it', 8)),
                        get42(13)
                    )
                ], 4)
            ], 3),
            get42(19)
        )
    ));
    expect(parse(testcase_multiple)).toEqualWithType(createItExpression(
        new Expr.LocalDeclarationExpression(0,
            new Decl.SequentialDeclaration(4, [
                new Decl.ValueDeclaration(4, [], [
                    new Decl.ValueBinding(8, false,
                        new Expr.ValueIdentifier(8, new Lexer.AlphanumericIdentifierToken('it', 8)),
                        get42(13)
                    )
                ], 4)
            ], 3),
            new Expr.Sequence(22, [
                get42(20),
                createSampleExpression1(24),
                createSampleExpression2(44)
            ])
        )
    ));
    expect(parse(testcase_infix1)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 6)
            ], 0, 2),
            new Decl.ValueDeclaration(9, [], [
                new Decl.ValueBinding(9, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.LocalDeclarationExpression(9,
                        new Decl.SequentialDeclaration(13, [
                            new Decl.InfixRDeclaration(13, [
                                new Lexer.AlphanumericIdentifierToken('f', 20)
                            ], 0, 5)
                        ], 4),
                        new Expr.FunctionApplication(27,
                            new Expr.ValueIdentifier(27, new Lexer.AlphanumericIdentifierToken('f', 27)),
                            new Expr.Tuple(27, [
                                new Expr.ValueIdentifier(25, new Lexer.AlphanumericIdentifierToken('a', 25)),
                                new Expr.FunctionApplication(31,
                                    new Expr.ValueIdentifier(31, new Lexer.AlphanumericIdentifierToken('f', 31)),
                                    new Expr.Tuple(31, [
                                        new Expr.ValueIdentifier(29, new Lexer.AlphanumericIdentifierToken('b', 29)),
                                        new Expr.ValueIdentifier(33, new Lexer.AlphanumericIdentifierToken('c', 33))
                                    ])
                                )
                            ])
                        )
                    )
                )
            ], 3),
            new Decl.ValueDeclaration(40, [], [
                new Decl.ValueBinding(40, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(46,
                        new Expr.ValueIdentifier(46, new Lexer.AlphanumericIdentifierToken('f', 46)),
                        new Expr.Tuple(46, [
                            new Expr.FunctionApplication(42,
                                new Expr.ValueIdentifier(42, new Lexer.AlphanumericIdentifierToken('f', 42)),
                                new Expr.Tuple(42, [
                                    new Expr.ValueIdentifier(40, new Lexer.AlphanumericIdentifierToken('a', 40)),
                                    new Expr.ValueIdentifier(44, new Lexer.AlphanumericIdentifierToken('b', 44)),
                                ])
                            ),
                            new Expr.ValueIdentifier(48, new Lexer.AlphanumericIdentifierToken('c', 48))
                        ])
                    )
                )
            ], 7)
        ], 1)
    );
    expect(parse(testcase_infix2)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixRDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 7)
            ], 0, 2),
            new Decl.ValueDeclaration(10, [], [
                new Decl.ValueBinding(10, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.LocalDeclarationExpression(10
                        new Decl.SequentialDeclaration(14, [
                            new Decl.InfixDeclaration(14, [
                                new Lexer.AlphanumericIdentifierToken('f', 20)
                            ], 0, 5)
                        ], 4),
                        new Expr.FunctionApplication(31,
                            new Expr.ValueIdentifier(31, new Lexer.AlphanumericIdentifierToken('f', 31)),
                            new Expr.Tuple(31, [
                                new Expr.FunctionApplication(27,
                                    new Expr.ValueIdentifier(27, new Lexer.AlphanumericIdentifierToken('f', 27)),
                                    new Expr.Tuple(27, [
                                        new Expr.ValueIdentifier(25, new Lexer.AlphanumericIdentifierToken('a', 25)),
                                        new Expr.ValueIdentifier(29, new Lexer.AlphanumericIdentifierToken('b', 29))
                                    ])
                                ),
                                new Expr.ValueIdentifier(33, new Lexer.AlphanumericIdentifierToken('c', 33))
                            ])
                        )
                    )
                )
            ], 3),
            new Decl.ValueDeclaration(40, [], [
                new Decl.ValueBinding(40, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(42,
                        new Expr.ValueIdentifier(42, new Lexer.AlphanumericIdentifierToken('f', 42)),
                        new Expr.Tuple(42, [
                            new Expr.ValueIdentifier(40, new Lexer.AlphanumericIdentifierToken('a', 40)),
                            new Expr.FunctionApplication(46,
                                new Expr.ValueIdentifier(46, new Lexer.AlphanumericIdentifierToken('f', 46)),
                                new Expr.Tuple(46, [
                                    new Expr.ValueIdentifier(44, new Lexer.AlphanumericIdentifierToken('b', 44)),
                                    new Expr.ValueIdentifier(48, new Lexer.AlphanumericIdentifierToken('c', 48))
                                ])
                            )
                        ])
                    )
                )
            ], 7)
        ], 1)
    );
    expect(parse(testcase_infix3)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 6)
            ], 0, 2),
            new Decl.ValueDeclaration(9, [], [
                new Decl.ValueBinding(9, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.LocalDeclarationExpression(9,
                        new Decl.SequentialDeclaration(13, [
                            new Decl.NonfixDeclaration(13, [
                                new Lexer.AlphanumericIdentifierToken('f', 20)
                            ], 5)
                        ], 4),
                        new Expr.FunctionApplication(25,
                            new Expr.FunctionApplication(25,
                                new Expr.FunctionApplication(25,
                                    new Expr.FunctionApplication(25,
                                        new Expr.ValueIdentifier(25, new Lexer.AlphanumericIdentifierToken('a', 25)),
                                        new Expr.ValueIdentifier(27, new Lexer.AlphanumericIdentifierToken('f', 27))
                                    ),
                                    new Expr.ValueIdentifier(29, new Lexer.AlphanumericIdentifierToken('b', 29))
                                ),
                                new Expr.ValueIdentifier(31, new Lexer.AlphanumericIdentifierToken('f', 31))
                            ),
                            new Expr.ValueIdentifier(33, new Lexer.AlphanumericIdentifierToken('c', 33))
                        )
                    )
                )
            ], 3),
            new Decl.ValueDeclaration(40, [], [
                new Decl.ValueBinding(40, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(46,
                        new Expr.ValueIdentifier(46, new Lexer.AlphanumericIdentifierToken('f', 46)),
                        new Expr.Tuple(46, [
                            new Expr.FunctionApplication(42,
                                new Expr.ValueIdentifier(42, new Lexer.AlphanumericIdentifierToken('f', 42)),
                                new Expr.Tuple(42, [
                                    new Expr.ValueIdentifier(40, new Lexer.AlphanumericIdentifierToken('a', 40)),
                                    new Expr.ValueIdentifier(44, new Lexer.AlphanumericIdentifierToken('b', 44)),
                                ])
                            ),
                            new Expr.ValueIdentifier(48, new Lexer.AlphanumericIdentifierToken('c', 48))
                        ])
                    )
                )
            ], 7)
        ], 1)
    );
    expect(parse(testcase_infix4)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(0, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.LocalDeclarationExpression(0,
                        new Decl.SequentialDeclaration(4, [
                            new Decl.InfixDeclaration(4, [
                                new Lexer.AlphanumericIdentifierToken('f', 10)
                            ], 0, 4)
                        ], 3),
                        new Expr.FunctionApplication(21,
                            new Expr.ValueIdentifier(21, new Lexer.AlphanumericIdentifierToken('f', 21)),
                            new Expr.Tuple(21, [
                                new Expr.FunctionApplication(17,
                                    new Expr.ValueIdentifier(17, new Lexer.AlphanumericIdentifierToken('f', 17)),
                                    new Expr.Tuple(17, [
                                        new Expr.ValueIdentifier(15, new Lexer.AlphanumericIdentifierToken('a', 15)),
                                        new Expr.ValueIdentifier(19, new Lexer.AlphanumericIdentifierToken('b', 19)),
                                    ])
                                ),
                                new Expr.ValueIdentifier(23, new Lexer.AlphanumericIdentifierToken('c', 23))
                            ])
                        )
                    )
                )
            ], 2),
            new Decl.ValueDeclaration(30, [], [
                new Decl.ValueBinding(30, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(30,
                        new Expr.FunctionApplication(30,
                            new Expr.FunctionApplication(30,
                                new Expr.FunctionApplication(30,
                                    new Expr.ValueIdentifier(30, new Lexer.AlphanumericIdentifierToken('a', 30)),
                                    new Expr.ValueIdentifier(32, new Lexer.AlphanumericIdentifierToken('f', 32))
                                ),
                                new Expr.ValueIdentifier(34, new Lexer.AlphanumericIdentifierToken('b', 34))
                            ),
                            new Expr.ValueIdentifier(36, new Lexer.AlphanumericIdentifierToken('f', 36))
                        ),
                        new Expr.ValueIdentifier(38, new Lexer.AlphanumericIdentifierToken('c', 38))
                    )
                )
            ], 6)
        ], 1)
    );

    expect(() => { parse(testcase_surplus_semicolon); }).toThrow(Parser.ParserError);
});

it("atomic expression - bracketed expression", () => {
    let testcase_bracket1: string = '(42);';
    let testcase_bracket2: string = '(' + sampleExpression1 + ');';
    let testcase_bracket3: string = '(' + sampleExpression2 + ');';

    expect(parse(testcase_bracket1)).toEqualWithType(createItExpression(
        get42(1)
    ));
    expect(parse(testcase_bracket2)).toEqualWithType(createItExpression(
        createSampleExpression1(1)
    ));
    expect(parse(testcase_bracket3)).toEqualWithType(createItExpression(
        createSampleExpression2(1)
    ));
});

it("expression row", () => {
    let testcase_alphanum: string = '{ hi = 42};';
    let testcase_numeric: string = '{ 1337 = 42};';
    let testcase_non_alphanum: string = '{ ### = ' + sampleExpression1 + '};';
    let testcase_star: string = '{ * = ' + sampleExpression2 + ' };';
    let testcase_zero: string = '{ 0 = 42};';
    let testcase_reserved_word: string = '{ val = 42};';
    let testcase_equals: string = '{ = = 42};';

    expect(parse(testcase_alphanum)).toEqualWithType(createItExpression(
        new Expr.Record(2, true, [
            ["hi", get42(7)]
        ]),
    ));
    expect(parse(testcase_numeric)).toEqualWithType(createItExpression(
        new Expr.Record(2, true, [
            ["1337", get42(9)]
        ]),
    ));
    expect(parse(testcase_non_alphanum)).toEqualWithType(createItExpression(
        new Expr.Record(2, true, [
            ["###", createSampleExpression1(8)]
        ]),
    ));
    expect(parse(testcase_star)).toEqualWithType(createItExpression(
        new Expr.Record(2, true, [
            ["*", createSampleExpression2(6)]
        ]),
    ));

    expect(() => { parse(testcase_zero); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_reserved_word); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_equals); }).toThrow(Parser.ParserError);
});

it("application expression", () => {
    let testcase_simple: string = 'a b c d e f g;';
    let testcase_bracketed: string = 'a b c d (e f g);';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.FunctionApplication(0,
            new Expr.FunctionApplication(0,
                new Expr.FunctionApplication(0,
                    new Expr.FunctionApplication(0,
                        new Expr.FunctionApplication(0,
                            new Expr.FunctionApplication(0,
                                new Expr.ValueIdentifier(0, new Lexer.AlphanumericIdentifierToken('a', 0)),
                                new Expr.ValueIdentifier(2, new Lexer.AlphanumericIdentifierToken('b', 2))
                            ),
                            new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('c', 4))
                        ),
                        new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('d', 6))
                    ),
                    new Expr.ValueIdentifier(8, new Lexer.AlphanumericIdentifierToken('e', 8))
                ),
                new Expr.ValueIdentifier(10, new Lexer.AlphanumericIdentifierToken('f', 10))
            ),
            new Expr.ValueIdentifier(12, new Lexer.AlphanumericIdentifierToken('g', 12))
        )
    ));
    expect(parse(testcase_bracketed)).toEqualWithType(createItExpression(
        new Expr.FunctionApplication(0,
            new Expr.FunctionApplication(0,
                new Expr.FunctionApplication(0,
                    new Expr.FunctionApplication(0,
                        new Expr.ValueIdentifier(0, new Lexer.AlphanumericIdentifierToken('a', 0)),
                        new Expr.ValueIdentifier(2, new Lexer.AlphanumericIdentifierToken('b', 2))
                    ),
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('c', 4))
                ),
                new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('d', 6))
            ),
            new Expr.FunctionApplication(9,
                new Expr.FunctionApplication(9,
                    new Expr.ValueIdentifier(9, new Lexer.AlphanumericIdentifierToken('e', 9)),
                    new Expr.ValueIdentifier(11, new Lexer.AlphanumericIdentifierToken('f', 11))
                ),
                new Expr.ValueIdentifier(13, new Lexer.AlphanumericIdentifierToken('g', 13))
            )
        )
    ));
});

it("infix expression", () => {
    let testcase_predefined: string = 'a + b;';
    let testcase_left: string = 'infix f; a f b f c f d;';
    let testcase_right: string = 'infixr f; a f b f c f d;';
    let testcase_prio_left: string = 'infix 5 f; infix 4 g; a g b f c g d;';
    let testcase_prio_right: string = 'infixr 5 f; infixr 4 g; a g b f c g d;';
    let testcase_non_colliding: string = 'infix 1 f; infixr 1 g; infix h; a f b h c g d;';
    let testcase_colliding: string = 'infix a; infixr b; 0 a 1 b 2;';

    expect(parse(testcase_predefined)).toEqualWithType(createItExpression(
        new Expr.FunctionApplication(2,
            new Expr.ValueIdentifier(2, new Lexer.IdentifierToken('+', 2)),
            new Expr.Tuple(2, [
                new Expr.ValueIdentifier(0, new Lexer.AlphanumericIdentifierToken('a', 0)),
                new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('b', 4))
            ])
        )
    ));
    expect(parse(testcase_left)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 6)
            ], 0, 2),
            new Decl.ValueDeclaration(9, [], [
                new Decl.ValueBinding(9, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(19,
                        new Expr.ValueIdentifier(19, new Lexer.AlphanumericIdentifierToken('f', 19)),
                        new Expr.Tuple(19, [
                            new Expr.FunctionApplication(15,
                                new Expr.ValueIdentifier(15, new Lexer.AlphanumericIdentifierToken('f', 15)),
                                new Expr.Tuple(15, [
                                    new Expr.FunctionApplication(11,
                                        new Expr.ValueIdentifier(11, new Lexer.AlphanumericIdentifierToken('f', 11)),
                                        new Expr.Tuple(11, [
                                            new Expr.ValueIdentifier(9, new Lexer.AlphanumericIdentifierToken('a', 9)),
                                            new Expr.ValueIdentifier(13, new Lexer.AlphanumericIdentifierToken('b', 13)),
                                        ])
                                    ),
                                    new Expr.ValueIdentifier(17, new Lexer.AlphanumericIdentifierToken('c', 17))
                                ])
                            ),
                            new Expr.ValueIdentifier(21, new Lexer.AlphanumericIdentifierToken('d', 21))
                        ])
                    )
                )
            ], 3)
        ], 1)
    );
    expect(parse(testcase_right)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixRDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 7)
            ], 0, 2),
            new Decl.ValueDeclaration(10, [], [
                new Decl.ValueBinding(10, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(12,
                        new Expr.ValueIdentifier(12, new Lexer.AlphanumericIdentifierToken('f', 12)),
                        new Expr.Tuple(12, [
                            new Expr.ValueIdentifier(10, new Lexer.AlphanumericIdentifierToken('a', 10)),
                            new Expr.FunctionApplication(16,
                                new Expr.ValueIdentifier(16, new Lexer.AlphanumericIdentifierToken('f', 16)),
                                new Expr.Tuple(16, [
                                    new Expr.ValueIdentifier(14, new Lexer.AlphanumericIdentifierToken('b', 14)),
                                    new Expr.FunctionApplication(20,
                                        new Expr.ValueIdentifier(20, new Lexer.AlphanumericIdentifierToken('f', 20)),
                                        new Expr.Tuple(20, [
                                            new Expr.ValueIdentifier(18, new Lexer.AlphanumericIdentifierToken('c', 18)),
                                            new Expr.ValueIdentifier(22, new Lexer.AlphanumericIdentifierToken('d', 22)),
                                        ])
                                    )
                                ])
                            )
                        ])
                    )
                )
            ], 3)
        ], 1)
    );
    expect(parse(testcase_prio_left)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 8)
            ], 5, 2),
            new Decl.InfixDeclaration(11, [
                new Lexer.AlphanumericIdentifierToken('g', 19)
            ], 4, 3),
            new Decl.ValueDeclaration(22, [], [
                new Decl.ValueBinding(22, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(32,
                        new Expr.ValueIdentifier(32, new Lexer.AlphanumericIdentifierToken('g', 32)),
                        new Expr.Tuple(32, [
                            new Expr.FunctionApplication(24,
                                new Expr.ValueIdentifier(24, new Lexer.AlphanumericIdentifierToken('g', 24)),
                                new Expr.Tuple(24, [
                                    new Expr.ValueIdentifier(22, new Lexer.AlphanumericIdentifierToken('a', 22)),
                                    new Expr.FunctionApplication(28,
                                        new Expr.ValueIdentifier(28, new Lexer.AlphanumericIdentifierToken('f', 28)),
                                        new Expr.Tuple(28, [
                                            new Expr.ValueIdentifier(26, new Lexer.AlphanumericIdentifierToken('b', 26)),
                                            new Expr.ValueIdentifier(30, new Lexer.AlphanumericIdentifierToken('c', 30)),
                                        ])
                                    )
                                ])
                            ),
                            new Expr.ValueIdentifier(34, new Lexer.AlphanumericIdentifierToken('d', 34))
                        ])
                    )
                )
            ], 4)
        ], 1)
    );
    expect(parse(testcase_prio_right)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixRDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 9)
            ], 5, 2),
            new Decl.InfixRDeclaration(12, [
                new Lexer.AlphanumericIdentifierToken('g', 21)
            ], 4, 3),
            new Decl.ValueDeclaration(24, [], [
                new Decl.ValueBinding(24, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(26,
                        new Expr.ValueIdentifier(26, new Lexer.AlphanumericIdentifierToken('g', 26)),
                        new Expr.Tuple(26, [
                            new Expr.ValueIdentifier(24, new Lexer.AlphanumericIdentifierToken('a', 24)),
                            new Expr.FunctionApplication(34,
                                new Expr.ValueIdentifier(34, new Lexer.AlphanumericIdentifierToken('g', 34)),
                                new Expr.Tuple(34, [
                                    new Expr.FunctionApplication(30,
                                        new Expr.ValueIdentifier(30, new Lexer.AlphanumericIdentifierToken('f', 30)),
                                        new Expr.Tuple(30, [
                                            new Expr.ValueIdentifier(28, new Lexer.AlphanumericIdentifierToken('b', 28)),
                                            new Expr.ValueIdentifier(32, new Lexer.AlphanumericIdentifierToken('c', 32)),
                                        ])
                                    ),
                                    new Expr.ValueIdentifier(36, new Lexer.AlphanumericIdentifierToken('d', 36))
                                ])
                            )
                        ])
                    )
                )
            ], 4)
        ], 1)
    );
    expect(parse(testcase_non_colliding)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 8)
            ], 1, 2),
            new Decl.InfixRDeclaration(11, [
                new Lexer.AlphanumericIdentifierToken('g', 20)
            ], 1, 3),
            new Decl.InfixDeclaration(23, [
                new Lexer.AlphanumericIdentifierToken('h', 29)
            ], 0, 4),
            new Decl.ValueDeclaration(32, [], [
                new Decl.ValueBinding(32, false,
                    new Expr.ValueIdentifier(-1, new Lexer.AlphanumericIdentifierToken('it', -1)),
                    new Expr.FunctionApplication(38,
                        new Expr.ValueIdentifier(38, new Lexer.AlphanumericIdentifierToken('h', 38)),
                        new Expr.Tuple(38, [
                            new Expr.FunctionApplication(34,
                                new Expr.ValueIdentifier(34, new Lexer.AlphanumericIdentifierToken('f', 34)),
                                new Expr.Tuple(34, [
                                    new Expr.ValueIdentifier(32, new Lexer.AlphanumericIdentifierToken('a', 32)),
                                    new Expr.ValueIdentifier(36, new Lexer.AlphanumericIdentifierToken('b', 36)),
                                ])
                            )
                            new Expr.FunctionApplication(42,
                                new Expr.ValueIdentifier(42, new Lexer.AlphanumericIdentifierToken('g', 42)),
                                new Expr.Tuple(42, [
                                    new Expr.ValueIdentifier(40, new Lexer.AlphanumericIdentifierToken('c', 40)),
                                    new Expr.ValueIdentifier(44, new Lexer.AlphanumericIdentifierToken('d', 44))
                                ])
                            )
                        ])
                    ),
                )
            ], 5)
        ], 1)
    );
    expect(() => { parse(testcase_colliding); }).toThrow(Parser.ParserError);
});

it("expression - typed expression", () => {
    let testcase_simple: string = '42: \'a;';
    let testcase_nested: string = '42: \'a: \'b;';
    let testcase_precedence_conj: string = '42 andalso 42: \'a -> \'b;';
    let testcase_precedence_disj: string = '42 orelse 42: \'a -> \'b;';
    let testcase_precedence_handle: string = '42 handle _ => 42 : \'a -> \'b;';
    let testcase_precedence_raise: string = 'raise 42: \'a -> \'b;';
    let testcase_precedence_if: string = 'if ' + sampleExpression1 + ' then ' + sampleExpression2 + ' else 42: \'a -> \'b;';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.TypeVariable('\'a', true, 4)
        )
    ));
    expect(parse(testcase_nested)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            new Expr.TypedExpression(0,
                get42(0),
                new Type.TypeVariable('\'a', true, 4)
            )
            new Type.TypeVariable('\'b', true, 8)
        )
    ));
    expect(parse(testcase_precedence_conj)).toEqualWithType(createItExpression(
        new Expr.Conjunction(0,
            get42(0),
            new Expr.TypedExpression(11,
                get42(11),
                new Type.FunctionType(
                    new Type.TypeVariable('\'a', true, 15),
                    new Type.TypeVariable('\'b', true, 21),
                    18
                )
            )
        )
    ));
    expect(parse(testcase_precedence_disj)).toEqualWithType(createItExpression(
        new Expr.Disjunction(0,
            get42(0),
            new Expr.TypedExpression(10,
                get42(10),
                new Type.FunctionType(
                    new Type.TypeVariable('\'a', true, 14),
                    new Type.TypeVariable('\'b', true, 20),
                    17
                )
            )
        )
    ));
    expect(parse(testcase_precedence_handle)).toEqualWithType(createItExpression(
        new Expr.HandleException(3,
            get42(0),
            new Expr.Match(10,
                [[new Expr.Wildcard(10),
                    new Expr.TypedExpression(15,
                        get42(15),
                        new Type.FunctionType(
                            new Type.TypeVariable('\'a', true, 20),
                            new Type.TypeVariable('\'b', true, 26),
                            23
                        )
                    )
                ]]
            )
        )
    ));
    expect(parse(testcase_precedence_raise)).toEqualWithType(createItExpression(
        new Expr.RaiseException(0,
            new Expr.TypedExpression(6,
                get42(6),
                new Type.FunctionType(
                    new Type.TypeVariable('\'a', true, 10),
                    new Type.TypeVariable('\'b', true, 16),
                    13
                )
            )
        )
    ));
    expect(parse(testcase_precedence_if)).toEqualWithType(createItExpression(
        new Expr.Conditional(0,
            createSampleExpression1(3),
            createSampleExpression2(27),
            new Expr.TypedExpression(51,
                get42(51),
                new Type.FunctionType(
                    new Type.TypeVariable('\'a', true, 55),
                    new Type.TypeVariable('\'b', true, 61),
                    58
                )
            )
        )
    ));
});

it("expression - conjunction", () => {
    let testcase_simple: string = '42 andalso 42;';
    let testcase_associativity: string = '42 andalso (' + sampleExpression1 + ') andalso (' + sampleExpression2 + ');';
    let testcase_precedence_disj1: string = '42 andalso (' + sampleExpression1 + ') orelse (' + sampleExpression2 + ');';
    let testcase_precedence_disj2: string = '42 orelse (' + sampleExpression1 + ') andalso (' + sampleExpression2 + ');';
    let testcase_precedence_handle1: string = '42 andalso (' + sampleExpression1 + ') handle _ => 42;';
    let testcase_precedence_handle2: string = '(' + sampleExpression1 + ') handle _ => 42 andalso 42;';

    let testcase_precedence_raise: string = 'raise 42 andalso (' + sampleExpression1 + ');';
    let testcase_precedence_if: string = 'if 42 then (' + sampleExpression1 + ') else 42 andalso (' + sampleExpression2 + ');';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.Conjunction(0,
            get42(0),
            get42(11)
        )
    ));
    expect(parse(testcase_associativity)).toEqualWithType(createItExpression(
        new Expr.Conjunction(0,
            new Expr.Conjunction(0,
                get42(0),
                createSampleExpression1(12)
            ),
            createSampleExpression2(41)
        )
    ));
    expect(parse(testcase_precedence_disj1)).toEqualWithType(createItExpression(
        new Expr.Disjunction(0,
            new Expr.Conjunction(0,
                get42(0),
                createSampleExpression1(12)
            ),
            createSampleExpression2(40)
        )
    ))
    expect(parse(testcase_precedence_disj2)).toEqualWithType(createItExpression(
        new Expr.Disjunction(0,
            get42(0),
            new Expr.Conjunction(11,
                createSampleExpression1(11),
                createSampleExpression2(40)
            )
        )
    ));
    expect(parse(testcase_precedence_handle1)).toEqualWithType(createItExpression(
        new Expr.HandleException(3,
            new Expr.Conjunction(0,
                get42(0),
                createSampleExpression1(12)
            ),
            new Expr.Match(39,
                [[new Expr.Wildcard(39), get42(44)]]
            )
        )
    ));
    expect(parse(testcase_precedence_handle2)).toEqualWithType(createItExpression(
        new Expr.HandleException(21,
            createSampleExpression1(1)
            new Expr.Match(28,
                [[new Expr.Wildcard(28),
                    new Expr.Conjunction(33,
                        get42(33),
                        get42(44)
                    )
                ]]
            )
        )
    ));
    expect(parse(testcase_precedence_raise)).toEqualWithType(createItExpression(
        new Expr.RaiseException(0,
            new Expr.Conjunction(6,
                get42(6),
                createSampleExpression1(18)
            )
        )
    ));
    expect(parse(testcase_precedence_if)).toEqualWithType(createItExpression(
        new Expr.Conditional(0,
            get42(3),
            createSampleExpression1(12),
            new Expr.Conjunction(37,
                get42(37),
                createSampleExpression2(49)
            )
        )
    ));
});

it("expression - disjunction", () => {
    let testcase_simple: string = '42 orelse 42;';
    let testcase_associativity: string = '42 orelse (' + sampleExpression1 + ') orelse (' + sampleExpression2 + ');';
    let testcase_precedence_handle1: string = '42 orelse (' + sampleExpression1 + ') handle _ => 42;';
    let testcase_precedence_handle2: string = '(' + sampleExpression1 + ') handle _ => 42 orelse 42;';

    let testcase_precedence_raise: string = 'raise 42 orelse (' + sampleExpression1 + ');';
    let testcase_precedence_if: string = 'if 42 then (' + sampleExpression1 + ') else 42 orelse (' + sampleExpression2 + ');';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.Disjunction(0,
            get42(0),
            get42(10)
        )
    ));
    expect(parse(testcase_associativity)).toEqualWithType(createItExpression(
        new Expr.Disjunction(0,
            new Expr.Disjunction(0,
                get42(0),
                createSampleExpression1(11)
            ),
            createSampleExpression2(39)
        )
    ));
    expect(parse(testcase_precedence_handle1)).toEqualWithType(createItExpression(
        new Expr.HandleException(3,
            new Expr.Disjunction(0,
                get42(0),
                createSampleExpression1(11)
            ),
            new Expr.Match(38,
                [[new Expr.Wildcard(38), get42(43)]]
            )
        )
    ));
    expect(parse(testcase_precedence_handle2)).toEqualWithType(createItExpression(
        new Expr.HandleException(21,
            createSampleExpression1(1)
            new Expr.Match(28,
                [[new Expr.Wildcard(28),
                    new Expr.Disjunction(33,
                        get42(33),
                        get42(43)
                    )
                ]]
            )
        )
    ));
    expect(parse(testcase_precedence_raise)).toEqualWithType(createItExpression(
        new Expr.RaiseException(0,
            new Expr.Disjunction(6,
                get42(6),
                createSampleExpression1(17)
            )
        )
    ));
    expect(parse(testcase_precedence_if)).toEqualWithType(createItExpression(
        new Expr.Conditional(0,
            get42(3),
            createSampleExpression1(12),
            new Expr.Disjunction(37,
                get42(37),
                createSampleExpression2(48)
            )
        )
    ));
});

it("expression - handle exception", () => {
    let testcase_simple: string = '42 handle _ => ' + sampleExpression1 + ';';
    let testcase_precedence_raise: string = 'raise 42 handle _ => ' + sampleExpression1 + ';';
    let testcase_precedence_if: string = 'if 42 then ' + sampleExpression1 + ' else 42 handle _ => ' + sampleExpression2 + ';';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.HandleException(3,
            get42(0),
            new Expr.Match(10,
                [[new Expr.Wildcard(10), createSampleExpression1(15)]]
            )
        )
    ));
    expect(parse(testcase_precedence_raise)).toEqualWithType(createItExpression(
        new Expr.RaiseException(0,
            new Expr.HandleException(9,
                get42(6),
                new Expr.Match(16,
                    [[new Expr.Wildcard(16), createSampleExpression1(21)]]
                )
            )
    ));
    expect(parse(testcase_precedence_if)).toEqualWithType(createItExpression(
        new Expr.Conditional(0,
            get42(3),
            createSampleExpression1(11),
            new Expr.HandleException(38,
                get42(35),
                new Expr.Match(45,
                    [[new Expr.Wildcard(45), createSampleExpression2(50)]]
                )
            )
    ));
});

it("expression - raise exception", () => {
    let testcase_simple1: string = 'raise 42;';
    let testcase_simple2: string = 'raise ' + sampleExpression1 + ';';
    let testcase_simple3: string = 'raise ' + sampleExpression2 + ';';

    expect(parse(testcase_simple1)).toEqualWithType(createItExpression(
        new Expr.RaiseException(0,
            get42(6)
        )
    ));
    expect(parse(testcase_simple2)).toEqualWithType(createItExpression(
        new Expr.RaiseException(0,
            createSampleExpression1(6)
        )
    ));
    expect(parse(testcase_simple3)).toEqualWithType(createItExpression(
        new Expr.RaiseException(0,
            createSampleExpression2(6)
        )
    ));
});

it("expression - conditional", () => {
    let testcase_simple: string = 'if 42 then ' + sampleExpression1 + ' else ' + sampleExpression2 + ';';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.Conditional(0,
            get42(3),
            createSampleExpression1(11),
            createSampleExpression2(35)
        )
    ));
});

it("expression - iteration", () => {
    let testcase_simple: string = 'while true do 42;';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.While(0,
            new Expr.ValueIdentifier(6,
                new Lexer.AlphanumericIdentifierToken('true', 6)
            ),
            get42(14)
        )
    ));
});

it("expression - case analysis", () => {
    let testcase_simple: string = 'case 42 of _ => 42;';
    let testcase_multipattern: string = 'case ' + sampleExpression1 + ' of _ => 42 | 42 => ' + sampleExpression2 + ';';
    let testcase_nested: string = 'case 42 of _ => case ' + sampleExpression2 + ' of _ => 42 | 42 => ' + sampleExpression1 +';';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.CaseAnalysis(0,
            get42(5),
            new Expr.Match(11,
                [[new Expr.Wildcard(11), get42(16)]]
            )
        )
    ));
    expect(parse(testcase_multipattern)).toEqualWithType(createItExpression(
        new Expr.CaseAnalysis(0,
            createSampleExpression1(5),
            new Expr.Match(27,
                [
                    [new Expr.Wildcard(27), get42(32)],
                    [get42(37), createSampleExpression2(43)]
                ]
            )
        )
    ));
    expect(parse(testcase_nested)).toEqualWithType(createItExpression(
        new Expr.CaseAnalysis(0,
            get42(5)
            new Expr.Match(11,
                [[new Expr.Wildcard(11),
                    new Expr.CaseAnalysis(16,
                        createSampleExpression2(21),
                        new Expr.Match(43,
                            [
                                [new Expr.Wildcard(43), get42(48)],
                                [get42(53), createSampleExpression1(59)]
                            ]
                        )
                    )
                ]]
            )
        )
    ));
});

it("expression - function", () => {
    let testcase_simple: string = 'fn _ => 42;';
    let testcase_multipattern: string = 'fn _ => 42 | 42 => ' + sampleExpression2 + ';';
    let testcase_nested: string = 'fn _ => fn _ => 42 | 42 => ' + sampleExpression1 +';';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.Lambda(0,
            new Expr.Match(3,
                [[new Expr.Wildcard(3), get42(8)]]
            )
        )
    ));
    expect(parse(testcase_multipattern)).toEqualWithType(createItExpression(
        new Expr.Lambda(0,
            new Expr.Match(3,
                [
                    [new Expr.Wildcard(3), get42(8)],
                    [get42(13), createSampleExpression2(19)]
                ]
            )
        )
    ));
    expect(parse(testcase_nested)).toEqualWithType(createItExpression(
        new Expr.Lambda(0,
            new Expr.Match(3,
                [[new Expr.Wildcard(3),
                    new Expr.Lambda(8,
                        new Expr.Match(11,
                            [
                                [new Expr.Wildcard(11), get42(16)],
                                [get42(21), createSampleExpression1(27)]
                            ]
                        )
                    )
                ]]
            )
        )
    ));
});

it("matches", () => {
    //TODO tests
});

it("declaration - value declaration", () => {
    let testcase_0_tyvar: string = 'val x = 42;';
    let testcase_1_tyvar: string = 'val \'a x = 42;';
    let testcase_1_tyvar_seq: string = 'val (\'a) x = 42;';
    let testcase_2_tyvar: string = 'val (\'a, \'b) x = 42;';
    let testcase_3_tyvar: string = 'val (\'a, \'b, \'c) x = 42;';

    expect(parse(testcase_0_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(4, false,
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('x', 4)),
                    get42(8)
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_1_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [
                    new Type.TypeVariable('\'a', false, 4)
                ], [
                    new Decl.ValueBinding(7, false,
                        new Expr.ValueIdentifier(7, new Lexer.AlphanumericIdentifierToken('x', 7)),
                        get42(11)
                    )
                ], 2
            )
        ], 1)
    );
    expect(parse(testcase_1_tyvar_seq)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [
                    new Type.TypeVariable('\'a', false, 5)
                ], [
                    new Decl.ValueBinding(9, false,
                        new Expr.ValueIdentifier(9, new Lexer.AlphanumericIdentifierToken('x', 9)),
                        get42(13)
                    )
                ], 2
            )
        ], 1)
    );
    expect(parse(testcase_2_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [
                    new Type.TypeVariable('\'a', false, 5),
                    new Type.TypeVariable('\'b', false, 9)
                ], [
                    new Decl.ValueBinding(13, false,
                        new Expr.ValueIdentifier(13, new Lexer.AlphanumericIdentifierToken('x', 13)),
                        get42(17)
                    )
                ], 2
            )
        ], 1)
    );
    expect(parse(testcase_3_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [
                    new Type.TypeVariable('\'a', false, 5),
                    new Type.TypeVariable('\'b', false, 9),
                    new Type.TypeVariable('\'c', false, 13)
                ], [
                    new Decl.ValueBinding(17, false,
                        new Expr.ValueIdentifier(17, new Lexer.AlphanumericIdentifierToken('x', 17)),
                        get42(21)
                    )
                ], 2
            )
        ], 1)
    );
});

it("declaration - function declaration", () => {
    let testcase_0_tyvar: string = 'fun f x = 42;';
    let testcase_1_tyvar: string = 'fun \'a f x = 42;';
    let testcase_1_tyvar_seq: string = 'fun (\'a) f x = 42;';
    let testcase_2_tyvar: string = 'fun (\'a, \'b) f x = 42;';
    let testcase_3_tyvar: string = 'fun (\'a, \'b, \'c) f x = 42;';

    expect(parse(testcase_0_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [], [
                new Decl.FunctionValueBinding(4,[
                        [
                            [new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('x', 6))],
                            undefined,
                            get42(10),
                        ]
                    ],
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('f', 4)),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_1_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [
                    new Type.TypeVariable('\'a', false, 4)
                ], [
                    new Decl.FunctionValueBinding(7,[
                            [
                                [new Expr.ValueIdentifier(9, new Lexer.AlphanumericIdentifierToken('x', 9))],
                                undefined,
                                get42(13),
                            ]
                        ],
                        new Expr.ValueIdentifier(7, new Lexer.AlphanumericIdentifierToken('f', 7)),
                    )
                ], 2
            )
        ], 1)
    );
    expect(parse(testcase_1_tyvar_seq)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [
                    new Type.TypeVariable('\'a', false, 5)
                ], [
                    new Decl.FunctionValueBinding(9,[
                            [
                                [new Expr.ValueIdentifier(11, new Lexer.AlphanumericIdentifierToken('x', 11))],
                                undefined,
                                get42(15),
                            ]
                        ],
                        new Expr.ValueIdentifier(9, new Lexer.AlphanumericIdentifierToken('f', 9)),
                    )
                ], 2
            )
        ], 1)
    );
    expect(parse(testcase_2_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [
                    new Type.TypeVariable('\'a', false, 5),
                    new Type.TypeVariable('\'b', false, 9)
                ], [
                    new Decl.FunctionValueBinding(13,[
                            [
                                [new Expr.ValueIdentifier(15, new Lexer.AlphanumericIdentifierToken('x', 15))],
                                undefined,
                                get42(19),
                            ]
                        ],
                        new Expr.ValueIdentifier(13, new Lexer.AlphanumericIdentifierToken('f', 13)),
                    )
                ], 2
            )
        ], 1)
    );
    expect(parse(testcase_3_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [
                    new Type.TypeVariable('\'a', false, 5),
                    new Type.TypeVariable('\'b', false, 9),
                    new Type.TypeVariable('\'c', false, 13)
                ], [
                    new Decl.FunctionValueBinding(17,[
                            [
                                [new Expr.ValueIdentifier(19, new Lexer.AlphanumericIdentifierToken('x', 19))],
                                undefined,
                                get42(23),
                            ]
                        ],
                        new Expr.ValueIdentifier(17, new Lexer.AlphanumericIdentifierToken('f', 17)),
                    )
                ], 2
            )
        ], 1)
    );
    expect(() => { parse("fun f = 42;"); }).toThrow(Parser.ParserError);
});

it("declaration - type declaration", () => {
    let testcase_alphanum: string = 'type blub = \'a;';
    let testcase_nonalphanum: string = 'type #### = \'a;';
    let testcase_numeric: string = 'type 42 = \'a;';
    let testcase_star: string = 'type * = \'a;';

    expect(parse(testcase_alphanum)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.TypeDeclaration(0, [
                new Decl.TypeBinding(5, [] ,
                    new Lexer.AlphanumericIdentifierToken('blub', 5),
                    new Type.TypeVariable('\'a', true, 12)
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_nonalphanum)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.TypeDeclaration(0, [
                new Decl.TypeBinding(5, [] ,
                    new Lexer.IdentifierToken('####', 5),
                    new Type.TypeVariable('\'a', true, 12)
                )
            ], 2)
        ], 1)
    );
    expect(() => { parse(testcase_numeric); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_star); }).toThrow(Parser.ParserError);
});

it("declaration - datatype declaration", () => {
    let testcase_alphanum: string = 'datatype blub = X of \'a;';
    let testcase_nonalphanum: string = 'datatype #### = X of \'a;';
    let testcase_numeric: string = 'datatype 42 = X of \'a;';
    let testcase_star: string = 'datatype * = X of \'a;';
    //TODO test withtype

    expect(parse(testcase_alphanum)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [] ,
                    new Lexer.AlphanumericIdentifierToken('blub', 9),
                    [
                        [new Lexer.AlphanumericIdentifierToken('X', 16), new Type.TypeVariable('\'a', true, 21)]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(parse(testcase_nonalphanum)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [] ,
                    new Lexer.IdentifierToken('####', 9),
                    [
                        [new Lexer.AlphanumericIdentifierToken('X', 16), new Type.TypeVariable('\'a', true, 21)]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(() => { parse(testcase_numeric); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_star); }).toThrow(Parser.ParserError);
});

it("declaration - datatype replication", () => {
    //TODO tests
});

it("declaration - abstype declaration", () => {
    //TODO tests
});

it("declaration - exception declaration", () => {
    let testcase_simple: string = 'exception X;';
    let testcase_of: string = 'exception X of \'a;';

    expect(parse(testcase_simple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.DirectExceptionBinding(10,
                    new Lexer.AlphanumericIdentifierToken('X', 10),
                    undefined
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_of)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.DirectExceptionBinding(10,
                    new Lexer.AlphanumericIdentifierToken('X', 10),
                    new Type.TypeVariable('\'a', true, 15)
                )
            ], 2)
        ], 1)
    );
});

it("declaration - local declaration", () => {
    let testcase_single1: string = 'local val it = 42 in end;';
    let testcase_single2: string = 'local val it = 42; in end;';
    let testcase_multiple: string = 'local val it = 42; val it = 42 in end;';
    let testcase_single_dec: string = 'local in val it = 42 end;';
    let testcase_multiple_dec: string = 'local in val it = 42; val it = 42 end;';

    expect(parse(testcase_single1)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.LocalDeclaration(0,
                new Decl.SequentialDeclaration(6, [
                    new Decl.ValueDeclaration(6, [], [
                        new Decl.ValueBinding(10, false,
                            new Expr.ValueIdentifier(10, new Lexer.AlphanumericIdentifierToken('it', 10)),
                            get42(15)
                        )
                    ], 4)
                ], 3),
                new Decl.SequentialDeclaration(21, [
                ], 6), 2
            )
        ], 1)
    );
    expect(parse(testcase_single2)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.LocalDeclaration(0,
                new Decl.SequentialDeclaration(6, [
                    new Decl.ValueDeclaration(6, [], [
                        new Decl.ValueBinding(10, false,
                            new Expr.ValueIdentifier(10, new Lexer.AlphanumericIdentifierToken('it', 10)),
                            get42(15)
                        )
                    ], 4)
                ], 3),
                new Decl.SequentialDeclaration(22, [
                ], 6), 2
            )
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.LocalDeclaration(0,
                new Decl.SequentialDeclaration(6, [
                    new Decl.ValueDeclaration(6, [], [
                        new Decl.ValueBinding(10, false,
                            new Expr.ValueIdentifier(10, new Lexer.AlphanumericIdentifierToken('it', 10)),
                            get42(15)
                        )
                    ], 4),
                    new Decl.ValueDeclaration(19, [], [
                        new Decl.ValueBinding(23, false,
                            new Expr.ValueIdentifier(23, new Lexer.AlphanumericIdentifierToken('it', 23)),
                            get42(28)
                        )
                    ], 5)
                ], 3),
                new Decl.SequentialDeclaration(34, [
                ], 7), 2
            )
        ], 1)
    );
    expect(parse(testcase_multiple_dec)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.LocalDeclaration(0,
                new Decl.SequentialDeclaration(6, [
                ], 3),
                new Decl.SequentialDeclaration(9, [
                    new Decl.ValueDeclaration(9, [], [
                        new Decl.ValueBinding(13, false,
                            new Expr.ValueIdentifier(13, new Lexer.AlphanumericIdentifierToken('it', 13)),
                            get42(18)
                        )
                    ], 6),
                    new Decl.ValueDeclaration(22, [], [
                        new Decl.ValueBinding(26, false,
                            new Expr.ValueIdentifier(26, new Lexer.AlphanumericIdentifierToken('it', 26)),
                            get42(31)
                        )
                    ], 7)
                ], 5), 2
            )
        ], 1)
    );
});

it("declaration - open declaration", () => {
    let testcase_single: string = 'open stru;';
    let testcase_multiple: string = 'open stru stra.stru;';


    expect(parse(testcase_single)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.OpenDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('stru', 5)
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.OpenDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('stru', 5),
                new Lexer.LongIdentifierToken('stra.stru', 10, [
                    new Lexer.AlphanumericIdentifierToken('stra', 10)
                ], new Lexer.AlphanumericIdentifierToken('stru', 15))
            ], 2)
        ], 1)
    );
});

it("declaration - empty declaration", () => {
    let testcase: string = ';';

    expect(parse(testcase)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
        ], 1)
    );
});

it("declaration - sequential declaration", () => {
    let testcase: string = 'val it = 42; val it = 42; val it = 42;';

    expect(parse(testcase)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(4, false,
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('it', 4)),
                    get42(9)
                )
            ], 2),
            new Decl.ValueDeclaration(13, [], [
                new Decl.ValueBinding(17, false,
                    new Expr.ValueIdentifier(17, new Lexer.AlphanumericIdentifierToken('it', 17)),
                    get42(22)
                )
            ], 3),
            new Decl.ValueDeclaration(26, [], [
                new Decl.ValueBinding(30, false,
                    new Expr.ValueIdentifier(30, new Lexer.AlphanumericIdentifierToken('it', 30)),
                    get42(35)
                )
            ], 4)
        ], 1)
    );
});

it("declaration - infix (L) directive", () => {
    let testcase_simple: string = 'infix f;';
    let testcase_0: string = 'infix 0 f;';
    let testcase_9: string = 'infix 9 f;';
    let testcase_star: string = 'infix *;';
    let testcase_multiple: string = 'infix * f g;';
    let testcase_double_digit1: string = 'infix 00 f;';
    let testcase_double_digit2: string = 'infix 10 f;';
    let testcase_negative: string = 'infix ~1 f;';
    let testcase_prime: string = 'infix \'a;';

    expect(parse(testcase_simple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 6)
            ], 0, 2)
        ], 1)
    );
    expect(parse(testcase_0)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 8)
            ], 0, 2)
        ], 1)
    );
    expect(parse(testcase_9)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 8)
            ], 9, 2)
        ], 1)
    );
    expect(parse(testcase_star)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.StarToken(6)
            ], 0, 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [
                new Lexer.StarToken(6),
                new Lexer.AlphanumericIdentifierToken('f', 8),
                new Lexer.AlphanumericIdentifierToken('g', 10)
            ], 0, 2)
        ], 1)
    );
    expect(() => { parse(testcase_double_digit1); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_double_digit2); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_negative); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_prime); }).toThrow(Parser.ParserError);
});

it("declaration - infix (R) directive", () => {
    let testcase_simple: string = 'infixr f;';
    let testcase_0: string = 'infixr 0 f;';
    let testcase_9: string = 'infixr 9 f;';
    let testcase_star: string = 'infixr *;';
    let testcase_multiple: string = 'infixr * f g;';
    let testcase_double_digit1: string = 'infixr 00 f;';
    let testcase_double_digit2: string = 'infixr 10 f;';
    let testcase_negative: string = 'infixr ~1 f;';
    let testcase_prime: string = 'infixr \'a;';

    expect(parse(testcase_simple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixRDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 7)
            ], 0, 2)
        ], 1)
    );
    expect(parse(testcase_0)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixRDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 9)
            ], 0, 2)
        ], 1)
    );
    expect(parse(testcase_9)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixRDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 9)
            ], 9, 2)
        ], 1)
    );
    expect(parse(testcase_star)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixRDeclaration(0, [
                new Lexer.StarToken(7)
            ], 0, 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixRDeclaration(0, [
                new Lexer.StarToken(7),
                new Lexer.AlphanumericIdentifierToken('f', 9),
                new Lexer.AlphanumericIdentifierToken('g', 11)
            ], 0, 2)
        ], 1)
    );
    expect(() => { parse(testcase_double_digit1); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_double_digit2); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_negative); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_prime); }).toThrow(Parser.ParserError);
});

it("declaration - nonfix directive", () => {
    let testcase_simple: string = 'nonfix f;';
    let testcase_star: string = 'nonfix *;';
    let testcase_multiple: string = 'nonfix * f g;';
    let testcase_prime: string = 'nonfix \'a;';
    let testcase_no_precedence: string = 'nonfix 0 f;';

    expect(parse(testcase_simple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.NonfixDeclaration(0, [
                new Lexer.AlphanumericIdentifierToken('f', 7)
            ], 2)
        ], 1)
    );
    expect(parse(testcase_star)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.NonfixDeclaration(0, [
                new Lexer.StarToken(7)
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.NonfixDeclaration(0, [
                new Lexer.StarToken(7),
                new Lexer.AlphanumericIdentifierToken('f', 9),
                new Lexer.AlphanumericIdentifierToken('g', 11)
            ], 2)
        ], 1)
    );
    expect(() => { parse(testcase_prime); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_no_precedence); }).toThrow(Parser.ParserError);
});

it("value bindings - non recursive", () => {
    let testcase_single: string = 'val _ = 42;';
    let testcase_multiple: string = 'val _ = 42 and x = ' + sampleExpression1 + ';';
    let testcase_disallowed_tyseq: string = 'val _ = 42 and \'a _ = 42;';

    expect(parse(testcase_single)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(4, false,
                    new Expr.Wildcard(4),
                    get42(8)
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(4, false,
                    new Expr.Wildcard(4),
                    get42(8)
                ),
                new Decl.ValueBinding(15, false,
                    new Expr.ValueIdentifier(15,
                        new Lexer.AlphanumericIdentifierToken('x', 15)
                    )
                    createSampleExpression1(19)
                )
            ], 2)
        ], 1)
    );
    expect(() => { parse(testcase_disallowed_tyseq); }).toThrow(Parser.ParserError);
});

it("value bindings - recursive", () => {
    let testcase_single: string = 'val rec _ = fn _ => 42;';
    let testcase_multirec: string = 'val rec rec rec _ = fn _ => 42;';
    let testcase_multiple: string = 'val _ = fn _ => 42 and rec f = fn _ => ' + sampleExpression1 + ' and g = fn _ => ' + sampleExpression2 + ';';
    let testcase_no_lambda: string = 'val rec _ = 42;';
    expect(parse(testcase_single)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(4, true,
                    new Expr.Wildcard(8),
                    new Expr.Lambda(12,
                        new Expr.Match(15, [
                            [new Expr.Wildcard(15), get42(20)]
                        ])
                    )
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multirec)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(4, true,
                    new Expr.Wildcard(16),
                    new Expr.Lambda(20,
                        new Expr.Match(23, [
                            [new Expr.Wildcard(23), get42(28)]
                        ])
                    )
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ValueDeclaration(0, [], [
                new Decl.ValueBinding(4, false,
                    new Expr.Wildcard(4),
                    new Expr.Lambda(8,
                        new Expr.Match(11, [
                            [new Expr.Wildcard(11), get42(16)]
                        ])
                    )
                )
                new Decl.ValueBinding(23, true,
                    new Expr.ValueIdentifier(27,
                        new Lexer.AlphanumericIdentifierToken('f', 27)
                    )
                    new Expr.Lambda(31,
                        new Expr.Match(34, [
                            [new Expr.Wildcard(34), createSampleExpression1(39)]
                        ])
                    )
                )
                new Decl.ValueBinding(62, true,
                    new Expr.ValueIdentifier(62,
                        new Lexer.AlphanumericIdentifierToken('g', 62)
                    )
                    new Expr.Lambda(66,
                        new Expr.Match(69, [
                            [new Expr.Wildcard(69), createSampleExpression2(74)]
                        ])
                    )
                )
            ], 2)
        ], 1)
    );
    expect(() => {parse(testcase_no_lambda);}).toThrow(Parser.ParserError);
});

it("function value bindings", () => {
    let testcase_simple: string = 'fun f x = 42;';
    let testcase_op: string = 'fun op f x = 42;';
    let testcase_ty: string = 'fun f x : \'a = 42;';
    let testcase_op_ty: string = 'fun op f x : \'a = 42;';
    let testcase_multiple_matches: string = 'fun f x = 42 | f _ = ' + sampleExpression1 + ';';
    let testcase_multiple_bindings: string = 'fun f x = 42 | f _ = ' + sampleExpression1 + ' and g x = ' + sampleExpression2 + ';';
    let testcase_infix: string = 'infix f; fun a f b = 42;';
    //TODO more infix tests!!

    expect(parse(testcase_simple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [], [
                new Decl.FunctionValueBinding(4,[
                        [
                            [new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('x', 6))],
                            undefined,
                            get42(10),
                        ]
                    ],
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('f', 4)),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_op)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [], [
                new Decl.FunctionValueBinding(4,[
                        [
                            [new Expr.ValueIdentifier(9, new Lexer.AlphanumericIdentifierToken('x', 9))],
                            undefined,
                            get42(13),
                        ]
                    ],
                    new Expr.ValueIdentifier(7, prefixWithOp(new Lexer.AlphanumericIdentifierToken('f', 7))),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_ty)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [], [
                new Decl.FunctionValueBinding(4,[
                        [
                            [new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('x', 6))],
                            new Type.TypeVariable('\'a', true, 10),
                            get42(15),
                        ]
                    ],
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('f', 4)),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_op_ty)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [], [
                new Decl.FunctionValueBinding(4,[
                        [
                            [new Expr.ValueIdentifier(9, new Lexer.AlphanumericIdentifierToken('x', 9))],
                            new Type.TypeVariable('\'a', true, 13),
                            get42(18),
                        ]
                    ],
                    new Expr.ValueIdentifier(7, prefixWithOp(new Lexer.AlphanumericIdentifierToken('f', 7))),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multiple_matches)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [], [
                new Decl.FunctionValueBinding(4,[
                        [
                            [new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('x', 6))],
                            undefined,
                            get42(10),
                        ], [
                            [new Expr.Wildcard(17)],
                            undefined,
                            createSampleExpression1(21)
                        ]
                    ],
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('f', 4)),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multiple_bindings)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.FunctionDeclaration(0, [], [
                new Decl.FunctionValueBinding(4,[
                        [
                            [new Expr.ValueIdentifier(6, new Lexer.AlphanumericIdentifierToken('x', 6))],
                            undefined,
                            get42(10),
                        ], [
                            [new Expr.Wildcard(17)],
                            undefined,
                            createSampleExpression1(21)
                        ]
                    ],
                    new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken('f', 4)),
                ),
                new Decl.FunctionValueBinding(44,[
                        [
                            [new Expr.ValueIdentifier(46, new Lexer.AlphanumericIdentifierToken('x', 46))],
                            undefined,
                            createSampleExpression2(50)
                        ]
                    ],
                    new Expr.ValueIdentifier(44, new Lexer.AlphanumericIdentifierToken('g', 44)),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_infix)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.InfixDeclaration(0, [new Lexer.AlphanumericIdentifierToken("f", 6)], 0, 2),
            new Decl.FunctionDeclaration(9, [], [
                new Decl.FunctionValueBinding(13, [
                        [
                            [new Expr.Tuple(-1, [
                                new Expr.ValueIdentifier(13, new Lexer.AlphanumericIdentifierToken('a', 13)),
                                new Expr.ValueIdentifier(17, new Lexer.AlphanumericIdentifierToken('b', 17))
                            ])],
                            undefined
                            get42(21)
                        ]
                    ],
                    new Expr.ValueIdentifier(15, new Lexer.AlphanumericIdentifierToken('f', 15))
                )
            ], 3)
        ], 1)
    );
});

it("type bindings", () => {
    let testcase_1_tyvar: string = 'type \'a blub = \'a;';
    let testcase_2_tyvar: string = 'type (\'a, \'b) blub = \'a;';
    let testcase_multiple: string = 'type \'a blub = \'a and \'b blob = \'b;';

    expect(parse(testcase_1_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.TypeDeclaration(0, [
                new Decl.TypeBinding(5, [
                        new Type.TypeVariable('\'a', false, 5)
                    ],
                    new Lexer.AlphanumericIdentifierToken('blub', 8),
                    new Type.TypeVariable('\'a', true, 15)
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_2_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.TypeDeclaration(0, [
                new Decl.TypeBinding(5, [
                        new Type.TypeVariable('\'a', false, 6),
                        new Type.TypeVariable('\'b', false, 10)
                    ],
                    new Lexer.AlphanumericIdentifierToken('blub', 14),
                    new Type.TypeVariable('\'a', true, 21)
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.TypeDeclaration(0, [
                new Decl.TypeBinding(5, [
                        new Type.TypeVariable('\'a', false, 5)
                    ],
                    new Lexer.AlphanumericIdentifierToken('blub', 8),
                    new Type.TypeVariable('\'a', true, 15)
                ),
                new Decl.TypeBinding(22, [
                        new Type.TypeVariable('\'b', false, 22)
                    ],
                    new Lexer.AlphanumericIdentifierToken('blob', 25),
                    new Type.TypeVariable('\'b', true, 32)
                )
            ], 2)
        ], 1)
    );
});

it("datatype bindings", () => {
    let testcase_1_tyvar: string = 'datatype \'a blub = x of \'a;';
    let testcase_2_tyvar: string = 'datatype (\'a, \'b) blub = x;';
    let testcase_multiple: string = 'datatype \'a blub = x of \'a and \'b blob = y;';

    expect(parse(testcase_1_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [
                        new Type.TypeVariable('\'a', false, 9)
                    ],
                    new Lexer.AlphanumericIdentifierToken('blub', 12),
                    [
                        [new Lexer.AlphanumericIdentifierToken('x', 19), new Type.TypeVariable('\'a', true, 24)]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(parse(testcase_2_tyvar)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [
                        new Type.TypeVariable('\'a', false, 10),
                        new Type.TypeVariable('\'b', false, 14)
                    ],
                    new Lexer.AlphanumericIdentifierToken('blub', 18),
                    [
                        [new Lexer.AlphanumericIdentifierToken('x', 25), undefined]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [
                        new Type.TypeVariable('\'a', false, 9)
                    ],
                    new Lexer.AlphanumericIdentifierToken('blub', 12),
                    [
                        [new Lexer.AlphanumericIdentifierToken('x', 19), new Type.TypeVariable('\'a', true, 24)]
                    ]
                ),
                new Decl.DatatypeBinding(31, [
                        new Type.TypeVariable('\'b', false, 31)
                    ],
                    new Lexer.AlphanumericIdentifierToken('blob', 34),
                    [
                        [new Lexer.AlphanumericIdentifierToken('y', 41), undefined]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
});

it("constructor bindings", () => {
    let testcase_simple: string = 'datatype blub = X;';
    let testcase_op: string = 'datatype blub = op X;';
    let testcase_of: string = 'datatype blub = X of \'a;';
    let testcase_op_of: string = 'datatype blub = op X of \'a;';
    let testcase_multiple: string = 'datatype blub = op X of \'a | Y;';
    let testcase_multiple_datatypes: string = 'datatype blub = op X of \'a | Y and blob = Z;';

    expect(parse(testcase_simple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [] ,
                    new Lexer.AlphanumericIdentifierToken('blub', 9),
                    [
                        [new Lexer.AlphanumericIdentifierToken('X', 16), undefined]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(parse(testcase_op)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [] ,
                    new Lexer.AlphanumericIdentifierToken('blub', 9),
                    [
                        [prefixWithOp(new Lexer.AlphanumericIdentifierToken('X', 19)), undefined]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(parse(testcase_of)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [] ,
                    new Lexer.AlphanumericIdentifierToken('blub', 9),
                    [
                        [new Lexer.AlphanumericIdentifierToken('X', 16), new Type.TypeVariable('\'a', true, 21)]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(parse(testcase_op_of)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [] ,
                    new Lexer.AlphanumericIdentifierToken('blub', 9),
                    [
                        [prefixWithOp(new Lexer.AlphanumericIdentifierToken('X', 19)), new Type.TypeVariable('\'a', true, 24)]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [] ,
                    new Lexer.AlphanumericIdentifierToken('blub', 9),
                    [
                        [prefixWithOp(new Lexer.AlphanumericIdentifierToken('X', 19)), new Type.TypeVariable('\'a', true, 24)],
                        [new Lexer.AlphanumericIdentifierToken('Y', 29), undefined]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
    expect(parse(testcase_multiple_datatypes)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.DatatypeDeclaration(0, [
                new Decl.DatatypeBinding(9, [] ,
                    new Lexer.AlphanumericIdentifierToken('blub', 9),
                    [
                        [prefixWithOp(new Lexer.AlphanumericIdentifierToken('X', 19)), new Type.TypeVariable('\'a', true, 24)],
                        [new Lexer.AlphanumericIdentifierToken('Y', 29), undefined]
                    ]
                )
                new Decl.DatatypeBinding(35, [] ,
                    new Lexer.AlphanumericIdentifierToken('blob', 35),
                    [
                        [new Lexer.AlphanumericIdentifierToken('Z', 42), undefined]
                    ]
                )
            ], undefined, 2)
        ], 1)
    );
});

it("exception bindings", () => {
    let testcase_direct_simple: string = 'exception X;';
    let testcase_direct_op: string = 'exception op X;';
    let testcase_direct_of: string = 'exception X of \'a;';
    let testcase_direct_op_of: string = 'exception op X of \'a;';
    let testcase_alias_simple: string = 'exception X = Y;';
    let testcase_alias_op: string = 'exception op X = op Y;';
    let testcase_multiple: string = 'exception X = Y and Z of \'a and W = Y;';


    expect(parse(testcase_direct_simple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.DirectExceptionBinding(10,
                    new Lexer.AlphanumericIdentifierToken('X', 10),
                    undefined
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_direct_op)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.DirectExceptionBinding(10,
                    prefixWithOp(new Lexer.AlphanumericIdentifierToken('X', 13)),
                    undefined
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_direct_of)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.DirectExceptionBinding(10,
                    new Lexer.AlphanumericIdentifierToken('X', 10),
                    new Type.TypeVariable('\'a', true, 15)
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_direct_op_of)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.DirectExceptionBinding(10,
                    prefixWithOp(new Lexer.AlphanumericIdentifierToken('X', 13)),
                    new Type.TypeVariable('\'a', true, 18)
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_alias_simple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.ExceptionAlias(10,
                    new Lexer.AlphanumericIdentifierToken('X', 10),
                    new Lexer.AlphanumericIdentifierToken('Y', 14),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_alias_op)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.ExceptionAlias(10,
                    prefixWithOp(new Lexer.AlphanumericIdentifierToken('X', 13)),
                    prefixWithOp(new Lexer.AlphanumericIdentifierToken('Y', 20)),
                )
            ], 2)
        ], 1)
    );
    expect(parse(testcase_multiple)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            new Decl.ExceptionDeclaration(0, [
                new Decl.ExceptionAlias(10,
                    new Lexer.AlphanumericIdentifierToken('X', 10),
                    new Lexer.AlphanumericIdentifierToken('Y', 14),
                ),
                new Decl.DirectExceptionBinding(20,
                    new Lexer.AlphanumericIdentifierToken('Z', 20),
                    new Type.TypeVariable('\'a', true, 25)
                ),
                new Decl.ExceptionAlias(32,
                    new Lexer.AlphanumericIdentifierToken('W', 32),
                    new Lexer.AlphanumericIdentifierToken('Y', 36),
                )
            ], 2)
        ], 1)
    );
});

it("atomic pattern - wildcard", () => {
    let wildcard_test:string = "val _ = 42;";
    expect(parse(wildcard_test)).toEqualWithType(pattern_tester(
        new Expr.Wildcard(4), 8));
});

it("atomic pattern - special constant", () => {
    let special_constant:string = "val 42 = 42;";
    expect(parse(special_constant)).toEqualWithType(pattern_tester(
        get42(4)
    , 9));
});

it("atomic pattern - value identifier", () => {
    let atomic_pattern_vid_no_op: string = "val x = 42;";
    let atomic_pattern_vid_with_op: string = "val op x = 42;";
    expect(parse(atomic_pattern_vid_no_op)).toEqualWithType(pattern_tester(
        new Expr.ValueIdentifier(4,
        new Lexer.AlphanumericIdentifierToken("x", 4))
    , 8));
    expect(parse(atomic_pattern_vid_with_op)).toEqualWithType(pattern_tester(
        new Expr.ValueIdentifier(4,
        prefixWithOp(new Lexer.AlphanumericIdentifierToken("x", 7)))
    , 11));
});

it("atomic pattern - record", () => {
    let atomic_pattern_record: string = "val { x = _ } = 42;";
    expect(parse(atomic_pattern_record)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [["x", new Expr.Wildcard(10)]])
    , 16));
    let atomic_pattern_record1: string = "val { x = _, y = 10 } = 42;";
    expect(parse(atomic_pattern_record1)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [["x", new Expr.Wildcard(10)],
    ["y", new Expr.Constant(17, new Lexer.NumericToken("10", 17, 10))]])
    , 24));
    let atomic_pattern_record2: string = "val { x = _, y = 10, ... } = 42;";
    expect(parse(atomic_pattern_record2)).toEqualWithType(pattern_tester(
        new Expr.Record(6, false, [["x", new Expr.Wildcard(10)],
    ["y", new Expr.Constant(17, new Lexer.NumericToken("10", 17, 10))]])
    , 29));
    let atomic_pattern_record_non_atomic: string = "val { x = _:int } = 42;";
    expect(parse(atomic_pattern_record_non_atomic)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [["x", new Expr.TypedExpression(10, new Expr.Wildcard(10),
            new Type.CustomType('int', [], 12))]])
    , 20));
});

it("atomic pattern - 0-tuple", () => {
    let atomic_pattern_0_tuple: string = "val () = 42;";
    expect(parse(atomic_pattern_0_tuple)).toEqualWithType(pattern_tester(
        new Expr.Tuple(4, [])
    , 9));
});

it("atomic pattern - n-tuple", () => {

    let atomic_pattern_2_tuple:string = "val (_,_) = 42;";
    expect(parse(atomic_pattern_2_tuple)).toEqualWithType(pattern_tester(
        new Expr.Tuple(4, [
            new Expr.Wildcard(5),
            new Expr.Wildcard(7)
        ])
    , 12));

    let atomic_pattern_3_tuple:string = "val (_,_,x) = 42;";
    expect(parse(atomic_pattern_3_tuple)).toEqualWithType(pattern_tester(
        new Expr.Tuple(4, [
            new Expr.Wildcard(5),
            new Expr.Wildcard(7),
            new Expr.ValueIdentifier(9, new Lexer.AlphanumericIdentifierToken("x", 9))
        ])
    , 14));

    let atomic_pattern_tuple_pat:string = "val (_:int,_) = 42;";
    expect(parse(atomic_pattern_tuple_pat)).toEqualWithType(pattern_tester(
        new Expr.Tuple(4, [new Expr.TypedExpression(5, new Expr.Wildcard(5),
            new Type.CustomType('int', [], 7)),
            new Expr.Wildcard(11)
        ])
    , 16));
});

it("atomic pattern - list", () => {
    let atomic_pattern_0_list:string = "val [] = 42;";
    let atomic_pattern_1_list:string = "val [_] = 42;";
    let atomic_pattern_2_list:string = "val [_,_] = 42;";
    expect(parse(atomic_pattern_0_list)).toEqualWithType(pattern_tester(
        new Expr.List(4, [])
    , 9));
    expect(parse(atomic_pattern_1_list)).toEqualWithType(pattern_tester(
        new Expr.List(4, [new Expr.Wildcard(5)])
    , 10));
    expect(parse(atomic_pattern_2_list)).toEqualWithType(pattern_tester(
        new Expr.List(4, [new Expr.Wildcard(5), new Expr.Wildcard(7)])
    , 12));
    let atomic_pattern_list_pat:string = "val [_:int] = 42;";
    expect(parse(atomic_pattern_list_pat)).toEqualWithType(pattern_tester(
        new Expr.List(4, [new Expr.TypedExpression(5, new Expr.Wildcard(5),
            new Type.CustomType('int', [], 7))])
    , 14));
});

it("atomic pattern - bracketed", () => {
    let atomic_pattern_bracketed:string = "val (_) = 42;";
    expect(parse(atomic_pattern_bracketed)).toEqualWithType(pattern_tester(
        new Expr.Wildcard(5)
    , 10));
    let atomic_pattern_multi_bracketed:string = "val (((_))) = 42;";
    expect(parse(atomic_pattern_multi_bracketed)).toEqualWithType(pattern_tester(
        new Expr.Wildcard(7)
    , 14));
});

it("pattern row - wildcard", () => {
    let patrow_wildcard:string = "val { ... } = 42;";
    expect(parse(patrow_wildcard)).toEqualWithType(pattern_tester(
        new Expr.Record(6, false, [])
    , 14));
});

it("pattern row - pattern row", () => {
    let patrow_label: string = "val { l1 = _ } = 42;";
    expect(parse(patrow_label)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [["l1", new Expr.Wildcard(11)]])
    , 17));
    let patrow_label1: string = "val { 1 = _ } = 42;";
    expect(parse(patrow_label1)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [["1", new Expr.Wildcard(10)]])
    , 16));
    let patrow_label2: string = "val { * = _ } = 42;";
    expect(parse(patrow_label2)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [["*", new Expr.Wildcard(10)]])
    , 16));
    let patrow_label3: string = "val { $ = _ } = 42;";
    expect(parse(patrow_label3)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [["$", new Expr.Wildcard(10)]])
    , 16));
    let patrow_label4: string = "val { ## = _ } = 42;";
    expect(parse(patrow_label4)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [["##", new Expr.Wildcard(11)]])
    , 17));
    let patrow_label5: string = "val { ## = x } = 42;";
    expect(parse(patrow_label5)).toEqualWithType(pattern_tester(
        new Expr.Record(6, true, [[
            "##",
            new Expr.ValueIdentifier(11, new Lexer.AlphanumericIdentifierToken("x", 11))
        ]])
    , 17));
});

it("pattern row - wrong label", () => {
    let not_patrow_label: string = "val { 0 = _ } = 42;";
    expect(() => {parse(not_patrow_label);}).toThrow(Parser.ParserError);
    let not_patrow_label1: string = "val { 01 = _ } = 42;";
    expect(() => {parse(not_patrow_label1);}).toThrow(Parser.ParserError);
    let not_patrow_label2: string = "val { 'l = _ } = 42;";
    expect(() => {parse(not_patrow_label2);}).toThrow(Parser.ParserError);
    let not_patrow_label3: string = "val { = = _ } = 42;";
    expect(() => {parse(not_patrow_label3);}).toThrow(Parser.ParserError);
    let not_patrow_label4: string = "val { # = _ } = 42;";
    expect(() => {parse(not_patrow_label4);}).toThrow(Parser.ParserError);
});

it("pattern row - label as variable", () => {
    let patrow_as_label: string = "val {x:int as _} = 42;";
    expect(parse(patrow_as_label)).toEqualWithType(pattern_tester(
        new Expr.Record(
            5,
            true,
            [["x", new Expr.LayeredPattern(5, new Lexer.AlphanumericIdentifierToken("x", 5),
                new Type.CustomType("int", [], 7),
                new Expr.Wildcard(14)) ]]
        ),
        19
    ));
    let patrow_as_label1: string = "val {x as _} = 42;";
    let patrow_as_label2: string = "val {x:int} = 42;";

    //TODO test further as soon as fixed
});

it("pattern - atomic", () => {
    //TODO ? tests already tested via atomic tests
});

it("pattern - constructed value", () => {
    let pattern_cons_val: string = "val x _ = 42;";
    expect(parse(pattern_cons_val)).toEqualWithType(pattern_tester(
        new Expr.FunctionApplication(4,
            new Expr.ValueIdentifier(
                4,
                new Lexer.AlphanumericIdentifierToken("x", 4),
            ),
            new Expr.Wildcard(6))
    , 10))

    let x: Lexer.AlphanumericIdentifierToken = new Lexer.AlphanumericIdentifierToken("x", 7);
    x.opPrefixed = true;
    let pattern_cons_val_with_op: string = "val op x _ = 42;";
    expect(parse(pattern_cons_val_with_op)).toEqualWithType(pattern_tester(
        new Expr.FunctionApplication(4,
            new Expr.ValueIdentifier(
                4,
                x
            ),
            new Expr.Wildcard(9))
    , 13));
});

it("pattern - constructed value (infix)", () => {
    let pattern_infix:string = "infix x; val _ x _ = 42;";
    let pattern: Expr.Expression = new Expr.FunctionApplication(15, new Expr.ValueIdentifier(15, new Lexer.AlphanumericIdentifierToken("x", 15)), new Expr.Tuple(15, [new Expr.Wildcard(13), new Expr.Wildcard(17)]));
    expect(parse(pattern_infix)).toEqualWithType(
        new Decl.SequentialDeclaration(0, [
            create_infix(0, 2),
            new Decl.ValueDeclaration(9, [], [
                new Decl.ValueBinding(13, false, pattern, get42(21))
            ], 3)
        ], 1)
    )
    //TODO tests
});

it("pattern - typed", () => {
    let pattern_type:string = "val x : int = 42;";
    expect(parse(pattern_type)).toEqualWithType(pattern_tester(
        new Expr.TypedExpression(4,
        new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken("x", 4)),
        new Type.CustomType('int', [], 8)
    ), 14));

    let pattern_func_type:string = "val x : int -> int = 42;";
    expect(parse(pattern_func_type)).toEqualWithType(pattern_tester(
        new Expr.TypedExpression(4,
        new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken("x", 4)),
        new Type.FunctionType(
            new Type.CustomType('int', [], 8),
        new Type.CustomType('int', [], 15), 12))
    , 21));

    let double_typed: string = "val x:int:int = 42;";
    expect(parse(double_typed)).toEqualWithType(pattern_tester(
        new Expr.TypedExpression(
            4,
            new Expr.TypedExpression(
                4,
                new Expr.ValueIdentifier(4, new Lexer.AlphanumericIdentifierToken("x", 4)),
                new Type.CustomType('int', [], 6)
            ),
            new Type.CustomType('int', [], 10)
        )
    , 16))

    let list_typed: string = "val []:int = 42;"
    expect(parse(list_typed)).toEqualWithType(pattern_tester(
        new Expr.TypedExpression(
            4,
            new Expr.List(4, []),
            new Type.CustomType('int', [], 7)
        )
    , 13));
});

it("pattern - layered", () => {
    let layered: string = "val x as _ = 42;";
    expect(parse(layered)).toEqualWithType(pattern_tester(
        new Expr.LayeredPattern(
            4,
            new Lexer.AlphanumericIdentifierToken("x", 4),
            undefined,
            new Expr.Wildcard(9)
        ),
        13
    ));
    let x: Lexer.AlphanumericIdentifierToken = new Lexer.AlphanumericIdentifierToken("x", 7);
    x.opPrefixed = true;
    let layered1: string = "val op x as _ = 42;";
    expect(parse(layered1)).toEqualWithType(pattern_tester(
        new Expr.LayeredPattern(
            4,
            x,
            undefined,
            new Expr.Wildcard(12)
        ),
        16
    ));
    let layered2: string = "val x :int as _ = 42;";
    expect(parse(layered2)).toEqualWithType(pattern_tester(
        new Expr.LayeredPattern(
            4,
            new Lexer.AlphanumericIdentifierToken("x", 4),
            new Type.CustomType("int", [], 7),
            new Expr.Wildcard(14)
        ),
        18
    ));
    let layered3: string = "val op x:int as _ = 42;";
    expect(parse(layered3)).toEqualWithType(pattern_tester(
        new Expr.LayeredPattern(
            4,
            x,
            new Type.CustomType("int", [], 9),
            new Expr.Wildcard(16)
        ),
        20
    ));
});

it("type - type variable", () => {
    let testcase_tyvar: string = '42: \'a;';
    let testcase_etyvar: string = '42: \'\'meaningoflive;';

    expect(parse(testcase_tyvar)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.TypeVariable('\'a', true, 4)
        )
    ));
    expect(parse(testcase_etyvar)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.TypeVariable('\'\'meaningoflive', true, 4)
        )
    ));
});

it("type - record type expression", () => {
    let testcase_empty: string = '42: {};';
    let testcase_single: string = '42: { hi : \'int };';
    let testcase_multiple: string = '42: { hello: \'a, world: \'b };';
    let testcase_no_unit: string = '42: ();';
    let testcase_no_same_label: string = '42: { hi: \'a, hi: \'a };';

    expect(parse(testcase_empty)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([]),
                true,
                5
            )
        )
    ));
    expect(parse(testcase_single)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["hi", new Type.TypeVariable('\'int', true, 11)]
                ]),
                true,
                6
            )
        )
    ));
    expect(parse(testcase_multiple)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["hello", new Type.TypeVariable('\'a', true, 13)],
                    ["world", new Type.TypeVariable('\'b', true, 24)]
                ]),
                true,
                6
            )
        )
    ));
    expect(() => { parse(testcase_no_unit); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_no_same_label); }).toThrow(Parser.ParserError);
});

it("type - type construction", () => {
    let testcase_small: string = '42: list;';
    let testcase_single: string = '42: \'a list;';
    let testcase_multiple: string = '42: (\'a * \'b, \'c) list;';

    expect(parse(testcase_small)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.CustomType('list', [], 4)
        )
    ));
    expect(parse(testcase_single)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.CustomType('list', [new Type.TypeVariable('\'a', true, 4)], 4)
        )
    ));
    expect(parse(testcase_multiple)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.CustomType('list', [
                    new Type.TupleType([
                            new Type.TypeVariable('\'a', true, 5),
                            new Type.TypeVariable('\'b', true, 10)
                        ],
                        8
                    ),
                    new Type.TypeVariable('\'c', true, 14),
                ],
                4
            )
        )
    ));
});

it("type - tuple type", () => {
    let testcase_simple: string = '42: \'a * \'b;';
    let testcase_multiple: string = '42: \'a * \'b * \'c;';
    let testcase_bracketed: string = '42: \'a * (\'b * \'c);';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.TupleType([
                    new Type.TypeVariable('\'a', true, 4),
                    new Type.TypeVariable('\'b', true, 9)
                ],
                7
            )
        )
    ));
    expect(parse(testcase_multiple)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.TupleType([
                    new Type.TypeVariable('\'a', true, 4),
                    new Type.TypeVariable('\'b', true, 9),
                    new Type.TypeVariable('\'c', true, 14)
                ],
                7
            )
        )
    ));
    expect(parse(testcase_bracketed)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.TupleType([
                    new Type.TypeVariable('\'a', true, 4),
                    new Type.TupleType([
                            new Type.TypeVariable('\'b', true, 10),
                            new Type.TypeVariable('\'c', true, 15)
                        ],
                        13
                    )
                ],
                7
            )
        )
    ));
});

it("type - function type expression", () => {
    let testcase_simple: string = '42: \'a -> \'b;';
    let testcase_multiple: string = '42: \'a -> \'b -> \'c;';
    let testcase_multiple_bracketed: string = '42: (\'a -> \'b) -> \'c;';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.FunctionType(
                new Type.TypeVariable('\'a', true, 4),
                new Type.TypeVariable('\'b', true, 10),
                7
            )
        )
    ));
    expect(parse(testcase_multiple)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.FunctionType(
                new Type.TypeVariable('\'a', true, 4),
                new Type.FunctionType(
                    new Type.TypeVariable('\'b', true, 10),
                    new Type.TypeVariable('\'c', true, 16),
                    13
                ),
                7
            )
        )
    ));
    expect(parse(testcase_multiple_bracketed)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.FunctionType(
                new Type.FunctionType(
                    new Type.TypeVariable('\'a', true, 5),
                    new Type.TypeVariable('\'b', true, 11),
                    8
                ),
                new Type.TypeVariable('\'c', true, 18),
                15
            )
        )
    ));
});

it("type - bracketed", () => {
    let testcase_simple: string = '42: (\'a);';
    let testcase_multiple_nested: string = '42: ((((\'a -> \'b))));';
    let testcase_nested_complex = '42: ({ hi: (\'a)});';

    expect(parse(testcase_simple)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.TypeVariable('\'a', true, 5)]
        )
    ));
    expect(parse(testcase_multiple_nested)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.FunctionType(
                new Type.TypeVariable('\'a', true, 8),
                new Type.TypeVariable('\'b', true, 14),
                11
            )
        )
    ));
    expect(parse(testcase_nested_complex)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["hi", new Type.TypeVariable('\'a', true, 12)]
                ]),
                true,
                7
            )
        )
    ));
});

it("type row", () => {
    let testcase_alphanum: string = '42: { hi: \'a};';
    let testcase_numeric: string = '42: { 1337: \'a};';
    let testcase_non_alphanum: string = '42: { ### : \'a};';
    let testcase_star: string = '42: { * : \'a};';
    let testcase_zero: string = '42: { 0: \'a};';
    let testcase_reserved_word: string = '42: { val: \'a};';
    let testcase_equals: string = '42: { =: \'a};';
    let testcase_ident: string = '42: { hi: a};';
    let testcase_tyvar: string = '42: { hi: \'a};';
    let testcase_etyvar: string = '42: { hi: \'\'a};';

    expect(parse(testcase_alphanum)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["hi", new Type.TypeVariable('\'a', true, 10)]
                ]),
                true,
                6
            )
        )
    ));
    expect(parse(testcase_numeric)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["1337", new Type.TypeVariable('\'a', true, 12)]
                ]),
                true,
                6
            )
        )
    ));
    expect(parse(testcase_non_alphanum)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["###", new Type.TypeVariable('\'a', true, 12)]
                ]),
                true,
                6
            )
        )
    ));
    expect(parse(testcase_star)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["*", new Type.TypeVariable('\'a', true, 10)]
                ]),
                true,
                6
            )
        )
    ));

    expect(() => { parse(testcase_zero); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_reserved_word); }).toThrow(Parser.ParserError);
    expect(() => { parse(testcase_equals); }).toThrow(Parser.ParserError);

    expect(parse(testcase_ident)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["hi", new Type.CustomType('a', [], 10)]
                ]),
                true,
                6
            )
        )
    ));
    expect(parse(testcase_tyvar)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["hi", new Type.TypeVariable('\'a', true, 10)]
                ]),
                true,
                6
            )
        )
    ));
    expect(parse(testcase_etyvar)).toEqualWithType(createItExpression(
        new Expr.TypedExpression(0,
            get42(0),
            new Type.RecordType(
                new Map([
                    ["hi", new Type.TypeVariable('\'\'a', true, 10)]
                ]),
                true,
                6
            )
        )
    ));
});
