import { debugExports, createWorkspaceNamesResolver, resolveSettings } from './WorkspacePathResolver'
import * as Path from 'path';
import { WorkspaceFolder } from 'vscode-languageserver';
import { URI as Uri } from 'vscode-uri';
import { CSpellUserSettings } from './cspellConfig';
import { logError } from './log';

jest.mock('vscode-languageserver');
jest.mock('./vscode.config');
jest.mock('./log');

const mockLogError = logError as jest.Mock;

const cspellConfigInVsCode: CSpellUserSettings = {
    ignorePaths: [
        '${workspaceFolder:_server}/**/*.json'
    ],
    import: [
        '${workspaceFolder:_server}/sampleSourceFiles/overrides/cspell.json',
        '${workspaceFolder:_server}/sampleSourceFiles/cSpell.json',
    ],
    enabledLanguageIds: [
        'typescript',
        'javascript',
        'php',
        'json',
        'jsonc'
    ]
};

const cspellConfigCustomUserDictionary: CSpellUserSettings = {
    customUserDictionaries: [
        {
            name: 'Global Dictionary',
            path: '~/words.txt',
            addWords: true,
        }
    ]
};

const cspellConfigCustomWorkspaceDictionary: CSpellUserSettings = {
    customWorkspaceDictionaries: [
        {
            name: 'Workspace Dictionary',
            path: '${workspaceFolder:Server}/sampleSourceFiles/words.txt',
            addWords: true,
        },
        {
            name: 'Project Dictionary',
            addWords: true,
        },
    ]
};

const cspellConfigCustomFolderDictionary: CSpellUserSettings = {
    customFolderDictionaries: [
        {
            name: 'Folder Dictionary',
            path: './packages/_server/words.txt',
            addWords: true,
        },
        {
            name: 'Folder Dictionary 2',
            path: '${workspaceFolder}/words2.txt',
        },
    ]
};


describe('Validate WorkspacePathResolver', () => {
    test('shallowCleanObject', () => {
        const clean = debugExports.shallowCleanObject;
        expect(clean('hello')).toBe('hello');
        expect(clean(42)).toBe(42);
        expect([1,2,3,4]).toEqual([1,2,3,4]);
        expect({}).toEqual({});
        expect({ name: 'name' }).toEqual({ name: 'name' });
        expect({ name: 'name', age: undefined }).toEqual({ name: 'name' });
    });

});

