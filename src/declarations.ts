import { Expression, ValueIdentifier, CaseAnalysis, Lambda, Match,
         Pattern, TypedExpression, Tuple, PatternExpression } from './expressions';
import { IdentifierToken, Token } from './lexer';
import { Type, TypeVariable, FunctionType, CustomType } from './types';
import { State, RebindStatus } from './state';
import { InternalInterpreterError, Position, ElaborationError,
         EvaluationError, FeatureDisabledError } from './errors';
import { Value, ValueConstructor, ExceptionConstructor, ExceptionValue,
         FunctionValue } from './values';

export abstract class Declaration {
    id: number;
    elaborate(state: State): State {
        throw new InternalInterpreterError( -1, 'Not yet implemented.');
    }

    // Returns [computed state, has Error occured, Exception]
    evaluate(state: State): [State, boolean, Value|undefined] {
        throw new InternalInterpreterError( -1, 'Not yet implemented.');
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        throw new InternalInterpreterError( -1, 'Not yet implemented.');
    }

    simplify(): Declaration {
        throw new InternalInterpreterError( -1, 'Not yet implemented.');
    }
}

// Declaration subclasses
export class ValueDeclaration extends Declaration {
// val typeVariableSequence valueBinding
    constructor(public position: Position, public typeVariableSequence: TypeVariable[],
                public valueBinding: ValueBinding[], public id: number = 0) {
        super();
    }

    simplify(): ValueDeclaration {
        let valBnd: ValueBinding[] = [];
        for (let i = 0; i < this.valueBinding.length; ++i) {
            valBnd.push(new ValueBinding(this.valueBinding[i].position,
                                         this.valueBinding[i].isRecursive,
                                         this.valueBinding[i].pattern.simplify(),
                                         this.valueBinding[i].expression.simplify()));
        }
        return new ValueDeclaration(this.position, this.typeVariableSequence, valBnd, this.id);
    }

    elaborate(state: State): State {
        // TODO
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        let result: [string, Value][] = [];
        let recursives: [string, Value][] = [];

        let isRec = false;
        for (let i = 0; i < this.valueBinding.length; ++i) {
            if (this.valueBinding[i].isRecursive) {
                isRec = true;
            }
            let val = this.valueBinding[i].compute(state);
            if (val[1] !== undefined) {
                return [state, true, val[1]];
            }
            if (val[0] === undefined) {
                return [state, true, new ExceptionValue('Bind')];
            }

            for (let j = 0; j < (<[string, Value][]> val[0]).length; ++j) {
                if (!isRec) {
                    result.push((<[string, Value][]> val[0])[j]);
                } else {
                    recursives.push((<[string, Value][]> val[0])[j]);
                }
            }
        }

        for (let j = 0; j < result.length; ++j) {
            state.setDynamicValue(result[j][0], result[j][1]);
        }

        for (let j = 0; j < recursives.length; ++j) {
            if (recursives[j][1] instanceof FunctionValue) {
                state.setDynamicValue(recursives[j][0], new FunctionValue(
                    (<FunctionValue> recursives[j][1]).state, recursives,
                    (<FunctionValue> recursives[j][1]).body));
            } else {
                state.setDynamicValue(recursives[j][0], recursives[j][1]);
            }
        }

        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        // TODO
        let res = 'val <stuff>';
        for (let i = 0; i < this.valueBinding.length; ++i) {
            if (i > 0) {
                res += ' and';
            }
            res += ' ' + this.valueBinding[i].prettyPrint(indentation, oneLine);
        }
        return res += ';';
    }
}

export class TypeDeclaration extends Declaration {
// type typeBinding
    constructor(public position: Position, public typeBinding: TypeBinding[], public id: number = 0) {
        super();
    }

    simplify(): TypeDeclaration {
        let bnds: TypeBinding[] = [];
        for (let i = 0; i < this.typeBinding.length; ++i) {
            bnds.push(new TypeBinding(this.typeBinding[i].position,
                                      this.typeBinding[i].typeVariableSequence,
                                      this.typeBinding[i].name,
                                      this.typeBinding[i].type.simplify()));
        }
        return new TypeDeclaration(this.position, bnds, this.id);
    }

