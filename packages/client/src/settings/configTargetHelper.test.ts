import { mocked } from 'ts-jest/utils';
import { ConfigurationTarget, Uri, window } from 'vscode';
import { ClientConfigTarget } from './clientConfigTarget';
import {
    _buildQuickPickBestMatchTargetFn,
    createClientConfigTargetCSpell,
    createClientConfigTargetDictionary,
    createClientConfigTargetVSCode,
    createConfigTargetMatchPattern,
    dictionaryTargetBestMatch,
    dictionaryTargetCSpell,
    doesTargetMatchPattern,
    filterClientConfigTargets,
    findBestMatchingConfigTargets,
    matchKindAll,
    matchKindCSpell,
    matchKindNone,
    matchKindVSCode,
    matchKindDictionary,
    matchScopeAll,
    matchScopeAllButUser,
    matchScopeFolder,
    matchScopeNone,
    matchScopeUser,
    matchScopeWorkspace,
    negatePattern,
    quickPickBestMatchTarget,
} from './configTargetHelper';

const dirUri = Uri.file(__dirname);
const fileUri = Uri.file(__filename);

const mockedShowQuickPick = mocked(window.showQuickPick);

const ctDictA = createClientConfigTargetDictionary(Uri.joinPath(dirUri, 'a/words1.txt'), 'unknown');
const ctDictB = createClientConfigTargetDictionary(Uri.joinPath(dirUri, 'a/words2.txt'), 'unknown', 'more-words');
const ctCspell = createClientConfigTargetCSpell(Uri.joinPath(dirUri, '../../cspell.json'), 'unknown');
const ctVSCodeF = createClientConfigTargetVSCode(ConfigurationTarget.WorkspaceFolder, fileUri, undefined);
const ctVSCodeW = createClientConfigTargetVSCode(ConfigurationTarget.Workspace, fileUri, undefined);
const ctDictU = createClientConfigTargetDictionary(Uri.joinPath(dirUri, 'a/user-words.txt'), 'user', 'my-words');
const ctVSCodeU = createClientConfigTargetVSCode(ConfigurationTarget.Global, fileUri, undefined);

describe('configTargetHelper', () => {
    test('findMatchingConfigTargets all', () => {
        const pattern = createConfigTargetMatchPattern(matchKindAll, matchScopeAll);
        const targets = sampleTargets();
        // Dictionaries are the best match
        const r = findBestMatchingConfigTargets(pattern, targets);
        expect(r).toEqual([targets[0], targets[1]]);
    });

    test('findMatchingConfigTargets user', () => {
        const pattern = createConfigTargetMatchPattern(matchKindAll, matchScopeUser);
        const targets = sampleTargets();
        // Dictionaries are the best match
        const r = findBestMatchingConfigTargets(pattern, targets);
        expect(r).toEqual([targets[5]]);
    });

    test('findMatchingConfigTargets cspell', () => {
        const pattern = createConfigTargetMatchPattern(matchKindCSpell, matchScopeAll);
        const targets = sampleTargets();
        // Dictionaries are the best match
        const r = findBestMatchingConfigTargets(pattern, targets);
        expect(r).toEqual([targets[2]]);
    });

    test('findMatchingConfigTargets vscode', () => {
        const pattern = createConfigTargetMatchPattern(matchKindVSCode, matchScopeWorkspace);
        const targets = sampleTargets();
        // Dictionaries are the best match
        const r = findBestMatchingConfigTargets(pattern, targets);
        expect(r).toEqual([targets[4]]);
    });

    test('buildMatchTargetFn best dictionary', async () => {
        mockedShowQuickPick.mockImplementation(async (items) => (await items)[1]);
        const targets = sampleTargets();
        const r = await dictionaryTargetBestMatch(targets);
        expect(r).toEqual(targets[1]);
    });

    test('buildMatchTargetFn best dictionary', async () => {
        mockedShowQuickPick.mockImplementation(async (items) => (await items)[1]);
        const targets = sampleTargets();
        const r = await dictionaryTargetCSpell(targets);
        expect(r).toEqual(targets[2]);
    });

    test('buildMatchTargetFn best dictionary user canceled quickPick', async () => {
        mockedShowQuickPick.mockImplementation(async () => undefined);
        const targets = sampleTargets();
        const r = await dictionaryTargetBestMatch(targets);
        expect(r).toBeUndefined();
    });

    test('buildMatchTargetFn best no match', async () => {
        mockedShowQuickPick.mockImplementation(async () => undefined);
        const targets = sampleTargets();
        const fn = await _buildQuickPickBestMatchTargetFn(matchKindNone, matchScopeNone);
        await expect(() => fn(targets)).rejects.toEqual(new Error('No matching configuration found.'));
    });

    test('quickPickBestMatchTarget', async () => {
        mockedShowQuickPick.mockImplementation(async (items) => (await items)[1]);
        const targets = sampleTargets();
        const pattern = createConfigTargetMatchPattern(matchKindAll, matchScopeAllButUser);
        const r = await quickPickBestMatchTarget(pattern, targets);
        expect(r).toBe(targets[1]);
    });

    test.each`
        kind               | scope             | eKind                                 | eScope
        ${{}}              | ${{}}             | ${matchKindAll}                       | ${matchScopeAll}
        ${matchKindAll}    | ${matchScopeAll}  | ${{}}                                 | ${{}}
        ${matchKindCSpell} | ${matchScopeUser} | ${{ ...matchKindAll, cspell: false }} | ${matchScopeAllButUser}
    `('negatePattern kind: $kind, scope: $scope', ({ kind, scope, eKind, eScope }) => {
        const p = createConfigTargetMatchPattern(kind, scope);
        const e = createConfigTargetMatchPattern(eKind, eScope);
        expect(negatePattern(p)).toEqual(e);
    });

    test.each`
        target       | kind               | scope               | expected
        ${ctCspell}  | ${matchKindCSpell} | ${matchScopeAll}    | ${true}
        ${ctDictU}   | ${matchKindAll}    | ${matchScopeUser}   | ${true}
        ${ctVSCodeF} | ${matchKindAll}    | ${matchScopeUser}   | ${false}
        ${ctVSCodeF} | ${matchKindAll}    | ${matchScopeFolder} | ${true}
    `('doesTargetMatchPattern', ({ target, kind, scope, expected }) => {
        const pattern = createConfigTargetMatchPattern(kind, scope);
        expect(doesTargetMatchPattern(target, pattern)).toBe(expected);
    });

    test.each`
        targets                         | kind                   | scope            | expected
        ${[ctCspell]}                   | ${matchKindCSpell}     | ${matchScopeAll} | ${[ctCspell]}
        ${[ctCspell, ctDictA, ctDictB]} | ${matchKindCSpell}     | ${matchScopeAll} | ${[ctCspell]}
        ${[ctCspell, ctDictA, ctDictB]} | ${matchKindDictionary} | ${matchScopeAll} | ${[ctDictA, ctDictB]}
    `('filterClientConfigTargets', ({ targets, kind, scope, expected }) => {
        const pattern = createConfigTargetMatchPattern(kind, scope);
        expect(filterClientConfigTargets(targets, pattern)).toEqual(expected);
        const fn = (t: ClientConfigTarget) => doesTargetMatchPattern(t, pattern);
        expect(filterClientConfigTargets(targets, fn)).toEqual(expected);
    });
});

function sampleTargets(): ClientConfigTarget[] {
    return [ctDictA, ctDictB, ctCspell, ctVSCodeF, ctVSCodeW, ctDictU, ctVSCodeU];
}