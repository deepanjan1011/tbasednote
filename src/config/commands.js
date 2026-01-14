export const COMMANDS = [
    {
        category: 'CORE',
        items: [
            { cmd: '/c', desc: 'create new note' },
            { cmd: '/a', desc: 'view all notes' },
            { cmd: '/s', desc: 'semantic search' }
        ]
    },
    {
        category: 'SETTINGS',
        items: [
            { cmd: '/acc', desc: 'account details' },
            { cmd: '/conf', desc: 'edit configuration' }
        ]
    },
    {
        category: 'TOOLS',
        items: [
            { cmd: '/export', desc: 'export notes' }
        ]
    },
    {
        category: 'META',
        items: [
            { cmd: '/h', desc: 'hide commands' }
        ]
    },
    {
        category: 'OTHERS',
        items: [
            { cmd: '/joke', desc: 'get a random joke' }
        ]
    }
];