    elaborate(state: State): State {
        for (let i = 0; i < this.typeBinding.length; ++i) {
            // TODO
            // Make tyvars from seq as unfree
            // instantiate
            // return all resulting types without free type vars
        }

        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        for (let i = 0; i < this.typeBinding.length; ++i) {
            state.setDynamicType(this.typeBinding[i].name.getText(), []);
        }
        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        // TODO
        let res = 'type';
        for (let i = 0; i < this.typeBinding.length; ++i) {
            if (i > 0) {
                res += ' and';
            }
            res += ' <stuff> ' + this.typeBinding[i].name.getText();
            res += ' = ' + this.typeBinding[i].type.prettyPrint();
        }
        return res + ';';
    }
}

export class DatatypeDeclaration extends Declaration {
// datatype datatypeBinding <withtype typeBinding>
    constructor(public position: Position, public datatypeBinding: DatatypeBinding[],
                public typeBinding: (TypeBinding[]) | undefined, public id: number = 0) {
        super();

        if (this.typeBinding !== undefined) {
            throw new FeatureDisabledError(this.position, 'Don\'t use "withtype". It is evil.');
        }
    }

    simplify(): Declaration {
        let datbnd: DatatypeBinding[] = [];

        for (let i = 0; i < this.datatypeBinding.length; ++i) {
            let ntype: [IdentifierToken, Type|undefined][] = [];
            for (let j = 0; j < this.datatypeBinding[i].type.length; ++j) {
                if (this.datatypeBinding[i].type[j][1] !== undefined) {
                    ntype.push([this.datatypeBinding[i].type[j][0],
                               (<Type> this.datatypeBinding[i].type[j][1]).simplify()]);
                } else {
                    ntype.push(this.datatypeBinding[i].type[j]);
                }
            }
            datbnd.push(new DatatypeBinding(this.datatypeBinding[i].position,
                this.datatypeBinding[i].typeVariableSequence,
                this.datatypeBinding[i].name,
                ntype));
        }

        // TODO Correctly implement the withtype ~> type transition or clean up this mess
        /*
        if (this.typeBinding) {
            return new SequentialDeclaration(this.position, [
                new DatatypeDeclaration(this.position, datbnd, undefined),
                new TypeDeclaration(this.position, this.typeBinding).simplify()]);
        } else { */
        return new DatatypeDeclaration(this.position, datbnd, undefined, this.id);
        /* } */
    }

    elaborate(state: State): State {
        // TODO
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        // I'm assuming the withtype is empty
        for (let i = 0; i < this.datatypeBinding.length; ++i) {
            let res = this.datatypeBinding[i].compute(state);

            for (let j = 0; j < res[0].length; ++j) {
                if (state.getRebindStatus(res[0][j][0]) === RebindStatus.Never) {
                    throw new EvaluationError(this.position, 'You simply cannot rebind "'
                        + res[0][j][0] + '".');
                }
                state.setDynamicValue(res[0][j][0], res[0][j][1]);
            }
            // TODO id
            state.setDynamicType(res[1][0], res[1][1]);
        }
        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = 'datatype';
        for (let i = 0; i < this.datatypeBinding.length; ++i) {
            if (i > 0) {
                res += ' and';
            }
            // TODO Replace <stuff> with something proper
            res += ' <stuff> ' + this.datatypeBinding[i].name.getText() + ' =';
            for (let j = 0; j < this.datatypeBinding[i].type.length; ++j) {
                if (j > 0) {
                    res += ' | ';
                }
                res += ' ' + this.datatypeBinding[i].type[j][0].getText();
                if (this.datatypeBinding[i].type[j][1] !== undefined) {
                    res += ' of ' + (<Type> this.datatypeBinding[i].type[j][1]).prettyPrint();
                }
            }
        }
        return res;
    }
}

export class DatatypeReplication extends Declaration {
// datatype name = datatype oldname
    constructor(public position: Position, public name: IdentifierToken,
                public oldname: Token, public id: number = 0) {
        super();
    }

    simplify(): DatatypeReplication {
        return this;
    }

    elaborate(state: State): State {
        let res = state.getStaticType(this.oldname.getText());
        if (res === undefined) {
            throw new ElaborationError(this.position,
                'The datatype "' + this.oldname.getText() + '" doesn\'t exist.');
        }
        state.setStaticType(this.name.getText(), res.type, res.constructors);
        return state;
   }

