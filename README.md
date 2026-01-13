# 0xNote

A minimalist, keyboard-centric note-taking application inspired by the Vim aesthetic.

## Features

- **Keyboard-First Design**: Navigate the entire app using keyboard commands.
- **Command Palette**: Access all features via slash commands (`/c`, `/a`, `/conf`).
- **Void Theme**: Deep dark interface for focused writing.
- **Local-First**: Fast and private, with notes stored locally.

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run development server**:
    ```bash
    npm run dev
    ```

3.  **Setup Backend (Optional)**:
    -   To enable Cloud Sync and Authentication, follow the [Supabase Setup Guide](./SETUP_SUPABASE.md).

## Commands

- `/c` - Create a new note
- `/a` - View all notes
- `/conf` - Open configuration settings
- `/h` - Show help/commands
- `Esc` - Return to home/root view

## Tech Stack

- React
- Vite
- Tailwind CSS
- Dexie.js (IndexedDB)
