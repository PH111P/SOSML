import * as React from 'react';

const CodeMirror: any = require('react-codemirror');
require('codemirror/lib/codemirror.css');
require('codemirror/mode/mllike/mllike.js');
require('codemirror/addon/edit/matchbrackets.js');
import './CodeMirrorWrapper.css';

export interface Props {
    flex?: boolean;
}

class CodeMirrorWrapper extends React.Component<Props, any> {
    editor: any;

    constructor(props: Props) {
        super(props);
    }

    render() {
        const options = {
            lineNumbers: true,
            mode: 'mllike',
            indentUnit: 4,
            matchBrackets: true,
            lineWrapping: true
        };
        let classAdd = '';
        if (this.props.flex) {
            classAdd = 'flexy flexcomponent';
        }
        return (
            <CodeMirror className={classAdd} ref={(editor: any) => {this.editor = editor; }}
                value="fun test x = x + 1;" options={options}/>
        );
    }

    componentDidMount() {
        var GCodeMirror = this.editor.getCodeMirrorInstance();
        let keyMap = GCodeMirror.keyMap;
        keyMap.default['Shift-Tab'] = 'indentLess';
        keyMap.default.Tab = function(cm: any) {
            if (cm.somethingSelected()) {
                return cm.indentSelection('add');
            } else {
                return GCodeMirror.commands.insertSoftTab(cm);
            }
        };
        this.editor.getCodeMirror().refresh();
    }
}

export default CodeMirrorWrapper;
