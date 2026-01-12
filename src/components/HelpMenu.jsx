import { COMMANDS } from '../config/commands';

const HelpMenu = () => {
    return (
        <div className="mt-8 w-full text-sm animate-in fade-in slide-in-from-bottom-4 space-y-6 pb-20" style={{ color: 'var(--muted-color)' }}>
            {COMMANDS.map((section) => (
                <div key={section.category}>
                    <h3 className="mb-2 text-xs tracking-wider opacity-60">{section.category}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {section.items.map((item) => (
                            <div key={item.cmd} className="flex items-center gap-3">
                                <span
                                    className="px-2 py-1 rounded font-medium text-xs"
                                    style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-color)' }}
                                >
                                    {item.cmd}
                                </span>
                                <span>{item.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default HelpMenu;
