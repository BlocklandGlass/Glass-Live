# Glass-Live

## Overview

This is the main Node.js server application for running Blockland Glass' Glass Live service.

## Installing

### Prerequisites

You must have the following installed:

- Node.js
- MongoDB

### Database Format

At this current time, Glass Live will not automatically create the database for you.

The MongoDB instance must have a database named `glassLive` and an empty collection named `users` under it.

### Setup

1. Ensure the MongoDB instance is online and the database format has been manually created as mentioned above.
2. Copy `config.json.default` in the root directory and rename it to `config.json` (same location).
3. Open the renamed `config.json` and edit the details to match your Glass website and database setup.
4. Run `index.js` to launch the Glass Live server.

You can now create a `dev/config.json` file in your Blockland Glass client directory and connect to your Glass Live server.
Example `config.json` below:

```json
{
  "address": "localhost",
  "netAddress": "localhost",
  "liveAddress": "localhost",
  "livePort": 27002,
  "debug": false
}
```