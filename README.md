# Datahaven Zealy Claimer

A simple and efficient automated claim script for CampHaven quest rewards.

## Features
- 🚀 **Auto-Address Detection:** Finds the wallet address linked to your token automatically.
- 🔁 **Retry Logic:** Automatically asks to retry failed accounts.
- 🕵️ **Stealth:** Rotates User-Agents to mimic real browser traffic.
- 📂 **Simple Setup:** Just paste tokens into a text file.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mesamirh/Datahaven-Zealy-Claim.git
   cd Datahaven-Zealy-Claim
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Run the script for the first time:
   ```bash
   node index.js
   ```
   *This will create a `data.txt` file in the directory.*

2. Open `data.txt` and paste your session tokens (one per line).
   
   **How to get your token:**
   - Go to [CampHaven](https://camphaven.xyz) and log in.
   - Open Developer Tools (`F12` or Right Click > Inspect).
   - Go to the **Network** tab.
   - Filter by `graphql` or `claim`.
   - Click any request and look at the **Request Headers**.
   - Copy the long string after `Authorization: Bearer ...`.

3. Run the script again:
   ```bash
   node index.js
   ```

## Disclaimer
This script is for educational purposes only. Use it at your own risk. The author is not responsible for any consequences arising from the use of this software.
