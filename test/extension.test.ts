import * as assert from 'assert';

// you can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../src/extension';

suite('vscode-github extension tests', () => {
    test('Extension should be active after startup', () => {
        assert.equal(
            vscode.extensions.getExtension('KnisterPeter.vscode-github').isActive,
            true
        );
    });

    test('Extension should register commands', done => {
        vscode.commands.getCommands(true)
            .then(commands => commands.filter(command => command.startsWith('vscode-github')))
            .then(commands => {
                assert.equal(commands.length > 0, true);
            })
            .then(() => done());
    });
});
