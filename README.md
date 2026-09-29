[![NPM Version](https://img.shields.io/npm/v/%40sie-js%2Fswilib-tools)](https://www.npmjs.com/package/@sie-js/swilib-tools)

# Summary

A command-line utility for working with swilib and patterns.

Supported on all major operating systems: Linux, macOS, and Windows.

# Install

### macOS & Linux
1. Install the latest version of [Node.js](https://nodejs.org/en/download/).
2. Install the package:

   ```bash
   npm install -g @sie-js/swilib-tools@latest
   ```

### Windows
1. Find and install the USB drivers for your phone.
2. Install scoop: https://scoop.sh/
3. Run in PowerShell:
   ```powershell
   scoop bucket add main
   scoop install main/nodejs
   npm install -g @sie-js/swilib-tools@latest
   ```

### External dependencies
These external tools must be available in your PATH:
- arm-none-eabi-gcc
- git
- ptr89

# Development root
This tool requires some external repositories to work properly.

The default path to the development root is `<HOME>/dev/sie`, `<HOME>/dev/siemens`, or the current working directory.

Otherwise, you can specify any path using the `-R, --root` option.

A simple way to create a development root:
```bash
mkdir -p ~/dev/sie
cd ~/dev/sie
git clone https://github.com/siemens-mobile-hacks/sdk --depth 1
git clone https://github.com/siemens-mobile-hacks/patches --depth 1
git clone https://git.siepatch.dev/siepatch/stripped-fullflashes.git
```

Also, remember to pull the latest changes from these repositories regularly.

# Usage
```
Usage: swilib-tools [options] [command]

CLI tool for Siemens Mobile phone development.

Options:
  -v, --version                output the version number
  -R, --root                   path to the root directory with the SDK and other repos
  -h, --help                   display help for command

Commands:
  server [options]             API for web frontend
  check [options]              Check swilib.vkp for errors
  merge [options]              Merge two swilib.vkp files (source.vkp → destination.vkp)
  convert [options]            Convert swilib to other formats
  gen-data-types [options]     Generate data types for Ghidra SRE
  gen-asm-symbols [options]    Generate assembler symbols for the SDK
  gen-simulator-api [options]  Generate API stubs for the ELF emulator
  update-db                    Pull repositories and update pattern caches
  help [command]               display help for command
```

# AI-assisted contributions

We are not against AI. We are against vibe coding, AI slop, and attempts to offload engineering work to a model. This project prioritizes quality, not development speed or results at any cost.

1. **Do not use AI-generated text in human-to-human communication.**

   Write comments, discussions, PR descriptions, and responses to reviewers yourself.

2. **Do not let AI submit PRs or commits.**

   The author must always be a human who has personally reviewed the changes and takes responsibility for them.

4. **Do not submit code primarily designed or written by AI.**

   Architecture, algorithms, code organization, and the final implementation must be decided by a human. AI may only be used as an auxiliary tool.

6. **You must understand all the code you submit.**

   You must be able to explain every change, justify your decisions, and fix any problems yourself. If you do not understand the code, open a feature request instead of a PR.

8. **Code must be simple, clear, and tested.**

   Follow KISS, the project's coding style, and its existing architecture. Do not introduce unnecessary abstractions, dependencies, or untested changes.

AI slop PRs will be closed without review.