describe('Validate workspace substitution resolver', () => {
    const rootPath = '/path to root/root';
    const clientPath = Path.normalize(Path.join(rootPath, 'client'));
    const serverPath = Path.normalize(Path.join(rootPath, '_server'));
    const clientTestPath = Path.normalize(Path.join(clientPath, 'test'));
    const rootUri = Uri.file(rootPath);
    const clientUri = Uri.file(clientPath);
    const serverUri = Uri.file(serverPath);
    const testUri = Uri.file(clientTestPath);
    const workspaceFolders = {
        root:
        {
            name: 'Root',
            uri: rootUri.toString()
        },
        client:
        {
            name: 'Client',
            uri: clientUri.toString()
        },
        server:
        {
            name: 'Server',
            uri: serverUri.toString()
        },
        test: {
            name: 'client-test',
            uri: testUri.toString()
        }
    };
    const workspaces: WorkspaceFolder[] = [
        workspaceFolders.root,
        workspaceFolders.client,
        workspaceFolders.server,
        workspaceFolders.test,
    ];

    const settingsImports: CSpellUserSettings = Object.freeze({
        'import': [
            'cspell.json',
            '${workspaceFolder}/cspell.json',
            '${workspaceFolder:Client}/cspell.json',
            '${workspaceFolder:Server}/cspell.json',
            '${workspaceFolder:Root}/cspell.json',
            '${workspaceFolder:Failed}/cspell.json',
            'path/${workspaceFolder:Client}/cspell.json',
        ]
    });

    const settingsIgnorePaths: CSpellUserSettings = Object.freeze({
        ignorePaths: [
            '**/node_modules/**',
            '${workspaceFolder}/node_modules/**',
            '${workspaceFolder:Server}/samples/**',
            '${workspaceFolder:client-test}/**/*.json',
        ]
    });

    const settingsDictionaryDefinitions: CSpellUserSettings = Object.freeze({
        dictionaryDefinitions: [
            {
                name: 'My Dictionary',
                path: '${workspaceFolder:Root}/words.txt'
            },
            {
                name: 'Company Dictionary',
                path: '${workspaceFolder}/node_modules/@company/terms/terms.txt'
            },
            {
                name: 'Project Dictionary',
                path: `${rootPath}/terms/terms.txt`
            },
        ].map(f => Object.freeze(f))
    });

    const settingsLanguageSettings: CSpellUserSettings = Object.freeze({
        languageSettings: [
            {
                languageId: 'typescript',
                dictionaryDefinitions: settingsDictionaryDefinitions.dictionaryDefinitions
            }
        ].map(f => Object.freeze(f))
    });

    const settingsOverride: CSpellUserSettings = {
        overrides: [
            {
                filename: '*.ts',
                ignorePaths: settingsIgnorePaths.ignorePaths,
                languageSettings: settingsLanguageSettings.languageSettings,
                dictionaryDefinitions: settingsDictionaryDefinitions.dictionaryDefinitions
            }
        ].map(f => Object.freeze(f))
    };

    test('resolveSettings Imports', () => {
        const resolver = createWorkspaceNamesResolver(workspaces[1], workspaces, undefined);
        const result = resolveSettings(settingsImports, resolver);
        expect(result.import).toEqual([
            'cspell.json',
            `${clientUri.fsPath}/cspell.json`,
            `${clientUri.fsPath}/cspell.json`,
            `${serverUri.fsPath}/cspell.json`,
            `${rootUri.fsPath}/cspell.json`,
            '${workspaceFolder:Failed}/cspell.json',
            'path/${workspaceFolder:Client}/cspell.json',
        ]);
    });

    test('resolveSettings ignorePaths', () => {
        const resolver = createWorkspaceNamesResolver(workspaceFolders.client, workspaces, undefined);
        const result = resolveSettings(settingsIgnorePaths, resolver);
        expect(result.ignorePaths).toEqual([
            '**/node_modules/**',
            '/node_modules/**',
            `${serverUri.path}/samples/**`,
            '/test/**/*.json',
        ]);
    });

    test('resolveSettings dictionaryDefinitions', () => {
        const resolver = createWorkspaceNamesResolver(workspaces[1], workspaces, undefined);
        const result = resolveSettings(settingsDictionaryDefinitions, resolver);
        expect(result.dictionaryDefinitions).toEqual([
            expect.objectContaining({ name: 'My Dictionary', path: `${rootUri.fsPath}/words.txt`}),
            expect.objectContaining({ name: 'Company Dictionary', path: `${clientUri.fsPath}/node_modules/@company/terms/terms.txt`}),
            expect.objectContaining({ name: 'Project Dictionary', path: `${rootPath}/terms/terms.txt`}),
        ]);
    });

    test('resolveSettings languageSettings', () => {
        const resolver = createWorkspaceNamesResolver(workspaces[1], workspaces, undefined);
        const result = resolveSettings(settingsLanguageSettings, resolver);
        expect(result?.languageSettings?.[0]).toEqual({
            languageId: 'typescript',
            dictionaryDefinitions: [
                { name: 'My Dictionary', path: `${rootUri.fsPath}/words.txt`},
                { name: 'Company Dictionary', path: `${clientUri.fsPath}/node_modules/@company/terms/terms.txt`},
                { name: 'Project Dictionary', path: `${rootPath}/terms/terms.txt` },
            ]
        });
    });

    test('resolveSettings overrides', () => {
        const resolver = createWorkspaceNamesResolver(workspaces[1], workspaces, undefined);
        const result = resolveSettings(settingsOverride, resolver);
        expect(result?.overrides?.[0]?.languageSettings?.[0]).toEqual({
            languageId: 'typescript',
            dictionaryDefinitions: [
                { name: 'My Dictionary', path: `${rootUri.fsPath}/words.txt`},
                { name: 'Company Dictionary', path: `${clientUri.fsPath}/node_modules/@company/terms/terms.txt`},
                { name: 'Project Dictionary', path: `${rootPath}/terms/terms.txt` },
            ]
        });
        expect(result?.overrides?.[0]?.dictionaryDefinitions).toEqual([
            { name: 'My Dictionary', path: `${rootUri.fsPath}/words.txt`},
            { name: 'Company Dictionary', path: `${clientUri.fsPath}/node_modules/@company/terms/terms.txt`},
            { name: 'Project Dictionary', path: `${rootPath}/terms/terms.txt` },
        ]);
        expect(result?.overrides?.[0]?.ignorePaths).toEqual([
            '**/node_modules/**',
            '/node_modules/**',
            `${serverUri.path}/samples/**`,
            '/test/**/*.json',
        ]);
    });

    test('resolve custom dictionaries', () => {
        const settings: CSpellUserSettings = {
            ...cspellConfigInVsCode,
            ...settingsDictionaryDefinitions,
            ...cspellConfigCustomFolderDictionary,
            ...cspellConfigCustomUserDictionary,
            ...cspellConfigCustomWorkspaceDictionary,
            dictionaries: [ 'typescript' ],
        }
        const resolver = createWorkspaceNamesResolver(workspaces[1], workspaces, 'custom root');
        const result = resolveSettings(settings, resolver);
        expect(result.dictionaries).toEqual([
            'Global Dictionary',
            'Workspace Dictionary',
            'Project Dictionary',
            'Folder Dictionary',
            'Folder Dictionary 2',
            'typescript',
        ]);
        expect(result.dictionaryDefinitions?.map(d => d.name)).toEqual([
            'Global Dictionary',
            'My Dictionary',
            'Company Dictionary',
            'Project Dictionary',
            'Workspace Dictionary',
            'Folder Dictionary',
            'Folder Dictionary 2',
        ]);
        expect(result.dictionaryDefinitions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'Folder Dictionary',
                path: 'custom root/packages/_server/words.txt',
            }),
            expect.objectContaining({
                name: 'Folder Dictionary 2',
                path: expect.stringMatching(/^[/\\]path to root[/\\]root[/\\]client[/\\]words2\.txt$/),
            }),
        ]));
    });

    test('resolve custom dictionaries by name', () => {
        const settings: CSpellUserSettings = {
            ...cspellConfigInVsCode,
            ...settingsDictionaryDefinitions,
            customWorkspaceDictionaries: [ 'Project Dictionary' ],
            customFolderDictionaries: [ 'Folder Dictionary' ],          // This dictionary doesn't exist.
            dictionaries: [ 'typescript' ],
        }
        const resolver = createWorkspaceNamesResolver(workspaces[1], workspaces, 'custom root');
        const result = resolveSettings(settings, resolver);
        expect(result.dictionaries).toEqual([
            'Project Dictionary',
            'Folder Dictionary',
            'typescript',
        ]);
        expect(result.dictionaryDefinitions?.map(d => d.name)).toEqual([
            'My Dictionary',
            'Company Dictionary',
            'Project Dictionary',
        ]);
        expect(result.dictionaryDefinitions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'Project Dictionary',
                path: '/path to root/root/terms/terms.txt',
            }),
        ]));
        expect(result.dictionaryDefinitions).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'Folder Dictionary',
            }),
        ]));
    });

    test('Unresolved workspaceFolder', () => {
        mockLogError.mockReset()
        const settings: CSpellUserSettings = {
            ...cspellConfigInVsCode,
            ...settingsDictionaryDefinitions,
            customWorkspaceDictionaries: [
                { name: 'Unknown Dictionary' }
            ],
            dictionaries: [ 'typescript' ],
        }
        const resolver = createWorkspaceNamesResolver(workspaces[1], workspaces, 'custom root');
        const result = resolveSettings(settings, resolver);

        expect(result.dictionaryDefinitions).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'Unknown Dictionary',
            }),
        ]));
        expect(mockLogError).toHaveBeenCalledWith('Failed to resolve ${workspaceFolder:_server}');
    });
});