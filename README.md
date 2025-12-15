# Voicecord

A self-bot tool designed to maintain a Discord Voice Chat connection 24/7, preventing AFK kicks and keeping Temp Voice channels active. This script utilizes silence packets to simulate activity and supports automatic reconnection.

## Disclaimer

* **ToS Violation:** Self-bots violate Discord Terms of Service. Misuse may result in account termination.
* **Liability:** The author is not responsible for any consequences resulting from the use of this tool.
* **Recommendation:** Use only on secondary (alt) accounts.

## Features

* **Maintain Connection:** Keeps the account connected to a voice channel continuously.
* **Anti-AFK:** Streams silence packets to bypass Discord's idle detection.
* **Auto Reconnect:** Automatically rejoins the channel upon network loss or server errors.
* **Watchdog Mechanism:** Detects process failures and restarts the connection logic after 60 seconds.
* **Cross-Platform:** Compatible with Windows, Linux, macOS...

## System Requirements

* **Node.js:** Version 16 or higher.
* **Python & Build Tools:** Required for compiling certain dependencies.

## Installation Guide


1.  Clone the repository:
    ```bash
    git clone https://github.com/Mikofoxie/Voicecord.git
    cd Voicecord
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the bot:
    ```bash
    npm start
    ```
    (The script will prompt for your Token, Guild ID, and Channel ID on the first run).
