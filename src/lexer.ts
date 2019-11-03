/*
 * TODO: Documentation for the lexer
 */

import { LexerError, InternalInterpreterError, IncompleteError } from './errors';
import { int, char, Token, KeywordToken, WordConstantToken, CharacterConstantToken,
         StringConstantToken, IdentifierToken, AlphanumericIdentifierToken, TypeVariableToken,
         EqualityTypeVariableToken, StarToken, EqualsToken, NumericToken, LongIdentifierToken,
         RealConstantToken, IntegerConstantToken } from './tokens';
import { MAXINT, MININT } from './values';

// TODO: maybe these should be static class members
let reservedWords: Set<string> = new Set<string>([
    'abstype', 'and', 'andalso', 'as', 'case', 'datatype', 'do', 'else', 'end', 'exception', 'fn', 'fun', 'handle',
    'if', 'in', 'infix', 'infixr', 'let', 'local', 'nonfix', 'of', 'op', 'open', 'orelse', 'raise', 'rec', 'then',
    'type', 'val', 'with', 'withtype', 'while',
    '(', ')', '[', ']', '{', '}', ',', ':', ';', '...', '_', '|', '=', '=>', '->', '#',
    'eqtype', 'functor', 'signature', 'struct', 'include', 'sharing', 'structure', 'where', 'sig', ':>'
]);
let symbolicCharacters: Set<string> = new Set<string>([
    '!', '%', '&', '$', '#', '+', '-', '/', ':', '<', '=', '>', '?', '@', '\\', '~', '`', '^', '|', '*'
]);

class Lexer {
    position: number = 0;
    tokenStart: number;

    // TODO proper support for >= 256 chars
    static isAlphanumeric(c: char): boolean {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '\'' || c === '_';
    }

    static isSymbolic(c: char): boolean {
        return symbolicCharacters.has(c);
    }

    static isWhitespace(c: char): boolean {
        return c === ' ' || c === '\t' || c === '\n' || c === '\f';
    }