    evaluate(state: State): [State, boolean, Value|undefined] {
        let res = state.getDynamicType(this.oldname.getText());
        if (res === undefined) {
            throw new EvaluationError(this.position,
                'The datatype "' + this.oldname.getText() + '" doesn\'t exist.');
        }
        state.setDynamicType(this.name.getText(), res);
        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        return 'datatype ' + this.name.getText() + ' = datatype ' + this.oldname.getText() + ';';
    }
}

export class AbstypeDeclaration extends Declaration {
// abstype datatypeBinding <withtype typeBinding> with declaration end
    constructor(public position: Position, public datatypeBinding: DatatypeBinding[],
                public typeBinding: (TypeBinding[]) | undefined, public declaration: Declaration,
                public id: number = 0) {
        super();

        if (this.typeBinding !== undefined) {
            throw new FeatureDisabledError(this.position, 'Don\'t use "withtype". It is evil.');
        }
    }

    simplify(): AbstypeDeclaration {
        let datbnd: DatatypeBinding[] = [];

        for (let i = 0; i < this.datatypeBinding.length; ++i) {
            let ntype: [IdentifierToken, Type|undefined][] = [];
            for (let j = 0; j < this.datatypeBinding[i].type.length; ++j) {
                if (this.datatypeBinding[i].type[j][1] !== undefined) {
                    ntype.push([this.datatypeBinding[i].type[j][0],
                               (<Type> this.datatypeBinding[i].type[j][1]).simplify()]);
                } else {
                    ntype.push(this.datatypeBinding[i].type[j]);
                }
            }
            datbnd.push(new DatatypeBinding(this.datatypeBinding[i].position,
                this.datatypeBinding[i].typeVariableSequence,
                this.datatypeBinding[i].name,
                ntype));
        }

        // TODO Correctly implement the withtype ~> type transition or clean up this mess
        /* if (this.typeBinding) {
            return new AbstypeDeclaration(this.position, datbnd, undefined,
                new SequentialDeclaration(this.position, [
                    new TypeDeclaration(this.position, this.typeBinding).simplify(),
                    this.declaration.simplify()]));
        } else { */
        return new AbstypeDeclaration(this.position, datbnd, this.typeBinding,
            this.declaration.simplify(), this.id);
        /* } */

    }

    elaborate(state: State): State {
        // TODO
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        // I'm assuming the withtype is empty
        for (let i = 0; i < this.datatypeBinding.length; ++i) {
            let res = this.datatypeBinding[i].compute(state);

            for (let j = 0; j < res[0].length; ++j) {
                state.setDynamicValue(res[0][j][0], res[0][j][1]);
            }
        }
        return this.declaration.evaluate(state);
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        // TODO
        throw new InternalInterpreterError( -1, 'Not yet implemented.');
    }
}

export class ExceptionDeclaration extends Declaration {
    constructor(public position: Position, public bindings: ExceptionBinding[],
                public id: number = 0) {
        super();
    }

    simplify(): ExceptionDeclaration {
        return this;
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        // TODO
        throw new InternalInterpreterError(-1, 'Not yet implemented.');
    }

    elaborate(state: State): State {
        for (let i = 0; i < this.bindings.length; ++i) {
            state = this.bindings[i].elaborate(state);
        }
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        for (let i = 0; i < this.bindings.length; ++i) {
            let res = this.bindings[i].evaluate(state);
            if (res[1]) {
                return res;
            }
            state = res[0];
        }
        return [state, false, undefined];
    }
}

export class LocalDeclaration extends Declaration {
// local declaration in body end
    constructor(public position: Position, public declaration: Declaration,
                public body: Declaration, public id: number = 0) {
        super();
    }

    simplify(): LocalDeclaration {
        return new LocalDeclaration(this.position, this.declaration.simplify(), this.body.simplify(), this.id);
    }

