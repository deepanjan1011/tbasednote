export const SECTIONS = [
    {
        title: 'Appearance',
        items: [
            { key: 'theme', value: 'velvet', type: 'select', options: ['light', 'dark', 'velvet'] },
            { key: 'border_radius', value: '0.5', unit: 'rem', type: 'number' },
            { key: 'border_width', value: '1', unit: 'px', type: 'number' },
            { key: 'zebra_striping', value: 'false', type: 'boolean' }
        ]
    },
    {
        title: 'Homepage',
        items: [
            { key: 'placeholder_text', value: 'Search or command...', type: 'text' },
            { key: 'show_recent_notes_on_homepage', value: 'false', type: 'boolean' },
            { key: 'show_commands_on_homepage', value: 'true', type: 'boolean' },
            { key: 'show_navigation_hints', value: 'true', type: 'boolean' }
        ]
    },
    {
        title: 'Editor',
        items: [
            { key: 'editor_font', value: 'Inter', type: 'text' },
            { key: 'editor_font_size', value: '16', unit: 'px', type: 'number' },
            { key: 'enable_vim_mode', value: 'true', type: 'boolean' }
        ]
    },
    {
        title: 'Layout',
        items: [
            { key: 'margin_top_of_line', value: '25', unit: 'vh', type: 'number' },
            { key: 'width_of_line', value: '48', unit: 'rem', type: 'number' }
        ]
    },
    {
        title: 'Search',
        items: [
            { key: 'match_threshold', value: '48', unit: '%', type: 'number' }
        ]
    },
    {
        title: 'Actions',
        items: [
            { key: 'reset_defaults', type: 'action' }
        ]
    }
];

export const getInitialSettings = () => {
    const defaults = {};
    SECTIONS.forEach(section => {
        section.items.forEach(item => {
            if (item.value !== undefined) {
                defaults[item.key] = item.value;
            }
        });
    });

    try {
        const saved = localStorage.getItem('vylite_settings');
        if (saved) {
            return { ...defaults, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error("Failed to load settings:", e);
    }

    return defaults;
};