    static isNumber(c: char, hexadecimal: boolean): boolean {
        return (c >= '0' && c <= '9') || (hexadecimal && ((c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')));
    }

    constructor(private input: string, private options: { [name: string]: any }) {
        this.skipWhitespaceAndComments();
    }

    consumeChar(errorMessageOnEOF: string = ''): char {
        if (this.position >= this.input.length) {
            throw new IncompleteError(errorMessageOnEOF);
        }
        ++this.position;
        return this.input.charAt(this.position - 1);
    }

    getChar(offset: number = 0): char {
        if (this.position + offset >= this.input.length) {
            // This must be any character that has no syntactic meaning in SML. It may not be counted as whitespace.
            return '\x04'; // End of Transmission character
        } else {
            return this.input.charAt(this.position + offset);
        }
    }

    skipWhitespace(): void {
        while (Lexer.isWhitespace(this.getChar())) {
            ++this.position;
        }
    }

    skipWhitespaceAndComments(): void {
        let oldnumber: number;
        do {
            oldnumber = this.position;

            this.skipWhitespace();

            while (this.position + 1 < this.input.length && this.input.substr(this.position, 2) === '(*') {
                this.position += 2;
                let openComments: number = 1;

                while (openComments > 0) {
                    if (this.position > this.input.length - 2) {
                        throw new IncompleteError('unclosed comment');
                    }

                    let s: string = this.input.substr(this.position, 2);
                    if (s === '(*') {
                        ++openComments;
                        ++this.position;
                    } else if (s === '*)') {
                        --openComments;
                        ++this.position;
                    }

                    ++this.position;
                }
            }
        } while (this.position !== oldnumber);
        this.tokenStart = this.position;
    }

    /* Reads a sequence of digits. Sign, exponent etc. are handled by lexNumber. Accepts leading zeros.
     */
    readNumeric(hexadecimal: boolean, maxLength: number = -1): string {
        let result: string = '';
        while (Lexer.isNumber(this.getChar(), hexadecimal) && result.length !== maxLength) {
            result += this.consumeChar();
        }
        return result;
    }

    makeNumberToken(value: string, real: boolean = false, word: boolean = false, hexadecimal: boolean = false): Token {
        if (real && word) {
            throw new InternalInterpreterError('(...)');
        }
        let token: string = this.input.substring(this.tokenStart, this.position);
        if (real) {
            return new RealConstantToken(token, parseFloat(value));
        }
        let v: int = parseInt(value, hexadecimal ? 16 : 10);
        if (v > MAXINT) {
            throw new LexerError('"' + v + '", whoa, it\'s over "' + MAXINT + '".');
        } else if (v < MININT) {
            throw new LexerError('"' + v + '", whoa, it\'s ounder "' + MININT + '".');
        }
        if (word) {
            return new WordConstantToken(token, v);
        } else {
            let firstChar = token.charAt(0);
            if (Lexer.isNumber(firstChar, false) && firstChar !== '0') {
                // firstChar !== 0 also implies that the number is not hexadecimal
                return new NumericToken(token, v);
            } else {
                return new IntegerConstantToken(token, v);
            }
        }
    }

    lexNumber(): Token {
        let value: string = '';
        let hexadecimal: boolean = false;
        let word: boolean = false;
        let real: boolean = false;
        let negative: boolean = false;

        if (this.getChar() === '~') {
            ++this.position;
            negative = true;
            value += '-';
        }

        if (this.getChar() === '0' && (this.getChar(1) === 'w' || this.getChar(1) === 'x')) {
            ++this.position;
            if (this.getChar() === 'w') {
                word = true;
            }
            if (this.getChar(word ? 1 : 0) === 'x') {
                hexadecimal = true;
            }
            let nextDigitOffset = (word && hexadecimal) ? 2 : 1;
            if ((negative && word) || !Lexer.isNumber(this.getChar(nextDigitOffset), hexadecimal)) {
                // The 'w' or 'x' is not part of the number
                value += '0';
                return this.makeNumberToken(value, false,  false, false);
            }
            this.position += nextDigitOffset;
        }

        value += this.readNumeric(hexadecimal);
        if (hexadecimal || word) {
            return this.makeNumberToken(value, false, word, hexadecimal);
        }

        if (this.getChar() === '.') {
            if (Lexer.isNumber(this.getChar(1), false)) {
                value += this.consumeChar();
                value += this.readNumeric(false);
            } else {
                return this.makeNumberToken(value);
            }
            real = true;
        }

        if (this.getChar() === 'e' || this.getChar() === 'E') {
            if (Lexer.isNumber(this.getChar(1), false)) {
                value += 'e';
                ++this.position;
                value += this.readNumeric(false);
            } else if (this.getChar(1) === '~' && Lexer.isNumber(this.getChar(2), false)) {
                value += 'e-';
                this.position += 2;
                value += this.readNumeric(false);
            } else {
                return this.makeNumberToken(value, real);
            }
            real = true;
        }

        return this.makeNumberToken(value, real);
    }

    lexString(): StringConstantToken {
        let startnumber: number = this.position;
        if (this.consumeChar() !== '"') {
            throw new InternalInterpreterError('(...)');
        }
        let value: string = '';

        while (this.getChar() !== '"') {
            if (this.getChar() === '\\') {
                ++this.position;
                if (Lexer.isWhitespace(this.getChar())) {
                   this.skipWhitespace();
                   if (this.consumeChar('unterminated whitespace escape sequence') !== '\\') {
                       throw new LexerError(
                           'Found non-whitespace character in whitespace escape sequence.');
                   }
                } else {
                    let c: char = this.consumeChar();
                    switch (c) {
                        case 'a': value += '\x07'; break;
                        case 'b': value += '\b'; break;
                        case 't': value += '\t'; break;
                        case 'n': value += '\n'; break;
                        case 'v': value += '\v'; break;
                        case 'f': value += '\f'; break;
                        case 'r': value += '\r'; break;
                        case '"': value += '"'; break;
                        case '\\': value += '\\'; break;
                        case '^': {
                            let cc: number = this.consumeChar().charCodeAt(0);
                            if (cc < 64 || cc > 95) {
                                throw new LexerError('"' + String.fromCharCode(cc) +
                                    '" does not represent a valid control character.');
                            }
                            value += String.fromCharCode(cc - 64);
                            break;
                        }
                        case 'u': {
                            let s: string = this.readNumeric(true, 4);
                            if (s.length !== 4) {
                                throw new LexerError(
                                    'A Unicode escape sequence must consist of four digits.');
                            }
                            let v: number = parseInt(s, 16);
                            if (v >= 256 && !this.options.allowUnicodeInStrings) {
                                throw new LexerError(
                                    'The character code "' + s + '" is too large,'
                                    + ' only values between 00 and ff are allowed.');
                            }
                            value += String.fromCharCode(v);
                            break;
                        }
                        default: {
                            if (!Lexer.isNumber(c, false)) {
                                throw new LexerError('Invalid escape sequence.');
                            }
                            --this.position; // 'un-consume' the first character of the number
                            let s: string = this.readNumeric(false, 3);
                            if (s.length !== 3) {
                                throw new LexerError(
                                    'A numeric escape sequence must consist of three digits.');
                            }
                            let v: number = parseInt(s, 10);
                            if (v >= 256 && !this.options.allowUnicodeInStrings) {
                                throw new LexerError(
                                    'The character code "' + s + '" is too large,'
                                    + ' only values between 000 and 255 are allowed.');
                            }
                            value += String.fromCharCode(v);
                            break;
                        }
                    }
                }

            } else {
                let c: number = this.consumeChar('unterminated string').charCodeAt(0);
                // Only printable characters (33 to 126) and spaces are allowed (SML definition, chapter 2.2)
                // We however also allow all non-ASCII characters (>128), since MosML and SML/NJ seem to do so as well.
                if ((c < 33 || c > 126) && c !== 32 /*space*/ && c < 128) {
                    // invalid characters are not printable, so we should print its code
                    // rather than the character
                    let info = '';
                    if (c === 9) {
                        info = ' (tab)';
                    }
                    if (c === 10) {
                        info = ' (newline)';
                    }
                    if (c === 13) {
                        info = ' (carriage return)';
                    }
                    throw new LexerError(
                        'A string may not contain the character <' + c + '>' + info + '.');
                }
                value += String.fromCharCode(c);
            }
        }

        if (this.consumeChar() !== '"') {
            throw new InternalInterpreterError('(...)');
        }
        return new StringConstantToken(this.input.substring(startnumber, this.position), value);
    }

    lexCharacter(): CharacterConstantToken {
        if (this.consumeChar() !== '#') {
            throw new InternalInterpreterError('(...)');
        }
        let t: StringConstantToken = this.lexString();
        if (t.value.length !== 1) {
            throw new LexerError(
                'A character constant must have length 1, not ' + t.value.length + '.');
        }
        return new CharacterConstantToken('#' + t.text, t.value);
    }

    lexIdentifierOrKeyword(): Token {
        // Both identifiers and keywords can be either symbolic (consisting only of the characters
        // ! % & $ # + - / : < = > ? @ \ ~ ‘ ^ | *
        // or alphanumeric (consisting only of letters, digits, ' or _).
        // We first need to figure out which of these types the token belongs to, then find the longest possible token
        // of that type at this position and lastly check whether it is a reserved word.

        let token: string = '';

        let charChecker: (c: char) => boolean;
        let firstChar: char = this.getChar();
        if (Lexer.isSymbolic(firstChar)) {
            charChecker = Lexer.isSymbolic;
        } else if (Lexer.isAlphanumeric(firstChar) && !Lexer.isNumber(firstChar, false) && firstChar !== '_') {
            // alphanumeric identifiers may not start with a number
            charChecker = Lexer.isAlphanumeric;
        } else if (reservedWords.has(firstChar)) {
            return new KeywordToken(this.consumeChar());
        } else if (firstChar === '.' && this.getChar(1) === '.' && this.getChar(2) === '.') {
            this.position += 3;
            return new KeywordToken('...');
        } else {
            throw new LexerError('Invalid token "' + firstChar + '" (\\u'
                                 + firstChar.charCodeAt(0).toString(16).toUpperCase() + ').');
        }

        do {
            token += this.consumeChar();
        } while (charChecker(this.getChar()));

        if (token === '*') {
            return new StarToken();
        } else if (token === '=') {
            return new EqualsToken();
        } else if (reservedWords.has(token)) {
            return new KeywordToken(token);
        } else if (firstChar === '\'') {
            if (token.charAt(1) === '\'' ) {
                if (token.length === 2) {
                    throw new LexerError('Invalid type variable "' + token + '". Delete Her.');
                } else {
                    return new EqualityTypeVariableToken(token);
                }
            } else {
                if (token.length >= 2) {
                    return new TypeVariableToken(token);
                } else {
                    throw new LexerError('The noise, it won\'t STOP: Invalid type variable "'
                                         + token + '".');
                }
            }
        } else if (Lexer.isAlphanumeric(firstChar)) {
            return new AlphanumericIdentifierToken(token);
        } else {
            return new IdentifierToken(token);
        }
    }

    lexLongIdentifierOrKeyword(): Token {
        let tokenStart = this.tokenStart;
        let t: Token = this.lexIdentifierOrKeyword();

        if (this.getChar() === '.') {
            // Check for "..."
            if (this.getChar(1) === '.' && this.getChar(2) === '.') {
                return t;
            }
        }
        if (this.getChar() !== '.') {
            return t;
        }

        let qualifiers: AlphanumericIdentifierToken[] = [];
        do {
            this.consumeChar();
            if (!(t instanceof AlphanumericIdentifierToken)) {
                throw new LexerError('Expected structure name before ".".');
            }
            qualifiers.push(t);
            this.tokenStart = this.position;
            t = this.lexIdentifierOrKeyword();
        } while (this.getChar() === '.');

        // Only value identifiers, type constructors and structure identifiers are allowed here.
        // EqualsToken is not allowed because it cannot be re-bound.
        if ((!(t instanceof IdentifierToken || t instanceof StarToken)) || t instanceof TypeVariableToken) {
            throw new LexerError('"' + t.text + '" is not allowed in a long identifier.');
        }
        return new LongIdentifierToken(this.input.substring(tokenStart, this.position),  qualifiers, t);
    }

    nextToken(): Token {
        let token: Token;
        this.tokenStart = this.position;
        if (Lexer.isNumber(this.getChar(), false)
            || (this.getChar() === '~' && Lexer.isNumber(this.getChar(1), false))) {
            token = this.lexNumber();
        } else if (this.getChar() === '"') {
            token = this.lexString();
        } else if (this.getChar() === '#' && this.getChar(1) === '"') {
            token = this.lexCharacter();
        } else {
            token = this.lexLongIdentifierOrKeyword();
        }
        this.skipWhitespaceAndComments();
        return token;
    }

    finished(): boolean {
        return this.position >= this.input.length;
    }
}

export function lex(s: string, options: { [name: string]: any }): Token[] {
    let l: Lexer = new Lexer(s, options);
    let result: Token[] = [];
    while (!l.finished()) {
        result.push(l.nextToken());
    }
    return result;
}