    elaborate(state: State): State {
        let nstate = state.getNestedState(false, state.id);
        nstate = this.declaration.elaborate(nstate).getNestedState(false, state.id);
        nstate = this.body.elaborate(nstate);
        // Forget all local definitions
        nstate.parent = state;
        return nstate;
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        let nstate = state.getNestedState(false, state.id);
        let res = this.declaration.evaluate(nstate);
        if (res[1]) {
            // Something came flying in our direction. So hide we were here and let it flow.
            return [state, true, res[2]];
        }
        nstate = res[0].getNestedState(false, state.id);
        res = this.body.evaluate(nstate);

        // Forget all local definitions
        res[0].parent = state;
        return res;
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = 'local ' + this.declaration.prettyPrint(indentation, oneLine);
        res += ' in ' + this.body.prettyPrint(indentation, oneLine);
        res += ' end;';
        return res;
    }
}

export class OpenDeclaration extends Declaration {
// open name_1 ... name_n
    constructor(public position: Position, public names: Token[], public id: number = 0) {
        super();
    }

    simplify(): OpenDeclaration {
        return this;
    }

    elaborate(state: State): State {
        // TODO Yeah, if we had structs, we could actually implement this
        throw new InternalInterpreterError(-1,
            'Yeah, you better wait a little before trying this again.');
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        // TODO Yeah, if we had structs, we could actually implement this
        throw new InternalInterpreterError(-1,
            'Yeah, you better wait a little before trying this again.');
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = 'open';
        for (let i = 0; i < this.names.length; ++i) {
            res += ' ' + this.names[i].getText();
        }
        return res + ';';
    }
}

export class EmptyDeclaration extends Declaration {
// exactly what it says on the tin.
    constructor(public id: number = 0) {
        super();
    }

    simplify(): EmptyDeclaration {
        return this;
    }

    elaborate(state: State): State {
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined]  {
        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        return ' ;';
    }
}

export class SequentialDeclaration extends Declaration {
// declaration1 <;> declaration2
    constructor(public position: Position, public declarations: Declaration[], public id: number = 0) {
        super();
    }

    simplify(): SequentialDeclaration {
        let decls: Declaration[] = [];
        for (let i = 0; i < this.declarations.length; ++i) {
            decls.push(this.declarations[i].simplify());
        }
        return new SequentialDeclaration(this.position, decls, this.id);
    }

    elaborate(state: State): State {
        for (let i = 0; i < this.declarations.length; ++i) {
            state = this.declarations[i].elaborate(state.getNestedState(false, this.declarations[i].id));
        }
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        for (let i = 0; i < this.declarations.length; ++i) {
            let nstate = state.getNestedState(true, this.declarations[i].id);
            let res = this.declarations[i].evaluate(nstate);
            if (res[1]) {
                // Something blew up, so let someone else handle the mess
                return res;
            }
            state = res[0];
        }
        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = '';
        for (let i = 0; i < this.declarations.length; ++i) {
            if (i > 0) {
                res += ' ';
            }
            res += this.declarations[i].prettyPrint(indentation, oneLine);
        }
        return res;
    }
}

// Derived Forms and semantically irrelevant stuff

export class FunctionDeclaration extends Declaration {
// fun typeVariableSequence functionValueBinding
    constructor(public position: Position, public typeVariableSequence: TypeVariable[],
                public functionValueBinding: FunctionValueBinding[], public id: number = 0) {
        super();
    }

    simplify(): ValueDeclaration {
        let valbnd: ValueBinding[] = [];
        for (let i = 0; i < this.functionValueBinding.length; ++i) {
            valbnd.push(this.functionValueBinding[i].simplify());
        }
        return new ValueDeclaration(this.position, this.typeVariableSequence, valbnd, this.id);
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        // TODO
        let res = 'fun <stuff>';
        for (let i = 0; i < this.functionValueBinding.length; ++i) {
            if (i > 0) {
                res += ' and';
            }
            res += ' ' + this.functionValueBinding[i].prettyPrint(indentation, oneLine);
        }
        return res + ';';
    }
}

export class InfixDeclaration extends Declaration {
// infix <d> vid1 .. vidn
    constructor(public position: Position, public operators: IdentifierToken[],
                public precedence: number = 0, public id: number = 0) {
        super();
    }

    simplify(): InfixDeclaration {
        return this;
    }

    elaborate(state: State): State {
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined]  {
        for (let i = 0; i < this.operators.length; ++i) {
            state.setInfixStatus(this.operators[i], this.precedence, false, true);
        }
        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = 'infix';
        res += ' ' + this.precedence;
        for (let i = 0; i < this.operators.length; ++i) {
            res += ' ' + this.operators[i].getText();
        }
        return res + ';';
    }
}

export class InfixRDeclaration extends Declaration {
// infixr <d> vid1 .. vidn
    constructor(public position: Position, public operators: IdentifierToken[],
                public precedence: number = 0, public id: number = 0) {
        super();
    }

    simplify(): InfixRDeclaration {
        return this;
    }

    elaborate(state: State): State {
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined]  {
        for (let i = 0; i < this.operators.length; ++i) {
            state.setInfixStatus(this.operators[i], this.precedence, true, true);
        }
        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = 'infixr';
        res += ' ' + this.precedence;
        for (let i = 0; i < this.operators.length; ++i) {
            res += ' ' + this.operators[i].getText();
        }
        return res + ';';
    }
}

export class NonfixDeclaration extends Declaration {
// nonfix <d> vid1 .. vidn
    constructor(public position: Position, public operators: IdentifierToken[],
                public id: number = 0) {
        super();
    }

    simplify(): NonfixDeclaration {
        return this;
    }

    elaborate(state: State): State {
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined]  {
        for (let i = 0; i < this.operators.length; ++i) {
            state.setInfixStatus(this.operators[i], 0, false, false);
        }
        return [state, false, undefined];
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = 'nonfix';
        for (let i = 0; i < this.operators.length; ++i) {
            res += ' ' + this.operators[i].getText();
        }
        return res + ';';
    }
}

// Value Bundings

export class ValueBinding {
// <rec> pattern = expression
    constructor(public position: Position, public isRecursive: boolean,
                public pattern: Pattern, public expression: Expression) {
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = '';
        if (this.isRecursive) {
            res += 'rec ';
        }
        res += this.pattern.prettyPrint(indentation, oneLine);
        res += ' = ';
        return res + this.expression.prettyPrint(indentation, oneLine);
    }

    // Returns [ VE | undef, Excep | undef]
    compute(state: State): [[string, Value][] | undefined, Value | undefined] {
        let v = this.expression.compute(state);
        if (v[1]) {
            return [undefined, v[0]];
        }
        return [this.pattern.matches(state, v[0]), undefined];
    }
}

export class FunctionValueBinding {
    constructor(public position: Position,
                public parameters: [PatternExpression[], Type|undefined, Expression][],
                public name: ValueIdentifier) {
    }

    simplify(): ValueBinding {
        if (this.name === undefined) {
            throw new InternalInterpreterError(this.position,
                'This function isn\'t ready to be simplified yet.');
        }

        // Build the case analysis, starting with the (vid1,...,vidn)
        let arr: ValueIdentifier[] = [];
        let matches: [PatternExpression, Expression][] = [];
        for (let i = 0; i < this.parameters[0][0].length; ++i) {
            arr.push(new ValueIdentifier(-1, new IdentifierToken('__arg' + i, -1)));
        }
        for (let i = 0; i < this.parameters.length; ++i) {
            let pat2: PatternExpression;
            if (this.parameters[i][0].length === 1) {
                pat2 = this.parameters[i][0][0];
            } else {
                pat2 = new Tuple(-1, this.parameters[i][0]);
            }

            if (this.parameters[i][1] === undefined) {
                matches.push([pat2, this.parameters[i][2]]);
            } else {
                matches.push([pat2,
                    new TypedExpression(-1, this.parameters[i][2], <Type> this.parameters[i][1])]);
            }
        }
        let pat: PatternExpression;
        if (arr.length !== 1) {
            pat = new Tuple(-1, arr).simplify();
        } else {
            pat = arr[0];
        }
        let mat = new Match(-1, matches);
        let exp: Expression;
        //        if (arr.length === 1) {
        //    exp = new Lambda(-1, mat);
        // } else {
        exp = new CaseAnalysis(-1, pat, mat);

        // Now build the lambdas around
        for (let i = this.parameters[0][0].length - 1; i >= 0; --i) {
            exp = new Lambda(-1, new Match(-1, [[
                new ValueIdentifier(-1, new IdentifierToken('__arg' + i, -1)),
                exp]]));
        }
        // }

        return new ValueBinding(this.position, true, this.name, exp.simplify());
    }

    prettyPrint(indentation: number, oneLine: boolean): string {
        let res = '';
        for (let i = 0; i < this.parameters.length; ++i) {
            if (i > 0) {
                res += ' | ';
            }
            res += this.name.name.getText();
            for (let j = 0; j < this.parameters[i][0].length; ++j) {
                res += ' ' + this.parameters[i][0][j].prettyPrint(indentation, oneLine);
            }
            if (this.parameters[i][1] !== undefined) {
                res += ': ' + (<Type> this.parameters[i][1]).prettyPrint();
            }
            res += ' = ' + this.parameters[i][2].prettyPrint(indentation, oneLine);
        }
        return res;
    }
}

// Type Bindings

export class TypeBinding {
// typeVariableSequence name = type
    constructor(public position: Position, public typeVariableSequence: TypeVariable[],
                public name: IdentifierToken, public type: Type) {
    }
}

// Datatype Bindings

export class DatatypeBinding {
// typeVariableSequence name = <op> constructor <of type>
    // type: [constructorName, <type>]
    constructor(public position: Position, public typeVariableSequence: TypeVariable[],
                public name: IdentifierToken, public type: [IdentifierToken, Type | undefined][]) {
    }

    compute(state: State): [[string, Value][], [string, string[]]] {
        let connames: string[] = [];
        let ve: [string, Value][] = [];
        for (let i = 0; i < this.type.length; ++i) {
            let numArg: number = 0;
            if (this.type[i][1] !== undefined) {
                numArg = 1;
            }
            let id = state.getValueIdentifierId(this.type[i][0].getText());
            state.incrementValueIdentifierId(this.type[i][0].getText());
            ve.push([this.type[i][0].getText(), new ValueConstructor(this.type[i][0].getText(), numArg, id)]);
            connames.push(this.type[i][0].getText());
        }
        return [ve, [this.name.getText(), connames]];
    }
}

// Exception Bindings

export interface ExceptionBinding {
    evaluate(state: State): [State, boolean, Value|undefined];
    elaborate(state: State): State;
}

export class DirectExceptionBinding implements ExceptionBinding {
// <op> name <of type>
    constructor(public position: Position,
                public name: IdentifierToken,
                public type: Type | undefined) {
    }

    elaborate(state: State): State {
        if (this.type !== undefined) {
            let tyvars: TypeVariable[] = [];
            this.type.getTypeVariables(true).forEach((val: TypeVariable) => {
                if (val.kill() instanceof TypeVariable) {
                    tyvars.push(val);
                }
            });
            if (tyvars.length > 0) {
                throw ElaborationError.getUnguarded(this.position, tyvars);
            }

            state.setStaticValue(this.name.getText(),
                new FunctionType(this.type.simplify(), new CustomType('exn')));
        } else {
            state.setStaticValue(this.name.getText(), new CustomType('exn'));
        }
        return state;
    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        let numArg = 0;
        if (this.type !== undefined) {
            numArg = 1;
        }
        let id = state.getValueIdentifierId(this.name.getText());
        state.incrementValueIdentifierId(this.name.getText());

        if (state.getRebindStatus(this.name.getText()) === RebindStatus.Never) {
            throw new EvaluationError(this.position, 'You simply cannot rebind "'
                + this.name.getText() + '".');
        }

        state.setDynamicValue(this.name.getText(),
            new ExceptionConstructor(this.name.getText(), numArg, id));
        return [state, false, undefined];
    }
}

export class ExceptionAlias implements ExceptionBinding {
// <op> name = <op> oldname
    constructor(public position: Position, public name: IdentifierToken, public oldname: Token) {
    }

    elaborate(state: State): State {
        let res = state.getStaticValue(this.oldname.getText());
        if (res === undefined) {
            throw new ElaborationError(this.position, 'Unbound value identifier "'
                + this.oldname.getText() + '".');
        }
        state.setStaticValue(this.name.getText(), <Type> res);
        return state;

    }

    evaluate(state: State): [State, boolean, Value|undefined] {
        let res = state.getDynamicValue(this.oldname.getText());
        if (res === undefined) {
            throw new EvaluationError(this.position, 'Unbound value identifier "'
                + this.oldname.getText() + '".');
        }
        state.setDynamicValue(this.name.getText(), <Value> res);
        return [state, false, undefined];
    }
}

